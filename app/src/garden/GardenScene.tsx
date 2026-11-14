/**
 * GardenScene — composes the asset slots into the 390×844 scene space.
 * Same layout rules as the prototype: flowers outside x∈[125,265].
 * `sim` overlays the animated what-if state driven by HomeScreen.
 */
import React, { useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import Svg, { Ellipse, G, Rect, Text as SvgText } from "react-native-svg";

import type { FlowerState, GardenState } from "../api";
import {
  Backdrop,
  Birch,
  Flower,
  InvestSapling,
  Pond,
  RailPlate,
  Rain,
  Taimi,
  Variant,
  pal,
} from "./assets";

const FX = [115, 162, 268, 314, 356];
const FY = 575; // flower base: just in front of the painted fence (post bases ~554)
const TSCALE = [3.3, 2.4, 2.0, 1.7];
const SHADOW_RX = [46, 42, 50, 58];

/** Short display names for the flower tags under each head. */
export const FLOWER_SHORT: Record<string, string> = {
  Restaurants: "Dining",
  Entertainment: "Fun",
  Lifestyle: "Shopping",
  Travel: "Travel",
  Taxi: "Taxi",
};

/** Non-overlapping per-flower hit bounds (scene coords), split at the
 * midpoints between adjacent flowers so taps never feel random. */
const FBOUNDS = FX.map((x, i) => ({
  lo: i === 0 ? x - 24 : (FX[i - 1] + x) / 2,
  hi: i === FX.length - 1 ? x + 24 : (x + FX[i + 1]) / 2,
}));

export type SceneObject = "weather" | "bills" | "savings" | "invest" | "taimi" | "fun";

/** Tappable scene objects (scene coords): sky, rent plate, pond, tree, Taimi. */
const OBJECT_AREAS: { kind: SceneObject; x0: number; y0: number; x1: number; y1: number }[] = [
  { kind: "weather", x0: 15, y0: 80, x1: 375, y1: 400 },
  { kind: "bills", x0: 10, y0: 430, x1: 300, y1: 575 },
  { kind: "savings", x0: 10, y0: 585, x1: 165, y1: 720 },
  { kind: "invest", x0: 295, y0: 370, x1: 388, y1: 560 },
  { kind: "taimi", x0: 135, y0: 470, x1: 260, y1: 685 },
];

const pillBox = (text: string, x: number, y: number, end?: boolean) => {
  const w = Math.round(text.length * 5.6) + 16;
  return { x0: end ? x - w : x - w / 2, y0: y, w, h: 20 };
};

/** Flower head position in scene coords (flower base at FY, sprite ~96 tall). */
export const flowerHead = (i: number) => ({ x: FX[i], y: 435 });
export const flowerIndex = (g: GardenState, name: string) =>
  g.flowers.slice(0, 5).findIndex((f) => f.flower === name);
export const POND_POS = { x: 88, y: 645 };
export const POCKET_POS = { x: 88, y: 575 };

export interface VB {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const VB_DEF: VB = { x: 0, y: 60, w: 390, h: 844 };

/** Sim mode: bottom-anchored window sized to the actual viewport so the pond,
 * Taimi and the flowers are never cropped below the taller control panel.
 * Always includes the flower-heads→ground band (rows ~390–844); widens the
 * window when the viewport is too short for it at width scale. */
export function simViewBox(w: number, h: number): VB {
  const vhFit = Math.min(844, Math.max(280, Math.round((h * 390) / Math.max(1, w))));
  const vh = Math.max(360, vhFit);
  const vw = Math.max(390, Math.round((vh * w) / Math.max(1, h)));
  return { x: (390 - vw) / 2, y: 745 - vh, w: vw, h: vh };
}

/** xMidYMid slice mapping for a given viewBox. */
export function sceneXY(w: number, h: number, sx: number, sy: number, vb: VB = VB_DEF) {
  const s = Math.max(w / vb.w, h / vb.h);
  return {
    x: (w - vb.w * s) / 2 + (sx - vb.x) * s,
    y: (h - vb.h * s) / 2 + (sy - vb.y) * s,
  };
}

export interface SimVisual {
  selected: string;
  pondLevel: number;
  pocket: number;
  flowerState: FlowerState["state"];
  flowerScale: number;
  taimiStage: number;
  taimiScale: number;
  warm: boolean;
}

const variantOf = (g: GardenState): Variant =>
  g.storm ? "storm" : g.left_cycle > 0 ? "sun" : "cloud";

/** Small readable label pill placed inside the 390×844 scene space. */
function ScenePill({
  x,
  y,
  text,
  end,
  bg = "#FFFFFF",
  fg = "#2E4438",
}: {
  x: number;
  y: number;
  text: string;
  end?: boolean;
  bg?: string;
  fg?: string;
}) {
  const w = Math.round(text.length * 5.6) + 16;
  const x0 = end ? x - w : x - w / 2;
  return (
    <G>
      <Rect x={x0} y={y} width={w} height={20} rx={10} fill={bg} opacity={0.88} />
      <SvgText x={end ? x - 8 : x} y={y + 14} textAnchor={end ? "end" : "middle"} fontSize={10.5} fontWeight="700" fill={fg}>
        {text}
      </SvgText>
    </G>
  );
}

export function GardenScene({
  g,
  onFlowerPress,
  onObjectPress,
  labels,
  sim,
}: {
  g: GardenState;
  onFlowerPress?: (flower: string) => void;
  onObjectPress?: (kind: SceneObject) => void;
  labels?: boolean;
  sim?: SimVisual;
}) {
  const v: Variant = variantOf(g);
  const stage = Math.min(4, Math.max(1, sim?.taimiStage ?? g.stage));
  const pondRatio = g.pond_target > 0 ? g.pond_fill / g.pond_target : 0;
  const pondLevel = sim?.pondLevel ?? pondRatio;
  const rw = g.next_rent_window;
  const [sz, setSz] = useState<{ w: number; h: number } | null>(null);

  // slice math — in sim mode the viewBox hugs the bottom of the scene
  const vb = sim && sz ? simViewBox(sz.w, sz.h) : VB_DEF;
  const scale = sz ? Math.max(sz.w / vb.w, sz.h / vb.h) : 0;
  const ox = sz ? (sz.w - vb.w * scale) / 2 : 0;
  const oy = sz ? (sz.h - vb.h * scale) / 2 : 0;

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSz({ w: width, h: height });
      }}
    >
      <Svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Backdrop variant={v} vb={vb} />
      {sim?.warm && <Rect x={-200} y={60} width={790} height={844} fill="#FFDF9E" opacity={0.12} />}
      {g.invest_total > 0 ? (
        <G x={344} y={545}>
          <Birch berries />
        </G>
      ) : (
        <G x={344} y={545}>
          <InvestSapling />
        </G>
      )}
      <G x={52} y={560}>
        <RailPlate
          variant={v}
          rent={g.rent}
          paid={g.rent_paid}
          windowText={`next ~${rw.d0}–${rw.d1} ${rw.month}`}
        />
      </G>
      <G x={88} y={668}>
        <Pond level={pondLevel} variant={v} />
      </G>
      {sim && sim.pocket > 0 && (
        <ScenePill x={42} y={596} text={`pocket +${Math.round(sim.pocket)} €`} bg="#F7E7B0" fg="#6B5718" />
      )}
      <Ellipse
        cx="195"
        cy="643"
        rx={SHADOW_RX[stage - 1]}
        ry="7"
        fill={pal("shade", v)}
        opacity={0.55}
      />
      <G x={195} y={640} scale={TSCALE[stage - 1] * (sim?.taimiScale ?? 1)}>
        <Taimi stage={stage} mood={v} />
      </G>
      {g.flowers.slice(0, 5).map((f, i) => {
        const sel = sim?.selected === f.flower;
        return (
          <G
            key={f.flower}
            x={FX[i]}
            y={sel ? 560 : 575}
            scale={2.8 * (sel ? sim?.flowerScale ?? 1 : 1)}
            opacity={sim && !sel ? 0.45 : 1}
          >
            <Ellipse cx="0" cy="-1" rx="15" ry="2.6" fill={pal("shade", v)} opacity={0.5} />
            {sel && <Ellipse cy={-46} rx={24} ry={30} fill="#FFE9A8" opacity={0.4} />}
            <Flower
              category={f.flower}
              state={sel ? sim!.flowerState : f.norm === 0 && f.last30 === 0 ? "dormant" : f.state}
            />
          </G>
        );
      })}
      {/* cool veil over the ground band so sprites sit in storm/cloud light */}
      {v !== "sun" && (
        <Rect x={-200} y={420} width={790} height={484} fill="#2E4159" opacity={v === "storm" ? 0.18 : 0.07} />
      )}
      {v === "storm" && <Rain />}
      {labels && !sim && (
        <G>
          <ScenePill x={52} y={448} text="Bills ›" />
          <ScenePill x={42} y={596} text="Savings ›" />
          <ScenePill x={378} y={486} end text={`${g.invest_total > 0 ? "Investments" : "No investments yet"} ›`} />
        </G>
      )}
      {/* tiny name tag under each flower */}
      {g.flowers.slice(0, 5).map((f, i) => {
        const name = FLOWER_SHORT[f.flower] ?? f.flower;
        const w = name.length * 5.8 + 12;
        const y = i % 2 === 0 ? 588 : 604;
        return (
          <G key={`tag-${f.flower}`} opacity={sim && sim.selected !== f.flower ? 0.45 : 0.9}>
            <Rect x={FX[i] - w / 2} y={y} width={w} height={13} rx={6.5} fill="#FFFFFF" opacity={0.78} />
            <SvgText x={FX[i]} y={y + 10} textAnchor="middle" fontSize={8.5} fontWeight="700" fill="#40514A">
              {name}
            </SvgText>
          </G>
        );
      })}
      </Svg>
      {/* transparent tap targets — sky/objects first, pills, flowers last (on top) */}
      {sz && (
        <>
          {onObjectPress &&
            OBJECT_AREAS.map((a) => (
              <Pressable
                key={a.kind}
                accessibilityRole="button"
                accessibilityLabel={a.kind}
                onPress={() => onObjectPress(a.kind)}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: ox + (a.x0 - vb.x) * scale,
                  top: oy + (a.y0 - vb.y) * scale,
                  width: (a.x1 - a.x0) * scale,
                  height: (a.y1 - a.y0) * scale,
                  backgroundColor: pressed ? "rgba(255,255,255,0.35)" : "transparent",
                  borderRadius: 12,
                })}
              />
            ))}
          {labels &&
            !sim &&
            onObjectPress &&
            [
              pillBox("Bills ›", 52, 448),
              pillBox("Savings ›", 42, 596),
              pillBox(`${g.invest_total > 0 ? "Investments" : "No investments yet"} ›`, 378, 486, true),
            ].map((b, i) => (
              <Pressable
                key={`pill-${i}`}
                accessibilityRole="button"
                onPress={() => onObjectPress(["bills", "savings", "invest"][i] as SceneObject)}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: ox + (b.x0 - vb.x) * scale - 4,
                  top: oy + (b.y0 - vb.y) * scale - 4,
                  width: b.w * scale + 8,
                  height: b.h * scale + 8,
                  backgroundColor: pressed ? "rgba(255,255,255,0.45)" : "transparent",
                  borderRadius: 14,
                })}
              />
            ))}
          {onFlowerPress &&
            g.flowers.slice(0, 5).map((f, i) => (
              <Pressable
                key={f.flower}
                accessibilityRole="button"
                accessibilityLabel={f.flower}
                onPress={() => onFlowerPress(f.flower)}
                style={({ pressed }) => ({
                  position: "absolute",
                  left: ox + (FBOUNDS[i].lo - vb.x) * scale,
                  top: oy + (415 - vb.y) * scale,
                  width: (FBOUNDS[i].hi - FBOUNDS[i].lo) * scale,
                  height: 200 * scale,
                  backgroundColor: pressed ? "rgba(255,255,255,0.35)" : "transparent",
                  borderRadius: 12,
                })}
              />
            ))}
        </>
      )}
    </View>
  );
}

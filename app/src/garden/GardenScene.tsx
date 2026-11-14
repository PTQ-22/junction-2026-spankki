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
  Rail,
  RailPlate,
  Rain,
  Taimi,
  Variant,
  Weather,
  pal,
} from "./assets";

const FX = [102, 118, 278, 320, 352];
const TSCALE = [2.2, 1.6, 1.35, 1.15];
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
  { kind: "weather", x0: 20, y0: 80, x1: 370, y1: 300 },
  { kind: "bills", x0: 8, y0: 372, x1: 96, y1: 436 },
  { kind: "savings", x0: 30, y0: 548, x1: 148, y1: 662 },
  { kind: "invest", x0: 322, y0: 425, x1: 378, y1: 560 },
  { kind: "taimi", x0: 140, y0: 460, x1: 252, y1: 655 },
];

const pillBox = (text: string, x: number, y: number, end?: boolean) => {
  const w = Math.round(text.length * 5.6) + 16;
  return { x0: end ? x - w : x - w / 2, y0: y, w, h: 20 };
};

/** Flower head position in scene coords (flower G at y=512, head ≈ -49·1.85). */
export const flowerHead = (i: number) => ({ x: FX[i], y: 421 });
export const flowerIndex = (g: GardenState, name: string) =>
  g.flowers.slice(0, 5).findIndex((f) => f.flower === name);
export const POND_POS = { x: 88, y: 610 };
export const POCKET_POS = { x: 88, y: 552 };

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
  const vh = Math.max(454, vhFit);
  const vw = Math.max(390, Math.round((vh * w) / Math.max(1, h)));
  return { x: (390 - vw) / 2, y: 844 - vh, w: vw, h: vh };
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
      <Backdrop variant={v} />
      {sim?.warm && <Rect x={-200} y={60} width={790} height={784} fill="#FFDF9E" opacity={0.12} />}
      <Weather kind={v} />
      <G x={36} y={430} scale={0.8}>
        <Birch />
      </G>
      <Rail variant={v} />
      <RailPlate
        variant={v}
        rent={g.rent}
        paid={g.rent_paid}
        windowText={`next ~${rw.d0}–${rw.d1} ${rw.month}`}
      />
      {g.invest_total > 0 ? (
        <G x={344} y={470} scale={1.15}>
          <Birch berries />
        </G>
      ) : (
        <G x={344} y={472}>
          <InvestSapling />
        </G>
      )}
      <G y={-34}>
        <Pond level={pondLevel} variant={v} />
      </G>
      {sim && sim.pocket > 0 && (
        <ScenePill x={88} y={552} text={`pocket +${Math.round(sim.pocket)} €`} bg="#F7E7B0" fg="#6B5718" />
      )}
      <Ellipse
        cx="195"
        cy="606"
        rx={SHADOW_RX[stage - 1]}
        ry="7"
        fill={pal("shade", v)}
        opacity={0.75}
      />
      <G x={195} y={600} scale={TSCALE[stage - 1] * (sim?.taimiScale ?? 1)}>
        <Taimi stage={stage} mood={v} />
      </G>
      {g.flowers.slice(0, 5).map((f, i) => {
        const sel = sim?.selected === f.flower;
        return (
          <G
            key={f.flower}
            x={FX[i]}
            y={sel ? 500 : 512}
            scale={1.85 * (sel ? sim?.flowerScale ?? 1 : 1)}
            opacity={sim && !sel ? 0.45 : 1}
          >
            {sel && <Ellipse cy={-44} rx={19} ry={24} fill="#FFE9A8" opacity={0.4} />}
            <Flower
              category={f.flower}
              state={sel ? sim!.flowerState : f.norm === 0 && f.last30 === 0 ? "dormant" : f.state}
            />
          </G>
        );
      })}
      {v === "storm" && <Rain />}
      {labels && !sim && (
        <G>
          <ScenePill x={50} y={392} text="Bills ›" />
          <ScenePill x={240} y={336} text="Fun spending ›" />
          <ScenePill x={88} y={566} text="Savings ›" />
          <ScenePill x={300} y={400} end text={`${g.invest_total > 0 ? "Investments" : "No investments yet"} ›`} />
        </G>
      )}
      {/* tiny name tag under each flower head */}
      {g.flowers.slice(0, 5).map((f, i) => (
        <SvgText
          key={`tag-${f.flower}`}
          x={FX[i]}
          y={i % 2 === 0 ? 436 : 448}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight="700"
          fill="#40514A"
          opacity={sim && sim.selected !== f.flower ? 0.45 : 0.85}
        >
          {FLOWER_SHORT[f.flower] ?? f.flower}
        </SvgText>
      ))}
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
              pillBox("Bills ›", 50, 392),
              pillBox("Fun spending ›", 240, 336),
              pillBox("Savings ›", 88, 566),
              pillBox(`${g.invest_total > 0 ? "Investments" : "No investments yet"} ›`, 300, 400, true),
            ].map((b, i) => (
              <Pressable
                key={`pill-${i}`}
                accessibilityRole="button"
                onPress={() => onObjectPress(["bills", "fun", "savings", "invest"][i] as SceneObject)}
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
                  top: oy + (395 - vb.y) * scale,
                  width: (FBOUNDS[i].hi - FBOUNDS[i].lo) * scale,
                  height: 150 * scale,
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

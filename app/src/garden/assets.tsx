/**
 * Asset slot map — generated gouache PNGs (prototype/art → app/assets/garden).
 * Every scene element goes through this file; component names/props are the
 * stable slots, internals render the PNGs via react-native-svg <Image>.
 *
 * Coordinates: sprites are drawn bottom-centre anchored at local (0,0);
 * GardenScene positions them in the 390-wide scene space. The background
 * is a fixed scene-space rect (same in every viewBox mode): image row ~925
 * (fence post bases) lands at scene y≈554.
 */
import React from "react";
import { Image as RNImage } from "react-native";
import { Ellipse, G, Image as SvgImage, Line, Text as SvgText } from "react-native-svg";

export type Variant = "sun" | "cloud" | "storm";
export type FlowerSt = "dormant" | "wilting" | "ok" | "blooming";

/** Minimal palette kept for shadow ellipses / overlays. */
const NS = {
  shade: { sun: "#A4BA8B", cloud: "#9BAE84", storm: "#49593E" },
} as const;
export const pal = (k: keyof typeof NS, v: Variant) => NS[k][v];

/* ---- asset registry (intrinsic px, post-downscale) ------------------------- */
const ART: Record<string, { src: number; w: number; h: number }> = {
  "bg-sun": { src: require("../../assets/garden/bg-sun.png"), w: 1080, h: 1935 },
  "bg-cloud": { src: require("../../assets/garden/bg-cloud.png"), w: 1080, h: 1935 },
  "bg-storm": { src: require("../../assets/garden/bg-storm.png"), w: 1080, h: 1935 },
  "flower-dormant": { src: require("../../assets/garden/flower-dormant.png"), w: 191, h: 234 },
  "flower-restaurants-blooming": { src: require("../../assets/garden/flower-restaurants-blooming.png"), w: 201, h: 512 },
  "flower-restaurants-ok": { src: require("../../assets/garden/flower-restaurants-ok.png"), w: 221, h: 512 },
  "flower-restaurants-wilting": { src: require("../../assets/garden/flower-restaurants-wilting.png"), w: 310, h: 512 },
  "flower-entertainment-blooming": { src: require("../../assets/garden/flower-entertainment-blooming.png"), w: 274, h: 512 },
  "flower-entertainment-ok": { src: require("../../assets/garden/flower-entertainment-ok.png"), w: 322, h: 512 },
  "flower-entertainment-wilting": { src: require("../../assets/garden/flower-entertainment-wilting.png"), w: 404, h: 512 },
  "flower-lifestyle-blooming": { src: require("../../assets/garden/flower-lifestyle-blooming.png"), w: 311, h: 512 },
  "flower-lifestyle-ok": { src: require("../../assets/garden/flower-lifestyle-ok.png"), w: 280, h: 512 },
  "flower-lifestyle-wilting": { src: require("../../assets/garden/flower-lifestyle-wilting.png"), w: 221, h: 512 },
  "flower-travel-blooming": { src: require("../../assets/garden/flower-travel-blooming.png"), w: 202, h: 512 },
  "flower-travel-ok": { src: require("../../assets/garden/flower-travel-ok.png"), w: 197, h: 512 },
  "flower-travel-wilting": { src: require("../../assets/garden/flower-travel-wilting.png"), w: 298, h: 512 },
  "flower-taxi-blooming": { src: require("../../assets/garden/flower-taxi-blooming.png"), w: 329, h: 512 },
  "flower-taxi-ok": { src: require("../../assets/garden/flower-taxi-ok.png"), w: 273, h: 512 },
  "flower-taxi-wilting": { src: require("../../assets/garden/flower-taxi-wilting.png"), w: 274, h: 512 },
  "taimi-1": { src: require("../../assets/garden/taimi-1.png"), w: 512, h: 462 },
  "taimi-2": { src: require("../../assets/garden/taimi-2.png"), w: 512, h: 499 },
  "taimi-3": { src: require("../../assets/garden/taimi-3.png"), w: 279, h: 512 },
  "taimi-4": { src: require("../../assets/garden/taimi-4.png"), w: 274, h: 512 },
  "pond-full": { src: require("../../assets/garden/pond-full.png"), w: 512, h: 251 },
  "pond-half": { src: require("../../assets/garden/pond-half.png"), w: 512, h: 276 },
  "pond-empty": { src: require("../../assets/garden/pond-empty.png"), w: 512, h: 335 },
  "birch-grown": { src: require("../../assets/garden/birch-grown.png"), w: 184, h: 512 },
  "birch-sapling": { src: require("../../assets/garden/birch-sapling.png"), w: 233, h: 512 },
  sign: { src: require("../../assets/garden/sign.png"), w: 512, h: 491 },
  coin: { src: require("../../assets/garden/coin.png"), w: 312, h: 352 },
};
export const ART_SRC = (name: string) => ART[name].src;

/** A sprite drawn bottom-centre anchored at local (0,0), height h. */
function Art({ name, h, opacity = 1, x = 0 }: { name: string; h: number; opacity?: number; x?: number }) {
  const a = ART[name];
  const w = (a.w / a.h) * h;
  return (
    <SvgImage
      href={a.src}
      x={x - w / 2}
      y={-h}
      width={w}
      height={h}
      opacity={opacity}
      preserveAspectRatio="xMidYMax meet"
    />
  );
}

/** Sprite-bbox veils drew visible rectangles around sprites — removed;
 * mood now comes only from the scene-wide veil in GardenScene. */

/* ---- flowers -------------------------------------------------------------- */
const FLOWER_KEY: Record<string, string> = {
  Restaurants: "restaurants",
  Entertainment: "entertainment",
  Lifestyle: "lifestyle",
  Travel: "travel",
  Taxi: "taxi",
};
const FLOWER_H: Record<FlowerSt, number> = { blooming: 54, ok: 52, wilting: 46, dormant: 13 };

/** SLOT: flower/{category}/{state} */
export function Flower({ category, state }: { category: string; state: FlowerSt }) {
  const name =
    state === "dormant"
      ? "flower-dormant"
      : `flower-${FLOWER_KEY[category] ?? "entertainment"}-${state}`;
  return <Art name={name} h={FLOWER_H[state]} />;
}

/* ---- Taimi: the growing plant, no face ------------------------------------ */
const TAIMI_H = [24, 44, 72, 100];

/** SLOT: taimi/{stage}/{mood} */
export function Taimi({ stage, mood }: { stage: number; mood: Variant }) {
  const s = Math.min(4, Math.max(1, stage));
  const h = TAIMI_H[s - 1];
  const rain =
    mood === "storm" && s >= 3 ? (
      <G stroke="#C9D8E8" strokeWidth={1.6} strokeLinecap="round" opacity={0.8}>
        <Line x1="-24" y1={-h - 8} x2="-27" y2={-h} />
        <Line x1="4" y1={-h - 16} x2="1" y2={-h - 8} />
        <Line x1="24" y1={-h} x2="21" y2={-h + 8} />
      </G>
    ) : null;
  return (
    <G>
      <Art name={`taimi-${s}`} h={h} />
      {rain}
    </G>
  );
}

/* ---- birch (investments) --------------------------------------------------- */
/** SLOT: birch/{grown} */
export function Birch({ berries = false }: { berries?: boolean }) {
  void berries;
  return <Art name="birch-grown" h={160} />;
}

/** SLOT: invest-sapling */
export function InvestSapling() {
  return <Art name="birch-sapling" h={55} />;
}

/* ---- spruce silhouette (unused — forest lives in the background) ----------- */
export function Spruce() {
  return null;
}

/* ---- wooden rail = bills (drawn into the background now) ------------------- */
/** SLOT: rail — no-op, the fence is painted into bg-*.png. */
export function Rail({ variant }: { variant: Variant }) {
  void variant;
  return null;
}

/** SLOT: rail-plate (rent sign hung on the fence, text overlaid) */
export function RailPlate({
  variant,
  rent,
  paid,
  windowText,
}: {
  variant: Variant;
  rent: number;
  paid: boolean;
  windowText: string;
}) {
  return (
    <G>
      <Art name="sign" h={90} />
      {/* sign board occupies the top ~65% of the sprite; all text kept
          small enough to stay inside the board */}
      <SvgText x={0} y={-66} textAnchor="middle" fontSize={10} fontWeight="700" fill="#4A3B28">
        {`Rent ${rent} €`}
      </SvgText>
      <SvgText x={0} y={-53} textAnchor="middle" fontSize={8.6} fontWeight="600" fill="#5E4B34">
        {paid ? "paid" : "due"}
      </SvgText>
      <SvgText x={0} y={-41} textAnchor="middle" fontSize={8.6} fontWeight="600" fill="#5E4B34">
        {windowText}
      </SvgText>
    </G>
  );
}

/* ---- pond = irregular-cost buffer (crossfades in sim) ----------------------- */
const POND_W = 140;
const POND_LV = [
  { name: "pond-empty", max: 0.25 },
  { name: "pond-half", max: 0.66 },
  { name: "pond-full", max: 1 },
];

/** SLOT: pond/{level} — bottom-centre anchored, width normalised so
 * crossfading between fills doesn't jump. */
export function Pond({ level, variant }: { level: number; variant: Variant }) {
  const t = Math.min(1, Math.max(0, level));
  // blend zone: below max of each tier crossfade into the next
  let lo = "pond-empty";
  let hi: string | null = null;
  let mix = 0;
  if (t < POND_LV[0].max) {
    lo = "pond-empty";
    hi = "pond-half";
    mix = t / POND_LV[0].max;
  } else if (t < POND_LV[1].max) {
    lo = "pond-half";
    hi = "pond-full";
    mix = (t - POND_LV[0].max) / (POND_LV[1].max - POND_LV[0].max);
  } else {
    lo = "pond-full";
  }
  const render = (name: string, op: number) => {
    const a = ART[name];
    const h = (a.h / a.w) * POND_W;
    return (
      <SvgImage
        key={name}
        href={a.src}
        x={-POND_W / 2}
        y={-h}
        width={POND_W}
        height={h}
        opacity={op}
        preserveAspectRatio="xMidYMax meet"
      />
    );
  };
  return (
    <G>
      {render(lo, 1)}
      {hi ? render(hi, mix) : null}
    </G>
  );
}

/* ---- weather objects in the sky — now painted into bg-*.png ----------------- */
/** SLOT: weather/{kind} — no-op on scene; Rain() stays as overlay. */
export function Weather({ kind }: { kind: Variant }) {
  void kind;
  return null;
}

/* ---- backdrop: painted gouache scene ---------------------------------------- */
/** SLOT: backdrop/{variant} — rendered as a plain RN <Image> behind the Svg:
 * react-native-svg's <Image> element fails to composite the very tall
 * 1080×1935 PNG under the tight sim viewBox on iOS (renders a pale wash
 * over part of the scene). The rect math is identical: image row ~1300
 * (fence post bases, fraction 0.672) lands at scene y≈554. */
export function backdropRect(v: { x: number; y: number; w: number; h: number }) {
  const FRACTION_POST_BASE = 0.672;
  const ASPECT = 1080 / 1935;
  const h = Math.max((v.y + v.h - 554) / (1 - FRACTION_POST_BASE), v.w / ASPECT);
  const w = h * ASPECT;
  return { x: v.x + (v.w - w) / 2, y: 554 - FRACTION_POST_BASE * h, w, h };
}

export function Backdrop({
  variant,
  vb,
  ox = 0,
  oy = 0,
  scale = 1,
}: {
  variant: Variant;
  vb?: { x: number; y: number; w: number; h: number };
  ox?: number;
  oy?: number;
  scale?: number;
}) {
  const v = vb ?? { x: 0, y: 60, w: 390, h: 844 };
  const r = backdropRect(v);
  return (
    <RNImage
      source={ART[`bg-${variant}`].src}
      style={{
        position: "absolute",
        left: ox + (r.x - v.x) * scale,
        top: oy + (r.y - v.y) * scale,
        width: r.w * scale,
        height: r.h * scale,
      }}
      resizeMode="stretch"
    />
  );
}

/* ---- rain overlay ------------------------------------------------------------ */
/** SLOT: rain */
export function Rain() {
  return (
    <G stroke="#9DB4CC" strokeWidth={1.6} opacity={0.5}>
      {Array.from({ length: 15 }, (_, k) => (
        <Line
          key={k}
          x1={(k * 71) % 400}
          y1={(k * 53) % 400}
          x2={((k * 71) % 400) - 8}
          y2={((k * 53) % 400) + 16}
        />
      ))}
    </G>
  );
}

/* ---- soft ground shadow under sprites --------------------------------------- */
export function Shadow({ rx, opacity = 0.55, variant = "sun" }: { rx: number; opacity?: number; variant?: Variant }) {
  return <Ellipse cx="0" cy="0" rx={rx} ry={rx * 0.14} fill={pal("shade", variant)} opacity={opacity} />;
}

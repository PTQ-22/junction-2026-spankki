/**
 * Asset slot map — every scene element goes through this file so real PNGs
 * can replace the SVG placeholders later in one place.
 *
 * Geometry is a direct port of prototype/taimi/index.html (390-wide space).
 */
import React from "react";
import { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

export type Variant = "sun" | "cloud" | "storm";
export type FlowerSt = "dormant" | "wilting" | "ok" | "blooming";

/* ---- palette: flat Nordic tones per weather variant ---------------------- */
const NS = {
  sky: { sun: "#DCEBF0", cloud: "#C6D4DA", storm: "#35465E" },
  far: { sun: "#8FA995", cloud: "#8AA0A0", storm: "#2E4159" },
  mid: { sun: "#9FB89F", cloud: "#97AC9F", storm: "#384C63" },
  lake: { sun: "#8FB4C6", cloud: "#7FA3B4", storm: "#4A6076" },
  meadow: { sun: "#CBD9B5", cloud: "#BCC9AC", storm: "#5E7050" },
  meadow2: { sun: "#B9CCA0", cloud: "#AEBF9A", storm: "#54644A" },
  shade: { sun: "#A4BA8B", cloud: "#9BAE84", storm: "#49593E" },
  spruceA: { sun: "#6E8A78", cloud: "#718A88", storm: "#26374E" },
  spruceB: { sun: "#7E9A86", cloud: "#7E9690", storm: "#2C4059" },
  wood: { sun: "#A98F6E", cloud: "#9C8A6E", storm: "#5E5240" },
  wood2: { sun: "#8A7156", cloud: "#7E7057", storm: "#4E4436" },
  birch: { sun: "#F0EDE4", cloud: "#E4E4DA", storm: "#9AA0A4" },
} as const;
export const pal = (k: keyof typeof NS, v: Variant) => NS[k][v];

const FCOL = { tulip: "#C4806B", sunflower: "#CEA65F", daisy: "#EDEAE0", lavender: "#9E97C2", bell: "#93B4CC" };
const SHAPES: Record<string, keyof typeof FCOL> = {
  Restaurants: "tulip", Entertainment: "sunflower", Lifestyle: "daisy", Travel: "lavender", Taxi: "bell",
};
const LEAF = "#6E9272";
const STEM = "#5E8562";
const WILT = "#B0A68C";
const OKC = "#AEA58B";

/* ---- flower heads --------------------------------------------------------- */
function HeadN({ shape, fill }: { shape: keyof typeof FCOL; fill: string }) {
  switch (shape) {
    case "tulip":
      return (
        <Path
          d="M-8 -6 C-8 4 -4 9 0 9 C4 9 8 4 8 -6 L5.5 -2.5 L2.8 -6.5 L0 -2.5 L-2.8 -6.5 L-5.5 -2.5 Z"
          fill={fill}
        />
      );
    case "sunflower":
      return (
        <G>
          {Array.from({ length: 10 }, (_, k) => (
            <Ellipse key={k} cx="0" cy="-9.5" rx="2.4" ry="6" fill={fill} rotation={k * 36} />
          ))}
          <Circle r="5.5" fill="#8A6B4A" />
        </G>
      );
    case "daisy":
      return (
        <G>
          {Array.from({ length: 8 }, (_, k) => (
            <Ellipse key={k} cx="0" cy="-8.5" rx="2.2" ry="6" fill={fill} rotation={k * 45} />
          ))}
          <Circle r="3.4" fill="#CEA65F" />
        </G>
      );
    case "lavender":
      return (
        <G fill={fill}>
          <Ellipse cx="0" cy="0" rx="3.4" ry="5" />
          <Ellipse cx="-3" cy="-8" rx="3" ry="4.5" />
          <Ellipse cx="3" cy="-15" rx="3" ry="4.5" />
          <Ellipse cx="-2" cy="-21" rx="2.6" ry="4" />
          <Ellipse cx="1" cy="-26" rx="2.2" ry="3.6" />
        </G>
      );
    case "bell":
      return <Path d="M-7 3 C-8.5 -5 -4.5 -11 0 -11 C4.5 -11 8.5 -5 7 3 L3.5 .8 L0 4 L-3.5 .8 Z" fill={fill} />;
  }
}

/** SLOT: flower/{category}/{state} */
export function Flower({ category, state }: { category: string; state: FlowerSt }) {
  if (state === "dormant")
    return (
      <G>
        <Ellipse cx="0" cy="0" rx="8" ry="3" fill={WILT} opacity={0.55} />
        <Path d="M0 -1 q1 -7 6 -8" stroke={STEM} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <Circle cx="6.5" cy="-9" r="2.2" fill={LEAF} />
      </G>
    );
  const shape = SHAPES[category] ?? "daisy";
  const f = state === "wilting" ? WILT : state === "ok" ? OKC : FCOL[shape];
  if (state === "wilting")
    return (
      <G>
        <Path d="M0 0 C1 -10 7 -17 14 -22" stroke={STEM} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <Ellipse cx="-4" cy="-9" rx="4" ry="1.9" fill={LEAF} transform="rotate(22 -4 -9)" />
        <G x={16} y={-22} transform="rotate(112) scale(0.85)">
          <HeadN shape={shape} fill={f} />
        </G>
      </G>
    );
  const isBell = shape === "bell";
  return (
    <G>
      {isBell ? (
        <Path d="M0 0 C0 -14 3 -27 10 -38" stroke={STEM} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M0 0 C0 -16 1 -30 0 -44" stroke={STEM} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      )}
      <Ellipse cx="-4" cy="-19" rx="4" ry="1.9" fill={LEAF} transform="rotate(-26 -4 -19)" />
      <Ellipse cx="4" cy="-27" rx="4" ry="1.9" fill={LEAF} transform="rotate(26 4 -27)" />
      {isBell ? (
        <G x={12} y={-38}>
          <HeadN shape={shape} fill={f} />
        </G>
      ) : (
        <G y={-49} scale={0.85}>
          <HeadN shape={shape} fill={f} />
        </G>
      )}
    </G>
  );
}

/* ---- Taimi: the growing plant, no face ------------------------------------ */
const TD = "#4E7A54";
const TM = "#6FA06A";
const TL = "#A9C69C";
const TWOOD = "#8A7156";

function TLeaf({ rot, len, mir = 1, droop }: { rot: number; len: number; mir?: number; droop: number }) {
  return (
    <G transform={`rotate(${rot + droop * mir}) scale(${mir} 1)`}>
      <Path
        d={`M0 0 Q${len * 0.42} ${-len * 0.12} ${len} ${-len * 0.52} Q${len * 0.5} ${-len * 0.8} 0 ${-len * 0.28} Z`}
        fill={TM}
      />
      <Path
        d={`M1 -3 Q${len * 0.36} ${-len * 0.14} ${len * 0.8} ${-len * 0.48} Q${len * 0.42} ${-len * 0.64} 1 ${-len * 0.22} Z`}
        fill={TL}
        opacity={0.75}
      />
    </G>
  );
}

/** SLOT: taimi/{stage}/{mood} */
export function Taimi({ stage, mood }: { stage: number; mood: Variant }) {
  const droop = mood === "storm" ? 30 : mood === "cloud" ? 14 : 0;
  const tilt = mood === "cloud" ? 4 : 0;
  const rain =
    mood === "storm" && stage >= 3 ? (
      <G stroke="#C9D8E8" strokeWidth={1.6} strokeLinecap="round" opacity={0.8}>
        <Line x1="-24" y1="-128" x2="-27" y2="-120" />
        <Line x1="4" y1="-136" x2="1" y2="-128" />
        <Line x1="24" y1="-120" x2="21" y2="-112" />
      </G>
    ) : null;
  return (
    <G>
      <Ellipse cx="0" cy="0" rx="24" ry="6.5" fill="#7A5F43" />
      <Ellipse cx="0" cy="-2" rx="18" ry="4.5" fill="#8F7452" />
      {stage === 1 && (
        <G>
          <Ellipse cx="6" cy="-5" rx="10" ry="6.5" fill="#C9B896" transform="rotate(-18 6 -5)" />
          <Path d="M-2 -3 C-3 -12 -10 -18 -18 -16" stroke={STEM} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <G x={-18} y={-17}>
            <TLeaf rot={-28} len={15} mir={-1} droop={droop} />
          </G>
          <G x={3} y={-8}>
            <TLeaf rot={-12} len={13} droop={droop} />
          </G>
        </G>
      )}
      {stage === 2 && (
        <G>
          <Path d="M0 -2 C1 -18 -1 -32 0 -44" stroke={STEM} strokeWidth={3} fill="none" strokeLinecap="round" />
          <G y={-44}>
            <TLeaf rot={-58} len={26} droop={droop} />
            <TLeaf rot={58} len={26} mir={-1} droop={droop} />
            <TLeaf rot={-12} len={20} droop={droop} />
            <TLeaf rot={24} len={18} mir={-1} droop={droop} />
          </G>
        </G>
      )}
      {stage === 3 && (
        <G>
          <Path
            d="M-2.6 0 C-2.4 -6 -2 -12 -1.7 -20 L-1 -50 C-1 -53 -.5 -55 0 -55 C.5 -55 1 -53 1 -50 L1.7 -20 C2 -12 2.4 -6 2.6 0 Q0 2 -2.6 0 Z"
            fill={TWOOD}
          />
          <G y={-52} transform={`rotate(${tilt} 0 -52)`}>
            <Circle cx="-9" cy="-11" r="14" fill={TD} />
            <Circle cx="0" cy="-17" r="15" fill={TM} />
            <Circle cx="11" cy="-10" r="11" fill={TM} />
            <Circle cx="-8" cy="-25" r="7.5" fill={TL} />
          </G>
          {rain}
        </G>
      )}
      {stage >= 4 && (
        <G>
          <Path
            d="M-5 0 C-4.4 -6 -3.2 -12 -2.6 -22 L-1.6 -74 C-1.6 -77 -.8 -79 0 -79 C.8 -79 1.6 -77 1.6 -74 L2.6 -22 C3.2 -12 4.4 -6 5 0 Q0 3.4 -5 0 Z"
            fill={TWOOD}
          />
          <G y={-84} transform={`rotate(${tilt} 0 -84)`}>
            <Circle cx="-20" cy="-6" r="19" fill={TD} />
            <Circle cx="16" cy="-4" r="21" fill={TD} />
            <Circle cx="30" cy="-18" r="14" fill={TD} />
            <Circle cx="-8" cy="-22" r="23" fill={TM} />
            <Circle cx="18" cy="-26" r="17" fill={TM} />
            <Circle cx="-28" cy="-18" r="14" fill={TM} />
            <Circle cx="-16" cy="-36" r="9.5" fill={TL} />
            <Circle cx="0" cy="-40" r="7.5" fill={TL} />
            <Circle cx="12" cy="-36" r="6.5" fill={TL} />
          </G>
          {rain}
        </G>
      )}
    </G>
  );
}

/* ---- birch (investments) --------------------------------------------------- */
/** SLOT: birch/{grown} */
export function Birch({ berries = false }: { berries?: boolean }) {
  return (
    <G>
      <Rect x={-2.5} y={-64} width={5} height={64} rx={2.5} fill="#F0EDE4" />
      <Rect x={-2.5} y={-56} width={5} height={2} fill="#4A4A42" />
      <Rect x={-2.5} y={-40} width={4} height={1.6} fill="#4A4A42" />
      <Rect x={-2.5} y={-22} width={5} height={2} fill="#4A4A42" />
      <Ellipse cx="0" cy="-78" rx="20" ry="16" fill={LEAF} />
      <Ellipse cx="-14" cy="-66" rx="12" ry="10" fill={LEAF} />
      <Ellipse cx="14" cy="-66" rx="12" ry="10" fill={LEAF} />
      {berries && (
        <G fill="#C4685A">
          <Circle cx="-10" cy="-74" r="2.4" />
          <Circle cx="8" cy="-70" r="2.4" />
          <Circle cx="2" cy="-62" r="2.2" />
        </G>
      )}
    </G>
  );
}

/** SLOT: invest-sapling */
export function InvestSapling() {
  return (
    <G>
      <Ellipse cx="0" cy="0" rx="9" ry="3" fill={WILT} opacity={0.5} />
      <Path d="M0 0 C0 -8 1 -12 0 -16" stroke={STEM} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Ellipse cx="-4" cy="-10" rx="4" ry="1.9" fill={LEAF} transform="rotate(-28 -4 -10)" />
      <Ellipse cx="4" cy="-14" rx="4" ry="1.9" fill={LEAF} transform="rotate(28 4 -14)" />
    </G>
  );
}

/* ---- spruce silhouette ----------------------------------------------------- */
export function Spruce({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  const d = `M${x} ${y - h} L${x - h * 0.17} ${y - h * 0.6} L${x - h * 0.1} ${y - h * 0.6} L${x - h * 0.3} ${y - h * 0.34} L${x - h * 0.19} ${y - h * 0.34} L${x - h * 0.44} ${y} L${x + h * 0.44} ${y} L${x + h * 0.19} ${y - h * 0.34} L${x + h * 0.3} ${y - h * 0.34} L${x + h * 0.1} ${y - h * 0.6} L${x + h * 0.17} ${y - h * 0.6} Z`;
  return <Path d={d} fill={fill} />;
}

/* ---- wooden rail = bills ---------------------------------------------------- */
/** SLOT: rail */
export function Rail({ variant }: { variant: Variant }) {
  const wood = pal("wood", variant);
  const wood2 = pal("wood2", variant);
  const posts = [-150, -90, -30, 30, 90, 150, 210, 270, 330, 390, 450, 510, 570];
  return (
    <G>
      {posts.map((x) => (
        <Rect key={x} x={x - 3} y={452} width={6} height={42} rx={3} fill={wood2} />
      ))}
      <Rect x={-200} y={458} width={790} height={8} rx={4} fill={wood} />
      <Rect x={-200} y={476} width={790} height={8} rx={4} fill={wood} />
    </G>
  );
}

/** SLOT: rail-plate (engraved rent sign) */
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
  const wood2 = pal("wood2", variant);
  return (
    <G x={50} y={424}>
      <Rect x={-3} y={30} width={6} height={30} fill={wood2} />
      <Rect x={-38} y={-6} width={76} height={46} rx={6} fill={wood2} />
      <SvgText x={0} y={8} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#F0E9DA">
        {`Rent ${rent} €`}
      </SvgText>
      <SvgText x={0} y={20} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#D9CDB4">
        {paid ? "paid" : "due"}
      </SvgText>
      <SvgText x={0} y={32} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#D9CDB4">
        {windowText}
      </SvgText>
    </G>
  );
}

/* ---- pond = irregular-cost buffer ------------------------------------------- */
/** SLOT: pond/{level} */
export function Pond({ level, variant }: { level: number; variant: Variant }) {
  const w = Math.min(1, Math.sqrt(Math.max(level, 0.16)));
  return (
    <G x={88} y={648}>
      <Ellipse rx="54" ry="18" fill={variant === "storm" ? "#4E5E44" : "#B9A98C"} />
      {level > 0 ? (
        <G>
          <Ellipse cy="1" rx={46 * w} ry={13.5 * w} fill={pal("lake", variant)} />
          <Ellipse cx="-14" cy="-3" rx="12" ry="3" fill="#FFFFFF" opacity={0.4} />
        </G>
      ) : (
        <Path d="M-18 0 l11 6 l9 -7 M7 4 l10 6" stroke="#8A7A58" strokeWidth={2} fill="none" opacity={0.55} />
      )}
    </G>
  );
}

/* ---- weather objects in the sky --------------------------------------------- */
/** SLOT: weather/{kind} — sun+cloud+birds | clouds | storm moon+stars */
export function Weather({ kind }: { kind: Variant }) {
  if (kind === "storm")
    return (
      <G>
        {[14, 60, 104, 150, 196, 240, 288, 330, 372, 40, 120, 210, 300, 356].map((cx, k) => (
          <Circle key={k} cx={cx} cy={14 + ((k * 37) % 180)} r={k % 3 ? 1.1 : 1.6} fill="#E8EEF8" opacity={0.3 + (k % 4) * 0.14} />
        ))}
        <Circle cx="330" cy="74" r="21" fill="#C9D2D4" />
        <Circle cx="320" cy="67" r="17" fill={pal("sky", "storm")} />
      </G>
    );
  if (kind === "sun")
    return (
      <G>
        <Circle cx="66" cy="86" r="26" fill="#F0CF7A" />
        <G stroke="#F0CF7A" strokeWidth={3} strokeLinecap="round">
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k * Math.PI) / 4;
            return (
              <Line
                key={k}
                x1={66 + 34 * Math.cos(a)}
                y1={86 + 34 * Math.sin(a)}
                x2={66 + 44 * Math.cos(a)}
                y2={86 + 44 * Math.sin(a)}
              />
            );
          })}
        </G>
        <G fill="#F2F6F4" opacity={0.9} x={286} y={128}>
          <Ellipse rx="30" ry="12" />
          <Ellipse cx="20" cy="-7" rx="20" ry="10" />
        </G>
        <G stroke="#8AA4AC" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.55}>
          <Path d="M240 62 q3.5 -4 7 0 q3.5 -4 7 0" />
          <Path d="M300 90 q3 -3.5 6 0 q3 -3.5 6 0" />
          <Path d="M212 108 q2.6 -3 5.2 0 q2.6 -3 5.2 0" />
        </G>
      </G>
    );
  return (
    <G>
      <G fill="#EDF2F2" opacity={0.92}>
        <G x={80} y={86}>
          <Ellipse rx="30" ry="13" />
          <Ellipse cx="20" cy="-8" rx="21" ry="11" />
          <Ellipse cx="42" rx="22" ry="9" />
        </G>
        <G x={292} y={142}>
          <Ellipse rx="34" ry="13" />
          <Ellipse cx="22" cy="-8" rx="22" ry="11" />
          <Ellipse cx="-24" cy="2" rx="19" ry="8" />
        </G>
      </G>
      <G stroke="#7C96A0" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5}>
        <Path d="M180 66 q3.5 -4 7 0 q3.5 -4 7 0" />
        <Path d="M222 96 q3 -3.5 6 0 q3 -3.5 6 0" />
      </G>
    </G>
  );
}

/* ---- backdrop: sky + forest + lake + meadows --------------------------------- */
/** SLOT: backdrop/{variant} */
export function Backdrop({ variant }: { variant: Variant }) {
  const far = [-160, -80, 0, 80, 160, 240, 320, 400, 480, 560];
  const near = [-200, -120, -40, 40, 120, 200, 280, 360, 440, 520, 590];
  return (
    <G>
      <Rect x={-200} y={0} width={790} height={844} fill={pal("sky", variant)} />
      <Path d="M-200 392 L590 392 L590 844 L-200 844 Z" fill={pal("meadow", variant)} />
      {far.map((x, k) => (
        <Spruce key={`f${x}`} x={x} y={392} h={64 + (k % 3) * 12} fill={pal("spruceA", variant)} />
      ))}
      <Rect x={-200} y={392} width={790} height={14} fill={pal("lake", variant)} />
      {near.map((x, k) => (
        <Spruce key={`n${x}`} x={x} y={404} h={46 + ((k + 1) % 3) * 10} fill={pal("spruceB", variant)} />
      ))}
      <Path d="M-200 660 Q-40 630 120 638 Q300 654 590 628 L590 844 L-200 844 Z" fill={pal("meadow2", variant)} />
    </G>
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

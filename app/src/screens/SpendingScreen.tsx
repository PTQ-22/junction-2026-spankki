/**
 * Spending — "Where your money went": the four baskets + the five flowers.
 * Each basket caption ties back to the garden on Home.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Image as SvgImage } from "react-native-svg";

import { Benchmarks, fetchBenchmarks } from "../api";
import { BankBar } from "../components/BankChrome";
import { FlowerSheet } from "../components/FlowerSheet";
import { ART_SRC, Flower } from "../garden/assets";
import { OfflineCard, useGarden } from "../offline";
import { useDemo } from "../state";
import { C, FONT, R, SHADOW } from "../theme";

const NBSP = " ";

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;
const WORD: Record<string, string> = {
  blooming: "blooming", ok: "steady", wilting: "needs some water", dormant: "resting",
};
const DOT: Record<string, string> = {
  blooming: "#6E9272", ok: "#AEA58B", wilting: C.terra, dormant: "#C9CFC9",
};

/** Small painted icon for a basket row — crops from the garden art. */
function BasketIcon({ kind }: { kind: string }) {
  const inner =
    kind === "B1a" ? (
      // fence crop from bg-sun (same crop as the legend)
      <Svg viewBox="0 0 40 40" style={styles.icon}>
        <SvgImage href={ART_SRC("bg-sun")} x={-8} y={-43} width={56} height={100.3} preserveAspectRatio="xMidYMid slice" />
      </Svg>
    ) : kind === "B2" ? (
      <Svg viewBox="-52 -50 104 52" style={styles.icon}>
        <SvgImage
          href={ART_SRC("pond-full")}
          x={-50}
          y={-49.8}
          width={100}
          height={49.8}
          preserveAspectRatio="xMidYMax meet"
        />
      </Svg>
    ) : kind === "B3" ? (
      <Svg viewBox="-14 -56 28 59" style={styles.icon}>
        <Flower category="Restaurants" state="blooming" />
      </Svg>
    ) : (
      // everyday essentials: no art — a quiet sage dot
      <View style={[styles.icon, styles.iconDotWrap]}>
        <View style={styles.iconDot} />
      </View>
    );
  return inner;
}

const BASKETS: { k: "B1a" | "B1b" | "B2" | "B3"; name: string; note: string; garden: string; color: string }[] = [
  { k: "B1a", name: "Bills", note: "rent, utilities — predictable", garden: "In your garden: the fence", color: C.lake },
  { k: "B1b", name: "Everyday essentials", note: "groceries, transport — a range", garden: "In your garden: part of the weather", color: C.sage },
  { k: "B2", name: "Irregular musts", note: "health, repairs — the pond covers these", garden: "In your garden: the pond", color: C.wood },
  { k: "B3", name: "Fun spending", note: "the spending that escapes — your flowers", garden: "In your garden: the flowers", color: C.terra },
];

export function SpendingScreen() {
  const { persona, today } = useDemo();
  const { g, offline, retry } = useGarden();
  const [bm, setBm] = useState<Benchmarks | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchBenchmarks(persona, today).then((d) => live && setBm(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, [persona, today]);

  const benchOf = (flower: string) =>
    bm && bm.peers_count >= 30 ? bm.flowers.find((f) => f.flower === flower) : undefined;

  const fl = g?.flowers.find((f) => f.flower === sheet) ?? null;
  const total30 = g ? Object.values(g.baskets_last30).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={styles.root}>
      <BankBar />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h}>Where your money went</Text>
        <Text style={styles.sub}>{`Last 30 days · ${g ? euro(total30) : offline ? "—" : "…"}`}</Text>

        {offline ? (
          <OfflineCard onRetry={retry} />
        ) : (
          <>
        {g && (
          <View style={styles.stack}>
            {BASKETS.map((b, i) => {
              const v = g.baskets_last30[b.k];
              const w = total30 > 0 ? (v / total30) * 100 : 0;
              if (w <= 0) return null;
              return (
                <View
                  key={b.k}
                  style={[
                    { width: `${w}%`, backgroundColor: b.color },
                    i === 0 && { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
                    i === BASKETS.length - 1 && { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
                  ]}
                />
              );
            })}
          </View>
        )}

        {BASKETS.map((b) => (
          <View key={b.k} style={styles.brow}>
            <BasketIcon kind={b.k} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bname}>{b.name}</Text>
              <Text style={styles.bnote}>{b.note}</Text>
              <Text style={styles.bgarden}>{b.garden}</Text>
            </View>
            <Text style={styles.bval}>{g ? euro(g.baskets_last30[b.k]) : "…"}</Text>
          </View>
        ))}

        <Text style={styles.secH}>Fun spending vs your usual</Text>
        {g?.flowers.map((f) => {
          const st = f.norm === 0 && f.last30 === 0 ? "dormant" : f.state;
          const rel = f.norm > 0 ? Math.min(f.last30 / (f.norm * 1.5), 1) : f.last30 > 0 ? 1 : 0;
          const mark = f.norm > 0 ? Math.min(f.norm / (f.norm * 1.5), 1) : 0;
          return (
            <Pressable key={f.flower} style={styles.frow} onPress={() => setSheet(f.flower)}>
              <Svg viewBox="-20 -54 40 57" style={styles.fthumb}>
                <Flower category={f.flower} state={st} />
              </Svg>
              <View style={{ flex: 1 }}>
                <View style={styles.fline1}>
                  <Text style={styles.fname}>{f.flower}</Text>
                  <Text style={styles.fval}>{euro(f.last30)}</Text>
                </View>
                <View style={styles.ftrk}>
                  <View style={[styles.ftrkFill, { width: `${rel * 100}%`, backgroundColor: DOT[st] }]} />
                  {f.norm > 0 && <View style={[styles.fmark, { left: `${mark * 100}%` }]} />}
                </View>
                <Text style={styles.fnote}>
                  {`usual ${euro(f.norm)}/month · ${f.hours} h · ${WORD[st]}`}
                </Text>
                {benchOf(f.flower) != null && bm && (
                  <Text style={styles.fpeer}>
                    {`your age peers: ${euro(benchOf(f.flower)!.peers)}/mo`}
                    {benchOf(f.flower)!.hbs != null ? ` · Finns ${bm.hbs.group}: ${euro(benchOf(f.flower)!.hbs!)}/mo` : ""}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
        {!g && <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />}
          </>
        )}
      </ScrollView>
      <FlowerSheet flower={fl} customerId={persona} today={today} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 20, paddingTop: 18, paddingBottom: 40 },
  h: { fontFamily: FONT.display, fontSize: 24, color: C.ink },
  sub: { fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 4, marginBottom: 14 },
  stack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 14 },
  secH: { fontFamily: FONT.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: C.sub, marginTop: 18, marginBottom: 8 },
  brow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.card, borderRadius: R.card, padding: 13, marginBottom: 8,
    ...SHADOW,
  },
  icon: { width: 36, height: 36 },
  iconDotWrap: { alignItems: "center", justifyContent: "center" },
  iconDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.sage },
  bname: { fontFamily: FONT.bold, fontSize: 14, color: C.ink },
  bnote: { fontFamily: FONT.body, fontSize: 11.5, color: C.sub, marginTop: 1 },
  bgarden: { fontFamily: FONT.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
  bval: { fontFamily: FONT.bold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] },
  frow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.card, borderRadius: R.card, padding: 13, marginBottom: 8,
    ...SHADOW,
  },
  fthumb: { width: 34, height: 40 },
  fline1: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  fname: { fontFamily: FONT.bold, fontSize: 14, color: C.ink },
  fval: { fontFamily: FONT.bold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] },
  ftrk: { height: 5, borderRadius: 3, backgroundColor: "#EDE8DA", marginTop: 7, overflow: "visible" },
  ftrkFill: { height: 5, borderRadius: 3 },
  fmark: { position: "absolute", top: -2, width: 2, height: 9, backgroundColor: C.ink, opacity: 0.5, borderRadius: 1 },
  fnote: { fontFamily: FONT.body, fontSize: 11.5, color: C.sub, marginTop: 5 },
  fpeer: { fontFamily: FONT.body, fontSize: 10.5, color: C.faint, marginTop: 3 },
});

/**
 * Spending — "Where your money went": the four baskets + the five flowers.
 * Each basket caption ties back to the garden on Home.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchGarden, GardenState } from "../api";
import { FlowerSheet } from "../components/FlowerSheet";
import { useDemo } from "../state";

const GREEN = "#007841";
const INK = "#1F2A24";
const SUB = "#5C6B62";
const FAINT = "#8A968C";
const LINE = "#DDE4DD";
const NBSP = " ";

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;
const WORD: Record<string, string> = {
  blooming: "blooming", ok: "steady", wilting: "needs some water", dormant: "resting",
};
const DOT: Record<string, string> = {
  blooming: "#6E9272", ok: "#AEA58B", wilting: "#C4806B", dormant: "#C9CFC9",
};
const BASKETS: { k: "B1a" | "B1b" | "B2" | "B3"; name: string; note: string; garden: string; color: string }[] = [
  { k: "B1a", name: "Bills", note: "rent, utilities — predictable", garden: "In your garden: the fence", color: "#7FA3B8" },
  { k: "B1b", name: "Everyday essentials", note: "groceries, transport — a range", garden: "In your garden: part of the weather", color: "#9BAE84" },
  { k: "B2", name: "Irregular musts", note: "health, repairs — the pond covers these", garden: "In your garden: the pond", color: "#C4A97E" },
  { k: "B3", name: "Fun spending", note: "the spending that escapes — your flowers", garden: "In your garden: the flowers", color: "#C4806B" },
];

export function SpendingScreen() {
  const { persona, today, saveFirstPct } = useDemo();
  const [g, setG] = useState<GardenState | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchGarden(persona, today, saveFirstPct).then((d) => live && setG(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, [persona, today, saveFirstPct]);

  const fl = g?.flowers.find((f) => f.flower === sheet) ?? null;
  const total30 = g ? Object.values(g.baskets_last30).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h}>Where your money went</Text>
        <Text style={styles.sub}>{`Last 30 days · ${g ? euro(total30) : "…"}`}</Text>

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
            <View style={[styles.bdot, { backgroundColor: b.color }]} />
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
              <View style={[styles.fdot, { backgroundColor: DOT[st] }]} />
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
              </View>
            </Pressable>
          );
        })}
        {!g && <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />}
      </ScrollView>
      <FlowerSheet flower={fl} customerId={persona} today={today} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6F2" },
  pad: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  h: { fontFamily: "Figtree_700Bold", fontSize: 24, color: INK },
  sub: { fontFamily: "Figtree_500Medium", fontSize: 13, color: SUB, marginTop: 4, marginBottom: 14 },
  stack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 14 },
  secH: { fontFamily: "Figtree_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: SUB, marginTop: 18, marginBottom: 8 },
  brow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE, padding: 13, marginBottom: 8,
  },
  bdot: { width: 9, height: 9, borderRadius: 5 },
  bname: { fontFamily: "Figtree_700Bold", fontSize: 14, color: INK },
  bnote: { fontFamily: "Figtree_500Medium", fontSize: 11.5, color: SUB, marginTop: 1 },
  bgarden: { fontFamily: "Figtree_500Medium", fontSize: 10.5, color: FAINT, marginTop: 2 },
  bval: { fontFamily: "Figtree_700Bold", fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },
  frow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE, padding: 13, marginBottom: 8,
  },
  fdot: { width: 10, height: 10, borderRadius: 5 },
  fline1: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  fname: { fontFamily: "Figtree_700Bold", fontSize: 14, color: INK },
  fval: { fontFamily: "Figtree_700Bold", fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },
  ftrk: { height: 5, borderRadius: 3, backgroundColor: "#EEF1EA", marginTop: 7, overflow: "visible" },
  ftrkFill: { height: 5, borderRadius: 3 },
  fmark: { position: "absolute", top: -2, width: 2, height: 9, backgroundColor: INK, opacity: 0.5, borderRadius: 1 },
  fnote: { fontFamily: "Figtree_500Medium", fontSize: 11.5, color: SUB, marginTop: 5 },
});

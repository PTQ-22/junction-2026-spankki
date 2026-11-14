/**
 * FlowerSheet — bottom sheet for one flower (prototype screen 2):
 * title, state pill, last30 vs usual bars, work hours, receipts, SQL disclosure.
 */
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchTransactions, FlowerState, TxResult } from "../api";

const GREEN = "#007841";
const INK = "#1F2A24";
const SUB = "#5C6B62";
const LINE = "#DDE4DD";
const NBSP = " ";

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;
const euro2 = (n: number) => `${n.toFixed(2).replace(".", ",")}${NBSP}€`;

const WORD: Record<string, string> = {
  blooming: "blooming",
  ok: "steady",
  wilting: "needs some water",
  dormant: "resting",
};

export function FlowerSheet({
  flower,
  customerId,
  today,
  onClose,
  onSimulate,
}: {
  flower: FlowerState | null;
  customerId: string;
  today: string;
  onClose: () => void;
  onSimulate?: (name: string) => void;
}) {
  const [tx, setTx] = useState<TxResult | null>(null);
  const [sqlOpen, setSqlOpen] = useState(false);
  const name = flower?.flower;

  useEffect(() => {
    setTx(null);
    setSqlOpen(false);
    if (name) fetchTransactions(customerId, name, today).then(setTx).catch(() => {});
  }, [name, customerId, today]);

  if (!flower) return null;
  const st = flower.norm === 0 && flower.last30 === 0 ? "dormant" : flower.state;
  const pct = flower.norm > 0 ? Math.min(100, Math.round((100 * flower.last30) / flower.norm)) : flower.last30 ? 100 : 4;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{flower.flower}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>{WORD[st]}</Text>
            </View>
          </View>
          <View style={styles.bigRow}>
            <Text style={styles.big}>{euro(flower.last30)}</Text>
            <Text style={styles.vs}>last 30 days · usual {euro(flower.norm)}/mo</Text>
          </View>
          <View style={styles.cmpRow}>
            <Text style={styles.cmpLbl}>last 30 d</Text>
            <View style={styles.trk}>
              <View style={[styles.trkFill, { width: `${pct}%`, backgroundColor: "#A98F6E" }]} />
            </View>
            <Text style={styles.cmpVal}>{euro(flower.last30)}</Text>
          </View>
          <View style={styles.cmpRow}>
            <Text style={styles.cmpLbl}>your usual</Text>
            <View style={styles.trk}>
              <View style={[styles.trkFill, { width: flower.norm ? "100%" : "4%", backgroundColor: "#6E9272" }]} />
            </View>
            <Text style={styles.cmpVal}>{euro(flower.norm)}</Text>
          </View>
          <Text style={styles.eq}>= {flower.hours} h of your work</Text>

          <Text style={styles.secH}>{`Receipts · ${tx?.count ?? 0} transactions`}</Text>
          {(tx?.rows ?? []).map((t, i) => (
            <View key={i} style={styles.txRow}>
              <Text style={styles.txD}>{t.d}</Text>
              <Text style={styles.txM}>{t.label}</Text>
              <Text style={styles.txE}>{euro2(t.eur)}</Text>
            </View>
          ))}
          {tx && tx.count === 0 && <Text style={styles.dim}>No transactions in the last 30 days.</Text>}

          <Pressable onPress={() => setSqlOpen((v) => !v)} style={styles.discRow}>
            <Text style={styles.discTxt}>How I calculated this {sqlOpen ? "▴" : "▾"}</Text>
          </Pressable>
          {sqlOpen && tx && <Text style={styles.sql}>{tx.sql}</Text>}
          {onSimulate && flower.norm > 0 && (
            <Pressable style={styles.simBtn} onPress={() => onSimulate(flower.flower)}>
              <Text style={styles.simBtnTxt}>Try a what-if — see it in your garden</Text>
            </Pressable>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1 },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "62%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D8DDD8", alignSelf: "center", marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: "Figtree_700Bold", fontSize: 20, color: INK },
  pill: { backgroundColor: "#E4EBDF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 11, color: "#4A5B45" },
  bigRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
  big: { fontFamily: "Figtree_700Bold", fontSize: 32, color: INK, fontVariant: ["tabular-nums"] },
  vs: { fontFamily: "Figtree_500Medium", fontSize: 12, color: SUB },
  cmpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  cmpLbl: { fontFamily: "Figtree_600SemiBold", fontSize: 11, color: SUB, width: 64 },
  trk: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#EEF1EA", overflow: "hidden" },
  trkFill: { height: 8, borderRadius: 4 },
  cmpVal: { fontFamily: "Figtree_700Bold", fontSize: 11, color: INK, width: 56, textAlign: "right", fontVariant: ["tabular-nums"] },
  eq: { fontFamily: "Figtree_600SemiBold", fontSize: 12.5, color: SUB, marginTop: 10 },
  secH: { fontFamily: "Figtree_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: SUB, marginTop: 18, marginBottom: 6 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  txD: { fontFamily: "Figtree_500Medium", fontSize: 12.5, color: SUB, width: 96 },
  txM: { fontFamily: "Figtree_500Medium", fontSize: 12.5, color: INK, flex: 1 },
  txE: { fontFamily: "Figtree_700Bold", fontSize: 12.5, color: INK, fontVariant: ["tabular-nums"] },
  dim: { fontFamily: "Figtree_500Medium", fontSize: 12, color: SUB, marginTop: 4 },
  discRow: { marginTop: 16 },
  discTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 13, color: GREEN },
  sql: { fontFamily: "Courier", fontSize: 10.5, color: SUB, marginTop: 8, lineHeight: 15 },
  simBtn: { marginTop: 18, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  simBtnTxt: { fontFamily: "Figtree_700Bold", fontSize: 14, color: "#FFFFFF" },
});

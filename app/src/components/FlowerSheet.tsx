/**
 * FlowerSheet — bottom sheet for one flower (prototype screen 2):
 * title, state pill, last30 vs usual bars, work hours, receipts, SQL disclosure.
 */
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";

import { fetchTransactions, FlowerState, TxResult } from "../api";
import { Flower } from "../garden/assets";

import { C, FONT, R, SHADOW } from "../theme";
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
            <Svg viewBox="-20 -54 40 57" style={styles.thumb}>
              <Flower category={flower.flower} state={st} />
            </Svg>
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
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "62%",
    ...SHADOW,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: "center", marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 28, height: 36 },
  title: { fontFamily: FONT.display, fontSize: 20, color: C.ink },
  pill: { backgroundColor: C.sageSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontFamily: FONT.semi, fontSize: 11, color: C.spruce },
  bigRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
  big: { fontFamily: FONT.display, fontSize: 32, color: C.ink, fontVariant: ["tabular-nums"] },
  vs: { fontFamily: FONT.body, fontSize: 12, color: C.sub },
  cmpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  cmpLbl: { fontFamily: FONT.semi, fontSize: 11, color: C.sub, width: 64 },
  trk: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#EDE8DA", overflow: "hidden" },
  trkFill: { height: 8, borderRadius: 4 },
  cmpVal: { fontFamily: FONT.bold, fontSize: 11, color: C.ink, width: 56, textAlign: "right", fontVariant: ["tabular-nums"] },
  eq: { fontFamily: FONT.semi, fontSize: 12.5, color: C.sub, marginTop: 10 },
  secH: { fontFamily: FONT.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: C.sub, marginTop: 18, marginBottom: 6 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  txD: { fontFamily: FONT.body, fontSize: 12.5, color: C.sub, width: 96 },
  txM: { fontFamily: FONT.body, fontSize: 12.5, color: C.ink, flex: 1 },
  txE: { fontFamily: FONT.bold, fontSize: 12.5, color: C.ink, fontVariant: ["tabular-nums"] },
  dim: { fontFamily: FONT.body, fontSize: 12, color: C.sub, marginTop: 4 },
  discRow: { marginTop: 16 },
  discTxt: { fontFamily: FONT.semi, fontSize: 13, color: C.green },
  sql: { fontFamily: "Courier", fontSize: 10.5, color: C.sub, marginTop: 8, lineHeight: 15 },
  simBtn: { marginTop: 18, backgroundColor: C.green, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  simBtnTxt: { fontFamily: FONT.bold, fontSize: 14, color: "#FFFFFF" },
});

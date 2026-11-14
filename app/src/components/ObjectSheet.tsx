/**
 * ObjectSheet — bottom sheet for the non-flower garden objects:
 * fence (bills), pond (savings), tree (investments), sky (safe to spend).
 * All numbers come straight from GardenState fields — no new arithmetic.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { GardenState } from "../api";

const GREEN = "#007841";
const INK = "#1F2A24";
const SUB = "#5C6B62";
const NBSP = " ";

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;

export type ObjKind = "bills" | "savings" | "invest" | "weather";

export function ObjectSheet({
  kind,
  g,
  onClose,
}: {
  kind: ObjKind | null;
  g: GardenState;
  onClose: () => void;
}) {
  if (!kind) return null;
  const rw = g.next_rent_window;

  let title = "";
  let rows: { label: string; value: string }[] = [];
  let note = "";
  let empty: string | null = null;

  if (kind === "bills") {
    title = "Bills";
    rows = [
      { label: "Rent", value: `${euro(g.rent)} · ${g.rent_paid ? "paid" : `due ~${rw.d0}–${rw.d1} ${rw.month}`}` },
      { label: "Utilities", value: `~${euro(g.utilities_month)}/month` },
      { label: "Still due this cycle", value: euro(g.bills_due) },
    ];
    note = "Bills are the predictable part — we forecast them within ~6% a month.";
  } else if (kind === "savings") {
    title = "Savings";
    rows = [
      { label: "In the pond", value: `${euro(g.pond_fill)} of ${euro(g.pond_target)}` },
      { label: "On your account", value: euro(g.balance) },
      { label: "Irregular costs · 30 days", value: euro(g.baskets_last30.B2) },
    ];
    note = "The pond is your cushion for irregular costs — health, repairs, the unexpected.";
  } else if (kind === "invest") {
    title = "Investments";
    if (g.invest_total > 0) {
      rows = [
        { label: "Deposits seen", value: euro(g.invest_total) },
        { label: "Active months", value: String(g.invest_months) },
        { label: "Latest deposit", value: euro(g.invest_last) },
      ];
      note = "These are deposits leaving this account — we can't see brokerage balances.";
    } else {
      empty = "No investment deposits seen in this account.";
      note = "We only see what leaves this account — we can't see brokerage balances.";
    }
  } else {
    title = "Safe to spend";
    const [d0, d1] = g.payday_window;
    rows = [
      { label: "Left this cycle", value: euro(g.left_cycle) },
      { label: "Safe today", value: euro(g.safe_today) },
      { label: "Safe this week", value: euro(g.safe_week) },
      { label: "Payday", value: `in ~${g.days_to_payday} days (~${d0}–${d1})` },
    ];
    note = "We take your salary, minus bills and essentials still due, spread over the days until payday.";
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{title}</Text>
          {empty ? (
            <Text style={styles.empty}>{empty}</Text>
          ) : (
            rows.map((r) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowLbl}>{r.label}</Text>
                <Text style={styles.rowVal}>{r.value}</Text>
              </View>
            ))
          )}
          <Text style={styles.note}>{note}</Text>
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
    maxHeight: "55%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D8DDD8", alignSelf: "center", marginBottom: 14 },
  title: { fontFamily: "Figtree_700Bold", fontSize: 20, color: INK, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDE4DD" },
  rowLbl: { fontFamily: "Figtree_500Medium", fontSize: 13.5, color: SUB, flex: 1 },
  rowVal: { fontFamily: "Figtree_700Bold", fontSize: 13.5, color: INK, fontVariant: ["tabular-nums"] },
  empty: { fontFamily: "Figtree_500Medium", fontSize: 14, color: SUB, marginTop: 6 },
  note: { fontFamily: "Figtree_500Medium", fontSize: 12.5, color: GREEN, marginTop: 16, lineHeight: 18 },
});

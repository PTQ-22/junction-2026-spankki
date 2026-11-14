/**
 * ObjectSheet — bottom sheet for the non-flower garden objects:
 * fence (bills), pond (savings), tree (investments), sky (safe to spend).
 * All numbers come straight from GardenState fields — no new arithmetic.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { G, Image as SvgImage } from "react-native-svg";

import type { GardenState } from "../api";
import { ART_SRC, Birch, InvestSapling, Pond, RailPlate } from "../garden/assets";

import { C, FONT, R, SHADOW } from "../theme";
const NBSP = " ";

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;

export type ObjKind = "bills" | "savings" | "invest" | "weather";

/** Painted icon for the sheet header — the same slot the scene draws. */
function ObjIcon({ kind, g }: { kind: ObjKind; g: GardenState }) {
  const st = { width: 44, height: 44 } as const;
  if (kind === "bills")
    return (
      <Svg viewBox="-46 -88 92 92" style={st}>
        <RailPlate
          variant="sun"
          rent={g.rent}
          paid={g.rent_paid}
          windowText={`next ~${g.next_rent_window.d0}–${g.next_rent_window.d1} ${g.next_rent_window.month}`}
        />
      </Svg>
    );
  if (kind === "savings")
    return (
      <Svg viewBox="-60 -60 120 64" style={st}>
        <G scale={0.85}>
          <Pond level={g.pond_target > 0 ? g.pond_fill / g.pond_target : 0} variant="sun" />
        </G>
      </Svg>
    );
  if (kind === "invest")
    return g.invest_total > 0 ? (
      <Svg viewBox="-26 -66 52 70" style={st}>
        <G scale={0.4}>
          <Birch />
        </G>
      </Svg>
    ) : (
      <Svg viewBox="-18 -56 36 60" style={st}>
        <InvestSapling />
      </Svg>
    );
  return (
    <Svg viewBox="0 0 40 40" style={st}>
      <SvgImage href={ART_SRC("bg-sun")} x={0} y={0} width={40} height={71.7} preserveAspectRatio="xMidYMin slice" />
    </Svg>
  );
}

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
          <View style={styles.titleRow}>
            <ObjIcon kind={kind} g={g} />
            <Text style={styles.title}>{title}</Text>
          </View>
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
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "55%",
    ...SHADOW,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: "center", marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontFamily: FONT.display, fontSize: 20, color: C.ink },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowLbl: { fontFamily: FONT.body, fontSize: 13.5, color: C.sub, flex: 1 },
  rowVal: { fontFamily: FONT.bold, fontSize: 13.5, color: C.ink, fontVariant: ["tabular-nums"] },
  empty: { fontFamily: FONT.body, fontSize: 14, color: C.sub, marginTop: 6 },
  note: { fontFamily: FONT.body, fontSize: 12.5, color: C.spruce, marginTop: 16, lineHeight: 18 },
});

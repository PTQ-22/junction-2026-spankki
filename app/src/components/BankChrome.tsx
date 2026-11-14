/**
 * Bank chrome — the S-mobiili frame that makes Taimi read as living inside
 * the bank app by default. Matches the real S-mobiili: cream base, deep
 * forest-green brand colour on the mark, wordmark and icon buttons.
 * The chrome is mocked; everything under it (balance, garden, coach) is real.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, FONT } from "../theme";

/** S-mobiili brand green — deep forest green (~#005A3C). */
export const BANK = "#005A3C";

/** Compact cream header for Etusivu — mark, wordmark, greeting, round icon buttons. */
export function BankHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <View style={styles.logoMark}>
        <Text style={styles.logoS}>S</Text>
      </View>
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={styles.hdrTitle}>S-mobiili</Text>
        <Text style={styles.hdrSub}>Hei, Aino!</Text>
      </View>
      <View style={styles.iconBtn}>
        <Ionicons name="notifications-outline" size={15} color="#FFFFFF" />
      </View>
      <View style={{ width: 8 }} />
      <View style={styles.iconBtn}>
        <Ionicons name="person-outline" size={15} color="#FFFFFF" />
      </View>
    </View>
  );
}

/** Same compact cream header for the other tabs — mark + wordmark + bell. */
export function BankBar() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, styles.bar, { paddingTop: insets.top + 6 }]}>
      <View style={styles.logoMarkSm}>
        <Text style={styles.logoSSm}>S</Text>
      </View>
      <Text style={styles.barTitle}>S-mobiili</Text>
      <View style={styles.iconBtnSm}>
        <Ionicons name="notifications-outline" size={13} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.paper,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BANK,
    alignItems: "center",
    justifyContent: "center",
  },
  logoS: { fontFamily: FONT.display, fontSize: 19, color: "#FFFFFF" },
  hdrTitle: { fontFamily: FONT.bold, fontSize: 17, color: BANK },
  hdrSub: { fontFamily: FONT.body, fontSize: 12, color: C.sub, marginTop: 1 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BANK,
    alignItems: "center",
    justifyContent: "center",
  },
  // lite variant for the other tabs
  bar: { paddingBottom: 8 },
  logoMarkSm: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BANK,
    alignItems: "center",
    justifyContent: "center",
  },
  logoSSm: { fontFamily: FONT.display, fontSize: 14, color: "#FFFFFF" },
  barTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: BANK,
    marginLeft: 8,
    flex: 1,
  },
  iconBtnSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BANK,
    alignItems: "center",
    justifyContent: "center",
  },
});

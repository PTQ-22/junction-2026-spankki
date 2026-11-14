/**
 * Profile — "Your settings" (save-first %) + clearly-labelled "Demo" controls.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchPersonas, Persona } from "../api";
import { useDemo } from "../state";

const GREEN = "#007841";
const INK = "#1F2A24";
const SUB = "#5C6B62";
const FAINT = "#8A968C";

const TODAYS = ["2026-09-15", "2026-09-01", "2026-08-15", "2026-06-15"];
const SAVE_PCTS = [0, 0.05, 0.1];

export function ProfileScreen() {
  const demo = useDemo();
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    fetchPersonas().then(setPersonas).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.h}>Profile</Text>

      <Text style={styles.label}>Your settings</Text>
      <Text style={styles.sub2}>Save first — a slice of each salary set aside before your fun budget is calculated.</Text>
      <View style={styles.seg}>
        {SAVE_PCTS.map((v) => (
          <Pressable
            key={v}
            style={[styles.segBtn, demo.saveFirstPct === v && styles.segOn]}
            onPress={() => demo.setSaveFirstPct(v)}
          >
            <Text style={[styles.segTxt, demo.saveFirstPct === v && styles.segTxtOn]}>
              {`${Math.round(v * 100)}%`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.introBtn} onPress={() => demo.setIntroSeen(false)}>
        <Text style={styles.introTxt}>Show intro again</Text>
      </Pressable>

      <Text style={styles.label}>Demo — for the hackathon jury</Text>
      <Text style={styles.sub2}>These controls switch the demo data; they're not part of the product.</Text>

      <Text style={styles.subLbl}>Persona</Text>
      {personas.map((p) => (
        <Pressable
          key={p.id}
          style={[styles.row, demo.persona === p.id && styles.rowOn]}
          onPress={() => demo.setPersona(p.id)}
        >
          <Text style={[styles.rowTxt, demo.persona === p.id && styles.rowTxtOn]}>{p.label}</Text>
        </Pressable>
      ))}
      {personas.length === 0 && <Text style={styles.dim}>API offline — {demo.persona} stays.</Text>}

      <Text style={styles.subLbl}>“Today” in the demo</Text>
      <View style={styles.seg}>
        {TODAYS.map((t) => (
          <Pressable
            key={t}
            style={[styles.segBtn, demo.today === t && styles.segOn]}
            onPress={() => demo.setToday(t)}
          >
            <Text style={[styles.segTxt, demo.today === t && styles.segTxtOn]}>{t.slice(5)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6F2" },
  pad: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  h: { fontFamily: "Figtree_700Bold", fontSize: 24, color: INK },
  label: {
    fontFamily: "Figtree_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: SUB,
    marginTop: 22,
    marginBottom: 6,
  },
  sub2: { fontFamily: "Figtree_500Medium", fontSize: 12.5, color: SUB, lineHeight: 18, marginBottom: 10 },
  subLbl: { fontFamily: "Figtree_600SemiBold", fontSize: 12.5, color: INK, marginTop: 14, marginBottom: 8 },
  introBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#DDE4DD",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  introTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 14, color: GREEN },
  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE4DD",
    padding: 13,
    marginBottom: 8,
  },
  rowOn: { borderColor: GREEN, borderWidth: 1.5 },
  rowTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 14, color: INK },
  rowTxtOn: { color: GREEN },
  seg: { flexDirection: "row", gap: 8 },
  segBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE4DD",
    paddingVertical: 10,
    alignItems: "center",
  },
  segOn: { borderColor: GREEN, borderWidth: 1.5 },
  segTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 13, color: INK },
  segTxtOn: { color: GREEN },
  dim: { fontFamily: "Figtree_500Medium", fontSize: 12, color: FAINT, marginTop: 8 },
});

/**
 * Profile — "Your settings" (save-first %) + clearly-labelled "Demo" controls.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchPersonas, Persona } from "../api";
import { useDemo } from "../state";

import { C, FONT, R, SHADOW } from "../theme";

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
  root: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  h: { fontFamily: FONT.display, fontSize: 24, color: C.ink },
  label: {
    fontFamily: FONT.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: C.sub,
    marginTop: 22,
    marginBottom: 6,
  },
  sub2: { fontFamily: FONT.body, fontSize: 12.5, color: C.sub, lineHeight: 18, marginBottom: 10 },
  subLbl: { fontFamily: FONT.semi, fontSize: 12.5, color: C.ink, marginTop: 14, marginBottom: 8 },
  introBtn: {
    marginTop: 16,
    borderRadius: R.card,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: C.card,
    ...SHADOW,
  },
  introTxt: { fontFamily: FONT.semi, fontSize: 14, color: C.spruce },
  row: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 13,
    marginBottom: 8,
    ...SHADOW,
  },
  rowOn: { borderColor: C.sage, borderWidth: 1.5 },
  rowTxt: { fontFamily: FONT.semi, fontSize: 14, color: C.ink },
  rowTxtOn: { color: C.spruce },
  seg: { flexDirection: "row", gap: 8 },
  segBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    alignItems: "center",
    ...SHADOW,
  },
  segOn: { borderColor: C.sage, borderWidth: 1.5 },
  segTxt: { fontFamily: FONT.semi, fontSize: 13, color: C.ink },
  segTxtOn: { color: C.spruce },
  dim: { fontFamily: FONT.body, fontSize: 12, color: C.faint, marginTop: 8 },
});

/**
 * Profile — "Your settings" (save-first %) + clearly-labelled "Demo" controls.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchPersonas, Persona } from "../api";
import { BankBar } from "../components/BankChrome";
import { OfflineCard } from "../offline";
import { useDemo } from "../state";

import { C, FONT, R, SHADOW } from "../theme";

const TODAYS = ["2026-09-15", "2026-09-01", "2026-08-15", "2026-06-15"];
const SAVE_PCTS = [0, 0.05, 0.1];
/** "One promise" commitment — 1% of every payday (Save More Tomorrow). */
const PROMISE_PCT = 0.01;

export function ProfileScreen() {
  const demo = useDemo();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasErr, setPersonasErr] = useState(false);
  const [personasTick, setPersonasTick] = useState(0);

  useEffect(() => {
    let live = true;
    setPersonasErr(false);
    fetchPersonas()
      .then((d) => live && setPersonas(d))
      .catch(() => live && setPersonasErr(true));
    return () => {
      live = false;
    };
  }, [personasTick]);

  /** ON locks save_first_pct to 1%; OFF restores whatever was set before. */
  const togglePromise = () => {
    if (demo.promiseOn) {
      demo.setSaveFirstPct(demo.prevSavePct);
      demo.setPromiseOn(false);
    } else {
      demo.setPrevSavePct(demo.saveFirstPct === PROMISE_PCT ? 0 : demo.saveFirstPct);
      demo.setPromiseOn(true);
      demo.setSaveFirstPct(PROMISE_PCT);
    }
  };

  return (
    <View style={styles.wrap}>
      <BankBar />
      <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.h}>Profile</Text>

      <Text style={styles.label}>Your settings</Text>

      {/* One promise — Save More Tomorrow: one commitment, not a slider. */}
      <View style={styles.promiseCard}>
        <View style={styles.promiseText}>
          <Text style={styles.promiseTitle}>One promise</Text>
          <Text style={styles.promiseBody}>Save 1% of every payday automatically.</Text>
          <Text style={styles.promiseSub}>
            The garden grows a little each payday — you won't feel it.
          </Text>
        </View>
        <Pressable
          onPress={togglePromise}
          accessibilityRole="button"
          accessibilityState={{ checked: demo.promiseOn }}
          accessibilityLabel="Save 1% of every payday automatically"
          style={[styles.switchTrk, demo.promiseOn && styles.switchTrkOn]}
        >
          <View style={[styles.switchKnob, demo.promiseOn && styles.switchKnobOn]} />
        </Pressable>
      </View>

      <Text style={styles.sub2}>Save first — a slice of each salary set aside before your fun budget is calculated.</Text>
      <View
        style={[styles.seg, demo.promiseOn && { opacity: 0.4 }]}
        pointerEvents={demo.promiseOn ? "none" : "auto"}
      >
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
      {demo.promiseOn && (
        <Text style={styles.lockNote}>
          Locked while your promise is on — 1% is set for you. Turn the promise off to adjust manually.
        </Text>
      )}

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
      {personas.length === 0 &&
        (personasErr ? (
          <OfflineCard onRetry={() => setPersonasTick((t) => t + 1)} />
        ) : (
          <Text style={styles.dim}>API offline — {demo.persona} stays.</Text>
        ))}

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.paper },
  root: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 20, paddingTop: 18, paddingBottom: 40 },
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
  sub2: { fontFamily: FONT.body, fontSize: 12.5, color: C.sub, lineHeight: 18, marginBottom: 10, marginTop: 14 },
  promiseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: 14,
    marginBottom: 4,
    ...SHADOW,
  },
  promiseText: { flex: 1 },
  promiseTitle: { fontFamily: FONT.display, fontSize: 17, color: C.ink },
  promiseBody: { fontFamily: FONT.semi, fontSize: 13, color: C.ink, marginTop: 3 },
  promiseSub: { fontFamily: FONT.body, fontSize: 12, color: C.sub, lineHeight: 17, marginTop: 4 },
  // switch styled like the sim controls: sage track, white knob, green when on
  switchTrk: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.sageSoft,
    justifyContent: "center",
    padding: 3,
  },
  switchTrkOn: { backgroundColor: C.green },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    ...SHADOW,
  },
  switchKnobOn: { alignSelf: "flex-end" },
  lockNote: { fontFamily: FONT.body, fontSize: 11.5, color: C.faint, marginTop: 8 },
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

/**
 * Intro — 3-slide onboarding shown on every cold start (in-memory flag).
 * Skipped when the deep link carries `intro=0`. Slide 2's legend is also
 * what the Home "?" modal shows.
 */
import { useGlobalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg from "react-native-svg";

import { Birch, Flower, Pond, Rail, Taimi, Weather } from "../garden/assets";
import { useDemo } from "../state";

const GREEN = "#007841";
const INK = "#1F2A24";
const SUB = "#5C6B62";
const LINE = "#DDE4DD";

/** Legend rows — shared by intro slide 2 and the Home "?" modal. */
export function Legend() {
  const rows: { icon: React.ReactNode; label: string; what: string }[] = [
    {
      icon: (
        <Svg viewBox="30 45 80 90" style={styles.icon}>
          <Weather kind="sun" />
        </Svg>
      ),
      label: "Weather",
      what: "how much is safe to spend",
    },
    {
      icon: (
        <Svg viewBox="140 455 110 45" style={styles.icon}>
          <Rail variant="sun" />
        </Svg>
      ),
      label: "Fence",
      what: "bills — predictable, forecast within ~6% a month",
    },
    {
      icon: (
        <Svg viewBox="-13 -66 26 68" style={styles.icon}>
          <Flower category="Restaurants" state="ok" />
        </Svg>
      ),
      label: "Flowers",
      what: "fun spending vs your own usual",
    },
    {
      icon: (
        <Svg viewBox="34 628 108 38" style={styles.icon}>
          <Pond level={0.85} variant="sun" />
        </Svg>
      ),
      label: "Pond",
      what: "savings cushion for surprises",
    },
    {
      icon: (
        <Svg viewBox="-36 -80 72 90" style={styles.icon}>
          <Birch berries />
        </Svg>
      ),
      label: "Tree",
      what: "investments",
    },
  ];
  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={styles.lrow}>
          {r.icon}
          <View style={{ flex: 1 }}>
            <Text style={styles.llabel}>{r.label}</Text>
            <Text style={styles.lwhat}>{r.what}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const SLIDES: { title: string; body?: string; legend?: boolean }[] = [
  {
    title: "Meet Taimi",
    body: "A money coach inside S-mobiili. It reads your transactions and tells you, in plain words, what's safe to spend.",
  },
  { title: "Read your garden", legend: true },
  {
    title: "You decide",
    body: "Taimi doesn't guess your future. It shows what happens if you change one habit — and every answer comes with its receipts.",
  },
];

export function IntroGate() {
  const { introSeen, setIntroSeen } = useDemo();
  const params = useGlobalSearchParams<{ intro?: string }>();
  const raw = Array.isArray(params.intro) ? params.intro[0] : params.intro;
  const startAt = Math.min(2, Math.max(0, (parseInt(raw ?? "", 10) || 1) - 1));
  const [slide, setSlide] = useState(startAt);
  const insets = useSafeAreaInsets();

  // deep link ?intro=N re-targets a slide (demo/screenshot aid)
  useEffect(() => {
    if (raw && raw !== "0") setSlide(startAt);
  }, [raw]);

  if (introSeen || raw === "0") return null;
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable style={styles.skip} onPress={() => setIntroSeen(true)}>
        <Text style={styles.skipTxt}>Skip</Text>
      </Pressable>
      <View style={styles.body}>
        {slide === 0 && (
          <Svg viewBox="-40 -150 80 160" style={styles.hero}>
            <Taimi stage={3} mood="sun" />
          </Svg>
        )}
        <Text style={styles.title}>{s.title}</Text>
        {s.body && <Text style={styles.p}>{s.body}</Text>}
        {s.legend && <Legend />}
      </View>
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === slide && styles.dotOn]} />
        ))}
      </View>
      <Pressable
        style={styles.cta}
        onPress={() => (last ? setIntroSeen(true) : setSlide(slide + 1))}
      >
        <Text style={styles.ctaTxt}>{last ? "Get started" : "Next"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: "#F4F6F2",
    paddingHorizontal: 24,
  },
  skip: { alignSelf: "flex-end", padding: 8 },
  skipTxt: { fontFamily: "Figtree_600SemiBold", fontSize: 14, color: SUB },
  body: { flex: 1, justifyContent: "center" },
  hero: { width: 110, height: 150, alignSelf: "center", marginBottom: 10 },
  title: { fontFamily: "Figtree_700Bold", fontSize: 28, color: INK, marginBottom: 12 },
  p: { fontFamily: "Figtree_500Medium", fontSize: 15.5, color: SUB, lineHeight: 23 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#C9CFC9" },
  dotOn: { backgroundColor: GREEN },
  cta: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  ctaTxt: { fontFamily: "Figtree_700Bold", fontSize: 15, color: "#FFFFFF" },
  icon: { width: 46, height: 46, marginRight: 12 },
  lrow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 10,
    marginBottom: 8,
  },
  llabel: { fontFamily: "Figtree_700Bold", fontSize: 14, color: INK },
  lwhat: { fontFamily: "Figtree_500Medium", fontSize: 12.5, color: SUB, marginTop: 1 },
});

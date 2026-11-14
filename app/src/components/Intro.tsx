/**
 * Intro — 3-slide onboarding shown on every cold start (in-memory flag).
 * Skipped when the deep link carries `intro=0`. Slide 2's legend is also
 * what the Home "?" modal shows.
 */
import { useGlobalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Image as SvgImage } from "react-native-svg";

import { ART_SRC, Birch, Flower, Pond, Taimi } from "../garden/assets";
import { useDemo } from "../state";

import { C, FONT, R, SHADOW } from "../theme";

/** Legend rows — shared by intro slide 2 and the Home "?" modal. */
export function Legend() {
  const rows: { icon: React.ReactNode; label: string; what: string }[] = [
    {
      icon: (
        <Svg viewBox="0 0 40 40" style={styles.icon}>
          {/* top of bg-sun: sky + sun */}
          <SvgImage href={ART_SRC("bg-sun")} x={0} y={0} width={40} height={71.7} preserveAspectRatio="xMidYMin slice" />
        </Svg>
      ),
      label: "Weather",
      what: "how much is safe to spend",
    },
    {
      icon: (
        <Svg viewBox="0 0 40 40" style={styles.icon}>
          {/* bg-sun shifted so the fence rails fill the icon */}
          <SvgImage href={ART_SRC("bg-sun")} x={-8} y={-43} width={56} height={100.3} preserveAspectRatio="xMidYMid slice" />
        </Svg>
      ),
      label: "Fence",
      what: "bills — predictable, forecast within ~6% a month",
    },
    {
      icon: (
        <Svg viewBox="-15 -56 30 59" style={styles.icon}>
          <Flower category="Restaurants" state="blooming" />
        </Svg>
      ),
      label: "Flowers",
      what: "fun spending vs your own usual",
    },
    {
      icon: (
        <Svg viewBox="-52 -50 104 52" style={styles.icon}>
          <Pond level={1} variant="sun" />
        </Svg>
      ),
      label: "Pond",
      what: "savings cushion for surprises",
    },
    {
      icon: (
        <Svg viewBox="-22 -108 44 112" style={styles.icon}>
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

/** `intro` query value from a full URL (exp://host/--/path?intro=0, taimi://…). */
function introFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /[?&]intro=([^&#]*)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

export function IntroGate() {
  const { introSeen, setIntroSeen } = useDemo();
  const params = useGlobalSearchParams<{ intro?: string; n?: string }>();
  const raw = Array.isArray(params.intro) ? params.intro[0] : params.intro;
  const startAt = Math.min(2, Math.max(0, (parseInt(raw ?? "", 10) || 1) - 1));
  const [slide, setSlide] = useState(startAt);
  // cold start: don't render the intro until the launch URL has been read —
  // otherwise ?intro=0 flashes (or is lost before the router parses params)
  const [initChecked, setInitChecked] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let live = true;
    Linking.getInitialURL()
      .then((url) => {
        if (live && introFromUrl(url) === "0") setIntroSeen(true);
      })
      .catch(() => {})
      .finally(() => live && setInitChecked(true));
    // warm deep links: catch ?intro=0 even before the router updates params
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (introFromUrl(url) === "0") setIntroSeen(true);
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  // deep link ?intro=0 hides it for the session; ?intro=1|2|3 re-opens that slide
  useEffect(() => {
    if (raw === "0") setIntroSeen(true);
    else if (raw === "1" || raw === "2" || raw === "3") {
      setSlide(startAt);
      setIntroSeen(false);
    }
  }, [raw, params.n]);

  if (!initChecked || introSeen || raw === "0") return null;
  const s = SLIDES[slide];
  const last = slide === SLIDES.length - 1;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable style={styles.skip} onPress={() => setIntroSeen(true)}>
        <Text style={styles.skipTxt}>Skip</Text>
      </Pressable>
      <View style={styles.body}>
        {slide === 0 && (
          <Svg viewBox="-40 -76 80 86" style={styles.hero}>
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
    backgroundColor: C.paper,
    paddingHorizontal: 24,
  },
  skip: { alignSelf: "flex-end", padding: 8 },
  skipTxt: { fontFamily: FONT.semi, fontSize: 14, color: C.sub },
  body: { flex: 1, justifyContent: "center" },
  hero: { width: 110, height: 150, alignSelf: "center", marginBottom: 10 },
  title: { fontFamily: FONT.display, fontSize: 28, color: C.ink, marginBottom: 12 },
  p: { fontFamily: FONT.body, fontSize: 15.5, color: C.sub, lineHeight: 23 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#C9CFC9" },
  dotOn: { backgroundColor: C.green },
  cta: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  ctaTxt: { fontFamily: FONT.bold, fontSize: 15, color: "#FFFFFF" },
  icon: { width: 46, height: 46, marginRight: 12 },
  lrow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: 10,
    marginBottom: 8,
    ...SHADOW,
  },
  llabel: { fontFamily: FONT.bold, fontSize: 14, color: C.ink },
  lwhat: { fontFamily: FONT.body, fontSize: 12.5, color: C.sub, marginTop: 1 },
});

/**
 * Home — the garden IS the interface. One question, one number, one next step.
 * Sim mode: the what-if plays out ON the garden — coins into the pond,
 * the flower recovers, the counter ticks up month by month.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchSimulate, GardenState, SimResult } from "../api";
import { BANK, BankHeader } from "../components/BankChrome";
import { FlowerSheet } from "../components/FlowerSheet";
import { ObjectSheet, ObjKind } from "../components/ObjectSheet";
import { Legend } from "../components/Intro";
import { flowerHead, flowerIndex, GardenScene, POCKET_POS, POND_POS, sceneXY, simViewBox } from "../garden/GardenScene";
import { OfflineCard, useGarden } from "../offline";
import { useDemo } from "../state";
import { C, FONT, R, SHADOW } from "../theme";

const NBSP = " ";
const MONTHS_N = 6;

const euro = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;
const euro2 = (n: number) =>
  `${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${NBSP}€`;

const DECIDE_CATS = ["Restaurants", "Entertainment", "Lifestyle"];

/* rAF tween channels — JS-driven so it works on web and native identically. */
type Chan = { v: number; raf?: number };

function mkTweens() {
  const chan: Record<string, Chan> = {};
  const tween = (key: string, to: number, ms: number, set: (v: number) => void) => {
    const c = chan[key] ?? (chan[key] = { v: 0 });
    if (c.raf) cancelAnimationFrame(c.raf);
    const from = c.v;
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      c.v = from + (to - from) * e;
      set(c.v);
      if (p < 1) c.raf = requestAnimationFrame(step);
      else c.raf = undefined;
    };
    c.raf = requestAnimationFrame(step);
  };
  const pulse = (key: string, set: (v: number) => void, peak = 0.15, ms = 480) => {
    const c = chan[key] ?? (chan[key] = { v: 1 });
    if (c.raf) cancelAnimationFrame(c.raf);
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      c.v = 1 + peak * Math.sin(p * Math.PI);
      set(c.v);
      if (p < 1) c.raf = requestAnimationFrame(step);
      else c.raf = undefined;
    };
    c.raf = requestAnimationFrame(step);
  };
  const stopAll = () => Object.values(chan).forEach((c) => c.raf && cancelAnimationFrame(c.raf));
  return { tween, pulse, stopAll };
}

/** A coin that drops from the flower head to the pond (or the pocket chip). */
function Coin({
  x0,
  y0,
  x1,
  y1,
  delay,
  onDone,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
  onDone: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(v, {
        toValue: 1,
        duration: 700,
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => finished && onDone());
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x0 - 5,
        top: y0 - 5,
        opacity: v.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x1 - x0] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y1 - y0] }) },
        ],
      }}
    >
      <Image source={require("../../assets/garden/coin.png")} style={styles.coin} />
    </Animated.View>
  );
}

/** Floating "+N €" that rises above the pond and fades. */
function FloatText({ x, y, text, onDone }: { x: number; y: number; text: string; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== "web" }).start(
      ({ finished }) => finished && onDone(),
    );
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x - 46,
        top: y,
        width: 92,
        alignItems: "center",
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }],
      }}
    >
      <Text style={styles.floatTxt}>{text}</Text>
    </Animated.View>
  );
}

/** Custom 0–50% slider (5% steps) — same pan slider the What if screen used. */
function CutSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const wRef = useRef(1);
  const snap = (x: number) => {
    const v = Math.min(0.5, Math.max(0, Math.round((x / wRef.current) * 10) / 20));
    onChange(Number(v.toFixed(2)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => snap(e.nativeEvent.locationX),
      onPanResponderMove: (e) => snap(e.nativeEvent.locationX),
    }),
  ).current;
  return (
    <View
      style={{ flex: 1, height: 36, justifyContent: "center" }}
      onLayout={(e: LayoutChangeEvent) => {
        wRef.current = e.nativeEvent.layout.width;
      }}
      {...pan.panHandlers}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.line }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: C.green, width: `${value * 200}%` }} />
      </View>
      <View
        style={{
          position: "absolute",
          left: `${value * 200}%`,
          marginLeft: -12,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: C.green,
          borderWidth: 3,
          borderColor: "#FFFFFF",
        }}
      />
    </View>
  );
}

function coachNote(g: GardenState): { text: string; action: string; go: "ask" | "sim"; q?: string; cat?: string } {
  if (g.storm)
    return {
      text: "Money is tight this week. Ask Taimi what's safe to spend.",
      action: "Ask Taimi",
      go: "ask",
      q: "What is safe for me to spend this week?",
    };
  const pick = g.flowers
    .filter((f) => DECIDE_CATS.includes(f.flower) && f.state === "wilting" && f.norm > 0)
    .sort((a, b) => b.last30 - b.norm - (a.last30 - a.norm))[0];
  if (pick)
    return {
      text: `${pick.flower}: ${euro(pick.last30)} in the last 30 days — you usually spend ${euro(pick.norm)}.`,
      action: "See what −20% would save",
      go: "sim",
      cat: pick.flower,
    };
  return { text: "Everything looks on track this month.", action: "Ask Taimi a question", go: "ask" };
}

/** Default sim category: wilting flower with the largest excess, else largest norm. */
function defCat(g: GardenState): string {
  const wilting = g.flowers
    .filter((f) => f.state === "wilting" && f.norm > 0)
    .sort((a, b) => b.last30 - b.norm - (a.last30 - a.norm))[0];
  return wilting?.flower ?? [...g.flowers].sort((a, b) => b.norm - a.norm)[0]?.flower ?? "Restaurants";
}

interface CoinT {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
}
interface FloatT {
  id: number;
  x: number;
  y: number;
  text: string;
}

export function HomeScreen() {
  const { persona, today, saveFirstPct, setPersona, setToday } = useDemo();
  const router = useRouter();
  const params = useLocalSearchParams<{
    persona?: string;
    today?: string;
    flower?: string;
    obj?: string;
    sim?: string;
    category?: string;
    cut?: string;
    month?: string;
    autoplay?: string;
  }>();
  const { g, offline, retry } = useGarden();
  const [sheet, setSheet] = useState<string | null>(null);
  const [objSheet, setObjSheet] = useState<ObjKind | null>(null);
  const [legend, setLegend] = useState(false);

  // ---- sim mode -----------------------------------------------------------
  const [simCat, setSimCat] = useState<string | null>(null);
  const [cut, setCut] = useState(0.2);
  const [cutApplied, setCutApplied] = useState(0.2);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simErr, setSimErr] = useState(false);
  const [month, setMonth] = useState(0); // 0 = Today … months
  const [playing, setPlaying] = useState(false);
  const [pondLv, setPondLv] = useState(0);
  const [dispCount, setDispCount] = useState(0);
  const [pocket, setPocket] = useState(0);
  const [flowerScale, setFlowerScale] = useState(1);
  const [taimiScale, setTaimiScale] = useState(1);
  const [coins, setCoins] = useState<CoinT[]>([]);
  const [floats, setFloats] = useState<FloatT[]>([]);
  const [reqTick, setReqTick] = useState(0);
  const [sceneSz, setSceneSz] = useState<{ w: number; h: number } | null>(null);
  const [toast, setToast] = useState(false);
  const idRef = useRef(0);
  const prevMonth = useRef(0);
  const playingRef = useRef(false);
  const autoplayPending = useRef(false);
  const simParamKey = useRef("");
  const tw = useRef(mkTweens()).current;
  const simMode = simCat != null;

  useEffect(() => {
    if (params.persona && params.persona !== persona) setPersona(params.persona);
  }, [params.persona]); // deep link: exp://host:8081/--/?persona=CUST00359

  useEffect(() => {
    if (params.today && params.today !== today) setToday(params.today);
  }, [params.today]); // deep link: ?today=2026-09-15

  useEffect(() => {
    if (params.flower) setSheet(params.flower);
    if (params.obj) setObjSheet(params.obj as ObjKind);
  }, [params.flower, params.obj]); // deep link: ?flower=Entertainment / ?obj=savings opens a sheet

  // deep link: ?sim=1&category=X&cut=0.2&month=3&autoplay=1
  useEffect(() => {
    if (params.sim !== "1" || !g) return;
    const key = `${params.category}|${params.cut}|${params.month}|${params.autoplay}`;
    if (simParamKey.current === key) return;
    simParamKey.current = key;
    const cat =
      params.category && g.flowers.some((f) => f.flower === params.category) ? params.category : defCat(g);
    const c = parseFloat(params.cut ?? "0.2");
    const m = Math.max(0, Math.min(MONTHS_N, parseInt(params.month ?? "0", 10) || 0));
    enterSim(cat, isNaN(c) ? 0.2 : Math.min(0.5, Math.max(0, c)), m, params.autoplay === "1");
  }, [params.sim, params.category, params.cut, params.month, params.autoplay, g]);

  // garden fetch lives in useGarden() (shared offline path + retry)

  // debounce the slider so we don't spam /simulate
  useEffect(() => {
    const t = setTimeout(() => setCutApplied(cut), 250);
    return () => clearTimeout(t);
  }, [cut]);

  // fetch the simulation whenever the question changes (reqTick retries identical inputs)
  useEffect(() => {
    if (!simMode || !simCat || !g) return;
    let live = true;
    fetchSimulate(persona, today, simCat, cutApplied, saveFirstPct)
      .then((d) => {
        if (live) {
          setSim(d);
          setSimErr(false);
        }
      })
      .catch(() => live && setSimErr(true));
    return () => {
      live = false;
    };
  }, [simMode, simCat, cutApplied, persona, today, saveFirstPct, reqTick]);

  // autoplay once the sim answer arrives
  useEffect(() => {
    if (sim && autoplayPending.current) {
      autoplayPending.current = false;
      setMonth(0);
      prevMonth.current = 0;
      setPlaying(true);
    }
  }, [sim]);

  // play: advance one month every ~0.9 s
  useEffect(() => {
    if (!playing) return;
    playingRef.current = true;
    const iv = setInterval(() => setMonth((m) => Math.min(MONTHS_N, m + 1)), 900);
    return () => {
      clearInterval(iv);
      playingRef.current = false;
    };
  }, [playing]);

  useEffect(() => {
    if (playing && month >= (sim?.months ?? MONTHS_N)) setPlaying(false);
  }, [month, playing, sim]);

  // ---- month transition: pond level, counter, coins, state changes --------
  useEffect(() => {
    if (!sim || !simMode || !g) return;
    const m = month;
    const pondTargetLv =
      g.pond_target > 0 ? (m === 0 ? g.pond_fill : sim.monthly_pond[m - 1]) / g.pond_target : 0;
    const cnt = m === 0 ? 0 : sim.monthly_cumulative[m - 1];
    const pck = m === 0 ? 0 : sim.monthly_pocket[m - 1];

    tw.tween("pond", pondTargetLv, 520, setPondLv);
    tw.tween("count", cnt, 460, (v) => setDispCount(v));
    tw.tween("pocket", pck, 520, setPocket);

    // forward step while playing → coins + floating "+N €" + transitions
    if (playingRef.current && m > prevMonth.current && m > 0) {
      const increment = sim.monthly_cumulative[m - 1] - (m > 1 ? sim.monthly_cumulative[m - 2] : 0);
      const i = flowerIndex(g, sim.category);
      if (sceneSz && i >= 0 && increment > 0) {
        const vb = simViewBox(sceneSz.w, sceneSz.h);
        const head = flowerHead(i);
        const dst = pck > 0 ? POCKET_POS : POND_POS;
        const from = sceneXY(sceneSz.w, sceneSz.h, head.x, head.y, vb);
        const to = sceneXY(sceneSz.w, sceneSz.h, dst.x, dst.y, vb);
        const add = [0, 1, 2].map((k) => ({
          id: ++idRef.current,
          x0: from.x + (k - 1) * 10,
          y0: from.y,
          x1: to.x,
          y1: to.y,
          delay: k * 150,
        }));
        setCoins((c) => [...c, ...add]);
        const fpos = sceneXY(sceneSz.w, sceneSz.h, POND_POS.x, POND_POS.y - 18, vb);
        setFloats((f) => [...f, { id: ++idRef.current, x: fpos.x, y: fpos.y, text: `+${Math.round(increment)} €` }]);
      }
      if (m === 1 && sim.future.flower_state !== sim.today.flower_state) tw.pulse("fscale", setFlowerScale);
      if (m === sim.months && sim.future.stage > sim.today.stage) tw.pulse("tscale", setTaimiScale);
    }
    prevMonth.current = m;
  }, [month, sim, simMode, g, sceneSz]);

  const enterSim = (category: string, c: number, m0 = 0, autoplay = false) => {
    setSheet(null);
    setSimCat(category);
    setCut(c);
    setCutApplied(c);
    setSim(null);
    setSimErr(false);
    setReqTick((t) => t + 1);
    setMonth(m0);
    prevMonth.current = m0;
    setCoins([]);
    setFloats([]);
    if (autoplay) autoplayPending.current = true;
  };

  const exitSim = () => {
    setPlaying(false);
    autoplayPending.current = false;
    tw.stopAll();
    setSimCat(null);
    setSim(null);
    setSimErr(false);
    setMonth(0);
    setCoins([]);
    setFloats([]);
  };

  const retrySim = () => {
    setSimErr(false);
    setSim(null);
    setReqTick((t) => t + 1);
  };

  const selectCat = (name: string) => {
    if (name === simCat) return;
    setPlaying(false);
    setSimCat(name);
    setSim(null);
    setSimErr(false);
    setReqTick((t) => t + 1);
    setMonth(0);
    prevMonth.current = 0;
  };

  const fl = g?.flowers.find((f) => f.flower === sheet) ?? null;
  const note = g ? coachNote(g) : null;
  const rw = g?.next_rent_window;

  const go = () => {
    if (!note) return;
    if (note.go === "sim" && note.cat) enterSim(note.cat, 0.2);
    else router.push({ pathname: "/(tabs)/ask", params: note.q ? { q: note.q } : {} });
  };

  const simVisual =
    simMode && sim && g
      ? {
          selected: sim.category,
          pondLevel: pondLv,
          pocket,
          flowerState: month >= 1 ? sim.future.flower_state : sim.today.flower_state,
          flowerScale,
          taimiStage: month >= sim.months ? sim.future.stage : sim.today.stage,
          taimiScale,
          warm: sim.eur_per_day_future > sim.eur_per_day_now,
          playing,
        }
      : simMode && g
        ? {
            selected: simCat ?? "",
            pondLevel: g.pond_target > 0 ? g.pond_fill / g.pond_target : 0,
            pocket: 0,
            flowerState: g.flowers.find((f) => f.flower === simCat)?.state ?? "ok",
            flowerScale,
            taimiStage: g.stage,
            taimiScale,
            warm: false,
            playing,
          }
        : undefined;

  const onFlowerPress = (name: string) => {
    if (simMode) {
      const f = g?.flowers.find((x) => x.flower === name);
      if (f && f.norm > 0) selectCat(name);
    } else setSheet(name);
  };

  const onObjectPress = (kind: string) => {
    if (kind === "taimi") {
      router.push("/(tabs)/ask");
      return;
    }
    if (kind === "fun") {
      if (g) setSheet(g.top_flower);
      return;
    }
    setObjSheet(kind as ObjKind);
  };

  const hInk = g?.storm ? "#EDF2F5" : C.ink;
  const hSub = g?.storm ? "#B9C6D0" : C.sub;
  const fade0 = g?.storm ? "rgba(28,42,60,0.72)" : "rgba(238,244,240,0.78)";
  const fade1 = g?.storm ? "rgba(28,42,60,0.36)" : "rgba(238,244,240,0.40)";
  const fade2 = g?.storm ? "rgba(28,42,60,0.15)" : "rgba(238,244,240,0.16)";

  return (
    <View style={styles.root}>
      {/* S-Pankki bank chrome — Taimi lives inside S-mobiili by default */}
      <BankHeader />

      {/* accounts — mocked chrome, but the S-Tili balance is the real one */}
      <View style={styles.acctCard}>
        <View style={styles.acctIcon}>
          <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.acctName}>S-Tili</Text>
          <Text style={styles.acctIban}>FI21 1234 5600 0789 05</Text>
        </View>
        <Text style={styles.acctBal}>{g ? euro2(g.balance) : "1 284,55 €"}</Text>
      </View>

      {/* Taimi section — the garden is still the interface under the chrome */}
      <View style={styles.sec}>
        <Text style={styles.taimiTitle}>Taimi · oma puutarhasi</Text>
        <View style={styles.coachPill}>
          <Text style={styles.coachPillTxt}>coach</Text>
        </View>
      </View>

      {/* scene — full-bleed inside its window; the painted sky runs behind
          the floating header just like before */}
      <View
        style={styles.sceneWrap}
        onLayout={(e) => setSceneSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {g ? (
          <GardenScene g={g} onFlowerPress={onFlowerPress} onObjectPress={onObjectPress} labels sim={simVisual} embedded />
        ) : (
          <View style={styles.loading}>
            {offline ? <OfflineCard onRetry={retry} /> : <ActivityIndicator color={C.green} />}
          </View>
        )}
        {coins.map((c) => (
          <Coin key={c.id} {...c} onDone={() => setCoins((v) => v.filter((x) => x.id !== c.id))} />
        ))}
        {floats.map((f) => (
          <FloatText key={f.id} {...f} onDone={() => setFloats((v) => v.filter((x) => x.id !== f.id))} />
        ))}

      {/* header — floats on the painted sky with a soft top fade; kept tight
          so its fade edge clears the flower heads in the embedded window */}
      <View style={[styles.header, { paddingTop: 8 }]} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fade0 }]} />
        <View style={{ position: "absolute", top: "100%", left: 0, right: 0, height: 18, backgroundColor: fade1 }} />
        <View style={{ position: "absolute", top: "100%", marginTop: 18, left: 0, right: 0, height: 9, backgroundColor: fade2 }} />
        <Pressable
          style={[styles.help, { top: 10 }]}
          onPress={() => setLegend(true)}
          accessibilityLabel="What does the garden mean?"
        >
          <Text style={[styles.helpTxt, { color: hSub }]}>?</Text>
        </Pressable>
        {simMode ? (
          <>
            <Text style={[styles.headLabelSim, { color: hSub }]} numberOfLines={2}>
              {`What if you spent ${Math.round(cut * 100)}% less on ${simCat}?`}
            </Text>
            <Text style={[styles.headNum, { color: hInk }]}>{`+${euro(dispCount)}`}</Text>
            <Text style={[styles.headSub, { color: hSub }]}>
              {sim
                ? `in 6 months · ${sim.hours} h of your work`
                : simErr
                  ? "can't reach the garden"
                  : "asking the garden…"}
            </Text>
          </>
        ) : g ? (
          g.storm ? (
            <>
              <Text style={[styles.headline, { color: hInk }]}>Tight until payday</Text>
              <Text style={[styles.headSub, { color: hSub }]}>
                {`Rent ~${rw!.d0}–${rw!.d1} ${rw!.month} is next — keep to essentials for now.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.headLabel, { color: hSub }]}>
                {g.left_cycle <= 0 || g.days_to_payday <= 1
                  ? "left for fun this pay cycle"
                  : "left for fun until payday"}
              </Text>
              <Text style={[styles.headNum, { color: hInk }]}>{g.left_cycle <= 0 ? `0${NBSP}€` : euro(g.left_cycle)}</Text>
              {/* balance lives on the S-Tili card above — no need to repeat it */}
              {g.left_cycle > 0 && (
                <Text style={[styles.headSub, { color: hSub }]}>
                  {g.days_to_payday <= 1
                    ? "Payday is due today."
                    : `≈ ${euro(g.safe_today)}/day · payday in ~${g.days_to_payday} days`}
                </Text>
              )}
            </>
          )
        ) : (
          <Text style={[styles.headline, { color: hInk }]}>{offline ? "The garden is resting" : "Your garden"}</Text>
        )}
      </View>
      </View>

      {/* bottom panel — flush on the tab bar */}
      {g && simMode ? (
        <View style={styles.panel}>
          {simErr ? (
            <>
              <OfflineCard onRetry={retrySim} />
              <View style={styles.actions}>
                <View style={{ flex: 1 }} />
                <Pressable style={styles.ghost} onPress={exitSim}>
                  <Text style={styles.ghostTxt}>Done</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
          {/* Step 1 · pick a habit */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingRight: 12 }}
          >
            {g.flowers
              .filter((f) => f.norm > 0)
              .map((f) => (
                <Pressable
                  key={f.flower}
                  onPress={() => selectCat(f.flower)}
                  style={[styles.chip, simCat === f.flower && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, simCat === f.flower && styles.chipTxtOn]} numberOfLines={1}>
                    {f.flower}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
          {/* Step 2 · how much less */}
          <View style={styles.sliderRow}>
            <CutSlider value={cut} onChange={setCut} />
            <Text style={styles.cutLbl}>{`−${Math.round(cut * 100)}%`}</Text>
          </View>
          <Text style={styles.cutSub}>
            {`Spend ${Math.round(cut * 100)}% less → ~${euro((sim?.norm ?? 0) * (1 - cut))}/month instead of ${euro(sim?.norm ?? 0)}`}
          </Text>
          {/* Step 3 · scrub the months — horizontal scroll so the last
              chip (Mar) is always reachable; right padding keeps it clear
              of the panel edge */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrubScroll}
            contentContainerStyle={styles.scrubRow}
          >
            {["Today", ...(sim?.month_labels ?? [])].map((lbl, i) => (
              <Pressable
                key={lbl}
                onPress={() => {
                  setPlaying(false);
                  setMonth(i);
                }}
                style={[styles.scrubItem, month === i && styles.scrubOn]}
              >
                <Text style={[styles.scrubTxt, month === i && styles.scrubTxtOn]}>{lbl}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={[styles.cta, playing && { opacity: 0.6 }]}
              onPress={() => {
                if (!playing) {
                  if (month >= MONTHS_N) setMonth(0);
                  setPlaying(true);
                }
              }}
              accessibilityRole="button"
            >
              {!playing && <Ionicons name="play" size={13} color="#FFFFFF" />}
              <Text style={styles.ctaTxt}>{playing ? "Playing…" : "Play 6 months"}</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() => {
                setToast(true);
                setTimeout(() => setToast(false), 2200);
              }}
            >
              <Text style={styles.ghostTxt}>Set as goal</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={exitSim}>
              <Text style={styles.ghostTxt}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.honest} numberOfLines={1}>
            Based on your usual spending — fun spending is your choice.
          </Text>
            </>
          )}
        </View>
      ) : g && note ? (
        <View style={styles.panel}>
          <Text style={styles.note}>{note.text}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cta} onPress={go} accessibilityRole="button">
              <Text style={styles.ctaTxt}>{note.action}</Text>
            </Pressable>
            {note.go !== "ask" && (
              <Pressable style={styles.ghost} onPress={() => router.push("/(tabs)/ask")}>
                <Text style={styles.ghostTxt}>Ask Taimi</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.tiles}>
            <Pressable style={styles.tile} onPress={() => router.push("/(tabs)/spending")}>
              <Text style={styles.tileLbl}>Bills</Text>
              <Text style={styles.tileVal}>{euro(g.rent)}</Text>
              <Text style={styles.tileSub}>{g.rent_paid ? "paid" : `due ~${rw!.d0}–${rw!.d1}`}</Text>
            </Pressable>
            <Pressable style={styles.tile} onPress={() => router.push("/(tabs)/spending")}>
              <Text style={styles.tileLbl}>Account</Text>
              <Text style={styles.tileVal}>{euro(g.balance)}</Text>
              <Text style={styles.tileSub}>{g.balance < 0 ? "below zero" : "on your account"}</Text>
            </Pressable>
            <Pressable style={styles.tile} onPress={() => router.push("/(tabs)/spending")}>
              <Text style={styles.tileLbl}>Fun · 30 days</Text>
              <Text style={styles.tileVal}>{euro(g.baskets_last30.B3)}</Text>
              <Text style={styles.tileSub}>{`usually ${euro(g.leaks_norm_month)}`}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <FlowerSheet
        flower={fl}
        customerId={persona}
        today={today}
        onClose={() => setSheet(null)}
        onSimulate={(name) => enterSim(name, 0.2)}
      />
      {g && <ObjectSheet kind={objSheet} g={g} onClose={() => setObjSheet(null)} />}

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastTxt}>Goal saved — Taimi will water it.</Text>
        </View>
      )}

      {/* "?" legend — same content as intro slide 2 */}
      <Modal visible={legend} transparent animationType="fade" onRequestClose={() => setLegend(false)}>
        <Pressable style={styles.legBack} onPress={() => setLegend(false)} />
        <View style={styles.legCard}>
          <Text style={styles.legTitle}>Read your garden</Text>
          <Legend />
          <Text style={styles.legHint}>Tap anything in the garden to see the numbers behind it.</Text>
          <Pressable style={styles.legClose} onPress={() => setLegend(false)}>
            <Text style={styles.legCloseTxt}>Got it</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 6, paddingHorizontal: 20, paddingBottom: 8 },
  headline: { fontFamily: FONT.display, fontSize: 24, color: C.ink },
  headLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: C.sub,
  },
  headNum: {
    fontFamily: FONT.display,
    fontSize: 44,
    letterSpacing: -1,
    color: C.ink,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  headLabelSim: {
    fontFamily: FONT.semi,
    fontSize: 13,
    color: C.sub,
  },
  headSub: { fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 3 },
  sceneWrap: { flex: 1, overflow: "hidden" }, // clip the painted backdrop inside the scene window
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  // S-mobiili chrome — mocked frame around the real garden
  sec: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    gap: 8,
  },
  acctCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BANK, // the green account card, like S-mobiili's S-Etukortti card
    borderRadius: R.card,
    marginHorizontal: 16,
    marginTop: 6,
    padding: 10,
    paddingRight: 62, // keep the balance clear of the dev-tools overlay at the right edge
    ...SHADOW,
  },
  acctIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  acctName: { fontFamily: FONT.bold, fontSize: 14.5, color: "#FFFFFF" },
  acctIban: { fontFamily: FONT.body, fontSize: 11.5, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  acctBal: { fontFamily: FONT.bold, fontSize: 16, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  taimiTitle: { fontFamily: FONT.display, fontSize: 17, color: BANK },
  coachPill: {
    backgroundColor: C.sageSoft,
    borderRadius: R.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coachPillTxt: { fontFamily: FONT.semi, fontSize: 10, color: C.spruce },
  help: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpTxt: { fontFamily: FONT.bold, fontSize: 14, color: C.sub },
  panel: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    ...SHADOW,
  },
  note: { fontFamily: FONT.semi, fontSize: 14, color: C.ink, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" },
  cta: {
    flex: 1,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  ctaTxt: { fontFamily: FONT.bold, fontSize: 14, color: "#FFFFFF" },
  ghost: { justifyContent: "center", paddingHorizontal: 10 },
  ghostTxt: { fontFamily: FONT.semi, fontSize: 13.5, color: C.spruce },
  tiles: { flexDirection: "row", gap: 6, marginTop: 8 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: 8,
    ...SHADOW,
  },
  tileLbl: {
    fontFamily: FONT.bold,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: C.faint,
  },
  tileVal: { fontFamily: FONT.bold, fontSize: 14, color: C.ink, marginTop: 2, fontVariant: ["tabular-nums"] },
  tileSub: { fontFamily: FONT.body, fontSize: 10, color: C.sub, marginTop: 1 },
  legBack: { flex: 1, backgroundColor: "rgba(20,30,24,0.35)" },
  legCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "18%",
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    ...SHADOW,
  },
  legTitle: { fontFamily: FONT.display, fontSize: 19, color: C.ink, marginBottom: 12 },
  legHint: { fontFamily: FONT.body, fontSize: 12, color: C.sub, textAlign: "center", marginTop: 10 },
  legClose: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20 },
  legCloseTxt: { fontFamily: FONT.bold, fontSize: 14, color: C.green },
  // sim mode
  coin: {
    width: 16,
    height: 18,
    resizeMode: "contain",
  },
  floatTxt: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: "#7A5C14",
    fontVariant: ["tabular-nums"],
  },
  chip: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: R.chip,
    paddingHorizontal: 13,
    paddingVertical: 5,
    backgroundColor: C.sageSoft,
  },
  chipOn: { borderColor: C.sage },
  chipTxt: { fontFamily: FONT.semi, fontSize: 12.5, color: C.ink },
  chipTxtOn: { color: C.spruce },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  cutLbl: { fontFamily: FONT.bold, fontSize: 13, color: C.ink, width: 48, textAlign: "right" },
  cutSub: { fontFamily: FONT.body, fontSize: 11, color: C.sub, marginTop: 1 },
  scrubScroll: { flexGrow: 0, marginTop: 8 },
  scrubRow: { flexDirection: "row", gap: 4, paddingRight: 20 },
  scrubItem: {
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: C.sageSoft,
  },
  scrubOn: { backgroundColor: C.spruce },
  scrubTxt: { fontFamily: FONT.semi, fontSize: 9.5, color: C.sub },
  scrubTxtOn: { color: "#FFFFFF" },
  honest: { fontFamily: FONT.body, fontSize: 10, color: C.faint, marginTop: 6 },
  toast: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  toastTxt: { fontFamily: FONT.semi, fontSize: 13, color: "#FFFFFF" },
});

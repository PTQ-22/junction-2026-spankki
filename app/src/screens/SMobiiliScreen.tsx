/**
 * S-mobiili shell — Junction pitch mock: Taimi embedded inside S-Pankki's app.
 * The chrome (header, account card, bottom nav) is fake; the garden and its
 * sheets are REAL — same GardenScene, fetchGarden data and tap targets as Home.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchGarden, GardenState } from "../api";
import { FlowerSheet } from "../components/FlowerSheet";
import { ObjectSheet, ObjKind } from "../components/ObjectSheet";
import { GardenScene } from "../garden/GardenScene";
import { useDemo } from "../state";
import { C, FONT, R, SHADOW } from "../theme";

const BANK_DARK = "#00592E"; // deeper S-Pankki green — header gradient edge / nav accents
const SCENE_W = 390;
const SCENE_H = 784; // VB_DEF.h — the full painted scene height
const WINDOW_TOP = 368; // scene-y where the embedded window starts: flower heads + Taimi + pond

const euro2 = (n: number) =>
  `${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;

const NAV: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Etusivu", icon: "home-outline" },
  { label: "Omat ostot", icon: "receipt-outline" },
  { label: "Säästäjä", icon: "leaf-outline" },
  { label: "Kortit", icon: "card-outline" },
];

const ACTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Siirrä rahaa", icon: "swap-horizontal-outline" },
  { label: "Maksa lasku", icon: "document-text-outline" },
  { label: "Sijoitukset", icon: "trending-up-outline" },
];

export function SMobiiliScreen() {
  const { persona, today, saveFirstPct } = useDemo();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [g, setG] = useState<GardenState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [objSheet, setObjSheet] = useState<ObjKind | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    let live = true;
    setErr(null);
    fetchGarden(persona, today, saveFirstPct)
      .then((d) => live && setG(d))
      .catch((e) => live && setErr(String(e)));
    return () => {
      live = false;
    };
  }, [persona, today, saveFirstPct]);

  // Embed math: render the full 390×784 scene at width scale, then clip the
  // sky so the visible window starts at the flower heads and ends past the pond.
  const s = w / SCENE_W;
  const fullH = SCENE_H * s;
  const shiftY = -(WINDOW_TOP - 60) * s; // VB_DEF.y = 60

  const fl = g?.flowers.find((f) => f.flower === sheet) ?? null;

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

  return (
    <View style={styles.root}>
      {/* S-Pankki header */}
      <View style={[styles.hdr, { paddingTop: insets.top + 10 }]}>
        <View style={styles.hdrRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoS}>S</Text>
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.hdrTitle}>S-mobiili</Text>
            <Text style={styles.hdrSub}>Hei, Aino!</Text>
          </View>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          <View style={{ width: 16 }} />
          <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
        </View>
      </View>

      {/* Accounts — mocked */}
      <View style={styles.sec}>
        <Text style={styles.secLbl}>Tilit</Text>
        <View style={styles.mockTag}>
          <Text style={styles.mockTagTxt}>mock</Text>
        </View>
      </View>
      <View style={styles.acctCard}>
        <View style={styles.acctIcon}>
          <Ionicons name="wallet-outline" size={18} color={C.green} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.acctName}>S-Tili</Text>
          <Text style={styles.acctIban}>FI21 1234 5600 0789 05</Text>
        </View>
        <Text style={styles.acctBal}>{g ? euro2(g.balance) : "1 284,55 €"}</Text>
      </View>
      <View style={styles.actions}>
        {ACTIONS.map((a) => (
          <Pressable key={a.label} style={styles.action}>
            <Ionicons name={a.icon} size={15} color={C.spruce} />
            <Text style={styles.actionTxt}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Taimi — the real garden, embedded */}
      <View style={styles.sec}>
        <Text style={styles.secLbl}>Taimi · oma puutarhasi</Text>
        <View style={styles.coachPill}>
          <Text style={styles.coachPillTxt}>coach</Text>
        </View>
      </View>
      <View
        style={styles.gardenClip}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      >
        {g && w > 0 ? (
          <View style={{ height: fullH, marginTop: shiftY }}>
            <GardenScene
              g={g}
              labels
              onFlowerPress={(name) => setSheet(name)}
              onObjectPress={onObjectPress}
            />
          </View>
        ) : (
          <View style={styles.loading}>
            {err ? <Text style={styles.err}>{err}</Text> : <ActivityIndicator color={C.green} />}
          </View>
        )}
      </View>

      {/* S-mobiili bottom nav — mocked */}
      <View style={styles.nav}>
        {NAV.map((n, i) => (
          <View key={n.label} style={styles.navItem}>
            <Ionicons
              name={n.icon}
              size={22}
              color={i === 0 ? C.green : C.faint}
            />
            <Text style={[styles.navLbl, i === 0 && { color: C.green }]}>{n.label}</Text>
            {i === 0 && <View style={styles.navDot} />}
          </View>
        ))}
      </View>

      {/* pitch caption — annotation under the shell, not part of the mock */}
      <View style={[styles.caption, { paddingBottom: insets.bottom + 6 }]}>
        <Text style={styles.captionTxt} numberOfLines={1} adjustsFontSizeToFit>
          Omat ostot → the flowers · Säästäjä → the pond · Taimi lives inside S-mobiili
        </Text>
      </View>

      <FlowerSheet
        flower={fl}
        customerId={persona}
        today={today}
        onClose={() => setSheet(null)}
      />
      {g && <ObjectSheet kind={objSheet} g={g} onClose={() => setObjSheet(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },

  hdr: { backgroundColor: C.green, paddingHorizontal: 16, paddingBottom: 14 },
  hdrRow: { flexDirection: "row", alignItems: "center" },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logoS: { fontFamily: FONT.display, fontSize: 21, color: C.green },
  hdrTitle: { fontFamily: FONT.bold, fontSize: 18, color: "#FFFFFF" },
  hdrSub: { fontFamily: FONT.body, fontSize: 12, color: "#D6E8DC", marginTop: 1 },

  sec: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  secLbl: {
    fontFamily: FONT.bold,
    fontSize: 11.5,
    color: C.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  mockTag: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  mockTagTxt: { fontFamily: FONT.semi, fontSize: 9, color: C.faint, textTransform: "uppercase" },

  acctCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.card,
    marginHorizontal: 16,
    padding: 14,
    paddingRight: 62, // keep the balance clear of the dev-tools overlay at the right edge
    ...SHADOW,
  },
  acctIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  acctName: { fontFamily: FONT.bold, fontSize: 14.5, color: C.ink },
  acctIban: { fontFamily: FONT.body, fontSize: 11.5, color: C.faint, marginTop: 1 },
  acctBal: { fontFamily: FONT.bold, fontSize: 16, color: C.ink, fontVariant: ["tabular-nums"] },

  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.sageSoft,
    borderRadius: R.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionTxt: { fontFamily: FONT.semi, fontSize: 12, color: C.spruce },

  coachPill: {
    backgroundColor: C.sageSoft,
    borderRadius: R.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coachPillTxt: { fontFamily: FONT.semi, fontSize: 10, color: C.spruce },

  gardenClip: { flex: 1, overflow: "hidden", marginTop: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  err: { fontFamily: FONT.body, fontSize: 12, color: C.terra, paddingHorizontal: 24 },

  nav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 8,
    paddingBottom: 10,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navLbl: { fontFamily: FONT.semi, fontSize: 10.5, color: C.faint },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BANK_DARK, marginTop: 1 },

  caption: { alignItems: "center", paddingTop: 6 },
  captionTxt: {
    fontFamily: FONT.body,
    fontSize: 11,
    color: C.faint,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});

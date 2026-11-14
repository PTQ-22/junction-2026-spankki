/**
 * Ask Taimi — coach chat (prototype screen 4): scene band, white cards,
 * green pills, quick replies, receipts disclosure. Numbers come from tools.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Svg from "react-native-svg";

import { ChatReply, fetchChat, GardenState } from "../api";
import { BankBar } from "../components/BankChrome";
import { Taimi } from "../garden/assets";
import { OfflineCard, useGarden } from "../offline";
import { useDemo } from "../state";

import { C, FONT, R, SHADOW } from "../theme";

const QUESTIONS = [
  "How much did I spend on taxis last month?",
  "What kind of spender am I?",
  "What's safe to spend this week?",
  "What if I cut dining out by 20%?",
];

interface Msg {
  role: "taimi" | "me";
  text: string;
  receipts?: ChatReply["receipts"];
  action?: ChatReply["action"];
  provider?: ChatReply["provider"];
}

const PROVIDER_LABEL = {
  anthropic: "via Claude Haiku",
  gemini: "via Gemini",
  template: "template",
} as const;

export function AskScreen({ embedded = false }: { embedded?: boolean }) {
  const { persona, today, saveFirstPct } = useDemo();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; n?: string; reset?: string }>();
  const { g, offline, retry } = useGarden();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [openSql, setOpenSql] = useState<number | null>(null);
  const lastQ = useRef<string | null>(null);
  const draftRef = useRef("");
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // greeting resets whenever the (re)fetched garden arrives — useGarden owns
  // the fetch, the offline flag and retry
  useEffect(() => {
    // lastQ is NOT reset here: a refetched garden must not re-send an old ?q=
    setMsgs(g ? [{ role: "taimi", text: greeting(g) }] : []);
  }, [g]);

  const ask = (q: string) => {
    const text = q.trim();
    if (busy || !text) return;
    const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "me", text }]);
    setDraft("");
    draftRef.current = "";
    input.current?.clear();
    setBusy(true);
    fetchChat(persona, today, text, saveFirstPct, history)
      .then((r) => setMsgs((m) => [...m, { role: "taimi", text: r.text, receipts: r.receipts, action: r.action, provider: r.provider }]))
      .catch(() => setMsgs((m) => [...m, { role: "taimi", text: "I can't reach Taimi right now — the coach service isn't running. Try again in a moment." }]))
      .finally(() => setBusy(false));
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
  };

  // deep link ?reset=1[&n=…] — clear the conversation back to the greeting
  const lastReset = useRef<string | null>(null);
  useEffect(() => {
    const key = params.reset === "1" ? `1|${params.n ?? ""}` : null;
    if (key && g && lastReset.current !== key) {
      lastReset.current = key;
      lastQ.current = null;
      setOpenSql(null);
      setMsgs([{ role: "taimi", text: greeting(g) }]);
    }
  }, [params.reset, params.n, g]);

  // deep link ?q=…[&n=…] — send the question once INTO the existing
  // conversation (history kept, so follow-ups work). A new n re-sends the same
  // q. If Taimi is still answering, it waits and sends when she's done.
  useEffect(() => {
    const q = Array.isArray(params.q) ? params.q[0] : params.q;
    if (!q || !g || busy) return;
    const key = `${q}|${params.n ?? ""}`;
    if (lastQ.current !== key) {
      lastQ.current = key;
      ask(q);
    }
  }, [params.q, params.n, g, busy]);

  return (
    <View style={styles.root}>
      <BankBar />
      <View style={[styles.hdr, { paddingTop: 10 }]}>
        <View style={styles.glyphWrap}>
          <Svg width={40} height={40} viewBox="-25 -50 50 56">
            <Taimi stage={g?.stage ?? 2} mood="sun" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bandTitle}>Ask Taimi</Text>
          <Text style={styles.hdrSub}>
            Ask about your money. Taimi only answers from your own transactions — tap Receipts to check.
          </Text>
        </View>
        {!embedded && (
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {offline && <OfflineCard onRetry={retry} />}
        {msgs.map((m, i) => (
          <View key={i}>
            {m.role === "taimi" ? (
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Svg width={26} height={26} viewBox="-16 -34 32 38">
                    <Taimi stage={g?.stage ?? 2} mood="sun" />
                  </Svg>
                </View>
                <View style={styles.card}>
                <Text style={styles.cardLbl}>Taimi</Text>
                <Text style={styles.cardTxt}>{m.text}</Text>
                <View style={styles.recRow}>
                  {m.receipts && m.receipts.count > 0 && (
                    <Pressable onPress={() => setOpenSql(openSql === i ? null : i)}>
                      <Text style={styles.rec}>{`Receipts · ${m.receipts.count} transactions ${openSql === i ? "▴" : "▾"}`}</Text>
                    </Pressable>
                  )}
                  <View style={{ flex: 1 }} />
                  {m.provider && <Text style={styles.prov}>{PROVIDER_LABEL[m.provider]}</Text>}
                </View>
                {openSql === i && m.receipts && (
                  <View style={{ marginTop: 6 }}>
                    {m.receipts.rows.map((t, j) => (
                      <View key={j} style={styles.txRow}>
                        <Text style={styles.txD}>{t.d}</Text>
                        <Text style={styles.txM}>{t.label}</Text>
                        <Text style={styles.txE}>{t.eur.toFixed(2).replace(".", ",")} €</Text>
                      </View>
                    ))}
                    {!!m.receipts.sql && <Text style={styles.sql}>{m.receipts.sql}</Text>}
                  </View>
                )}
                {m.action?.type === "simulate" && (
                  <Pressable
                    style={styles.gardenBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/",
                        params: { sim: "1", category: m.action!.category, cut: String(m.action!.cut_pct), autoplay: "1" },
                      })
                    }
                  >
                    <Text style={styles.gardenBtnTxt}>Show me in my garden</Text>
                  </Pressable>
                )}
                </View>
              </View>
            ) : (
              <View style={styles.pill}>
                <Text style={styles.pillTxt}>{m.text}</Text>
              </View>
            )}
          </View>
        ))}
        {busy && <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} />}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={embedded ? 0 : 60}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quick}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {QUESTIONS.map((q) => (
            <Pressable key={q} style={styles.qBtn} onPress={() => ask(q)}>
              <Text style={styles.qTxt}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputRow, { paddingBottom: embedded ? 10 : insets.bottom + 10 }]}>
          <TextInput
            ref={input}
            style={styles.input}
            defaultValue=""
            onChangeText={(t) => {
              draftRef.current = t;
              setDraft(t);
            }}
            placeholder="Ask about your money…"
            placeholderTextColor={C.sub}
            onSubmitEditing={() => ask(draftRef.current)}
            submitBehavior="submit"
            returnKeyType="send"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.send, (!draft.trim() || busy) && { opacity: 0.4 }]}
            onPress={() => ask(draftRef.current)}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text style={styles.sendTxt}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function greeting(g: GardenState): string {
  if (g.storm) {
    const rw = g.next_rent_window;
    return `Heads-up — rent ~${rw.d0}–${rw.d1} ${rw.month} won't fit this cycle, but the pond covers it. What would you like to know?`;
  }
  if (g.left_cycle <= 0)
    return `Your fun budget is used up — the pond is safe at ${g.balance} € though. What would you like to know?`;
  return `${g.left_cycle} € left until payday — about ${g.safe_today} €/day. ${
    g.pond_target > 0 && g.pond_fill >= g.pond_target ? `Your pond is full at ${g.pond_fill} €.` : "Your pond is filling."
  } What would you like to know?`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  hdr: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  glyphWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.sageSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 2,
  },
  close: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
  },
  closeTxt: { fontSize: 13, color: C.ink },
  bandTitle: { fontFamily: FONT.display, fontSize: 17, color: C.ink },
  hdrSub: {
    fontFamily: FONT.body, fontSize: 12.5, color: C.sub, lineHeight: 18,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
    maxWidth: "94%",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.sageSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 3,
  },
  card: {
    flex: 1,
    backgroundColor: C.card, borderRadius: R.card,
    padding: 12, alignSelf: "flex-start",
    ...SHADOW,
  },
  cardLbl: { fontFamily: FONT.bold, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: C.green, marginBottom: 4 },
  cardTxt: { fontFamily: FONT.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  rec: { fontFamily: FONT.semi, fontSize: 12, color: C.green, marginTop: 8 },
  recRow: { flexDirection: "row", alignItems: "center" },
  prov: { fontFamily: FONT.body, fontSize: 10.5, color: C.sub, opacity: 0.6, marginTop: 8 },
  gardenBtn: { marginTop: 10, backgroundColor: C.green, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  gardenBtnTxt: { fontFamily: FONT.bold, fontSize: 13, color: "#FFFFFF" },
  txRow: { flexDirection: "row", paddingVertical: 4, gap: 8 },
  txD: { fontFamily: FONT.body, fontSize: 11.5, color: C.sub, width: 90 },
  txM: { fontFamily: FONT.body, fontSize: 11.5, color: C.ink, flex: 1 },
  txE: { fontFamily: FONT.bold, fontSize: 11.5, color: C.ink },
  sql: { fontFamily: "Courier", fontSize: 9.5, color: C.sub, marginTop: 6 },
  pill: {
    backgroundColor: C.sageSoft, borderRadius: R.card, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, alignSelf: "flex-end", maxWidth: "85%",
  },
  pillTxt: { fontFamily: FONT.semi, fontSize: 13.5, color: C.spruce },
  quick: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 10, flexGrow: 0 },
  qBtn: {
    backgroundColor: C.sageSoft, borderRadius: R.chip,
    paddingVertical: 9, paddingHorizontal: 14, alignItems: "center",
  },
  qTxt: { fontFamily: FONT.semi, fontSize: 13, color: C.spruce },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingTop: 4,
  },
  input: {
    flex: 1, backgroundColor: C.card, borderRadius: R.chip,
    paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: FONT.body, fontSize: 14, color: C.ink,
    ...SHADOW,
  },
  send: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.green,
    alignItems: "center", justifyContent: "center",
  },
  sendTxt: { fontFamily: FONT.bold, fontSize: 18, color: "#FFFFFF", marginTop: -2 },
});

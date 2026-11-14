/**
 * Offline — one shared path for "the coach service isn't running".
 * When fetchGarden/fetchChat rejects, screens render OfflineCard (a warm
 * paper card + Try again) instead of silent zeros or a spinner forever.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchGarden, GardenState } from "./api";
import { useDemo } from "./state";
import { C, FONT, R, SHADOW } from "./theme";

/** Warm paper card shown when the coach service can't be reached. */
export function OfflineCard({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Can't reach the garden</Text>
      <Text style={styles.body}>
        The coach service isn't running — your numbers will be back once it is.
      </Text>
      <Pressable style={styles.btn} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.btnTxt}>Try again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Shared garden fetch — same persona/today/saveFirstPct deps every screen
 * already used, plus an `offline` flag and a `retry()` that re-fetches.
 * Keeps the last good `g` while re-fetching, so retry doesn't blank the UI.
 */
export function useGarden(): { g: GardenState | null; offline: boolean; retry: () => void } {
  const { persona, today, saveFirstPct } = useDemo();
  const [g, setG] = useState<GardenState | null>(null);
  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setOffline(false);
    fetchGarden(persona, today, saveFirstPct)
      .then((d) => live && setG(d))
      .catch(() => live && setOffline(true));
    return () => {
      live = false;
    };
  }, [persona, today, saveFirstPct, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { g, offline, retry };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: 18,
    marginHorizontal: 24,
    alignItems: "center",
    ...SHADOW,
  },
  title: { fontFamily: FONT.display, fontSize: 17, color: C.ink },
  body: {
    fontFamily: FONT.body,
    fontSize: 13,
    color: C.sub,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
  btn: {
    marginTop: 14,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 26,
    alignItems: "center",
  },
  btnTxt: { fontFamily: FONT.bold, fontSize: 14, color: "#FFFFFF" },
});

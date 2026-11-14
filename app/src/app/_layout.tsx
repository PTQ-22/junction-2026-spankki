import { Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, useFonts } from "@expo-google-fonts/figtree";
import { Stack } from "expo-router";
import React from "react";

import { IntroGate } from "../components/Intro";
import { DemoProvider } from "../state";

export default function RootLayout() {
  const [loaded] = useFonts({ Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold });
  if (!loaded) return null;
  return (
    <DemoProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <IntroGate />
    </DemoProvider>
  );
}

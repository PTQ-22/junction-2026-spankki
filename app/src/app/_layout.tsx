import { Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, useFonts } from "@expo-google-fonts/figtree";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Stack } from "expo-router";
import React from "react";

import { ColdStartLink } from "../components/ColdStartLink";
import { FrameTicker } from "../components/FrameTicker";
import { IntroGate } from "../components/Intro";
import { DemoProvider } from "../state";

export default function RootLayout() {
  const [loaded] = useFonts({ Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Fraunces_600SemiBold });
  if (!loaded) return null;
  return (
    <DemoProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <IntroGate />
      <ColdStartLink />
      <FrameTicker />
    </DemoProvider>
  );
}

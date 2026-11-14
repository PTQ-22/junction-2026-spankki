import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { BANK } from "../../components/BankChrome";
import { C, FONT } from "../../theme";

/** Bottom nav styled like S-mobiili's own — cream bar, deep-green active,
 * bank section labels; the routes and screens underneath are unchanged. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BANK,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: { fontFamily: FONT.semi, fontSize: 10.5 },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: C.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Etusivu",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="spending"
        options={{
          title: "Omat ostot",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "receipt" : "receipt-outline"} color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: "Taimi",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profiili",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

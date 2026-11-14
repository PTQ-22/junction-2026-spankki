import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

const GREEN = "#007841";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: "#8A968C",
        tabBarLabelStyle: { fontFamily: "Figtree_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#DDE4DD",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="spending"
        options={{ title: "Spending", tabBarIcon: ({ color, size }) => <Ionicons name="card" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: "Ask Taimi", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}

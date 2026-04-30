import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, useTheme } from "../../src/theme";
import { View } from "react-native";

export default function TabLayout() {
  const { mode } = useTheme();
  // Force re-render + dynamic colors via useTheme dependency
  const tabBarStyle = {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingTop: 6,
    paddingBottom: 8,
  };
  const iconFor = (name: string, focused: boolean, color: string) => (
    <View style={{ alignItems: "center" }}>
      {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
      <Ionicons name={name as any} size={22} color={color} />
    </View>
  );
  return (
    <Tabs
      key={mode}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkLight,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, focused }) => iconFor(focused ? "home" : "home-outline", focused, color) }} />
      <Tabs.Screen name="matters" options={{ title: "Matters", tabBarIcon: ({ color, focused }) => iconFor(focused ? "briefcase" : "briefcase-outline", focused, color) }} />
      <Tabs.Screen name="clients" options={{ title: "Clients", tabBarIcon: ({ color, focused }) => iconFor(focused ? "people" : "people-outline", focused, color) }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color, focused }) => iconFor(focused ? "calendar" : "calendar-outline", focused, color) }} />
      <Tabs.Screen name="billing" options={{ title: "Billing", tabBarIcon: ({ color, focused }) => iconFor(focused ? "receipt" : "receipt-outline", focused, color) }} />
    </Tabs>
  );
}

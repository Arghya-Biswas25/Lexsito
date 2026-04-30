import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkLight,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="matters"
        options={{
          title: "Matters",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
              <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
              <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: "Billing",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              {focused && <View style={{ position: "absolute", top: -8, width: 24, height: 2, backgroundColor: colors.ink }} />}
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

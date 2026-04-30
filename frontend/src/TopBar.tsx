import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, useTheme } from "./theme";

export const TopBar = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => {
  useTheme();
  const router = useRouter();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bg, gap: spacing.sm,
    }}>
      <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }} testID="topbar-back">
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={[type.overline, { color: colors.inkMuted }]}>{subtitle}</Text> : null}
        <Text style={[type.h3, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
};

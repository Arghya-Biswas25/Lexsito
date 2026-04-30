import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type } from "./theme";

export const TopBar = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="topbar-back">
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={type.overline}>{subtitle}</Text> : null}
        <Text style={type.h3} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});

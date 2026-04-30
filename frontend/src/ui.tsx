import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, TextInput, TextInputProps } from "react-native";
import { colors, radii, spacing, type, useTheme } from "./theme";
import { Ionicons } from "@expo/vector-icons";

export const Button = ({
  title, onPress, variant = "primary", loading, disabled, testID, icon, style,
}: {
  title: string; onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean; disabled?: boolean; testID?: string;
  icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle;
}) => {
  useTheme(); // subscribe
  const baseStyle: ViewStyle = {
    paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radii.sm,
    alignItems: "center", justifyContent: "center", flexDirection: "row", minHeight: 48,
  };
  let container: ViewStyle;
  let textColor: string;
  if (variant === "primary") { container = { backgroundColor: colors.ink }; textColor = colors.onPrimary; }
  else if (variant === "secondary") { container = { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.ink }; textColor = colors.ink; }
  else if (variant === "ghost") { container = { backgroundColor: "transparent" }; textColor = colors.ink; }
  else { container = { backgroundColor: colors.alert }; textColor = "#FFFFFF"; }
  if (disabled || loading) container.opacity = 0.5;
  return (
    <TouchableOpacity style={[baseStyle, container, style]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.7} testID={testID}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color={textColor} style={{ marginRight: 8 }} />}
          <Text style={{ color: textColor, fontWeight: "700", fontSize: 15, letterSpacing: 0.3 }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export const Input = (props: TextInputProps & { label?: string; testID?: string; error?: string }) => {
  useTheme();
  const { label, error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && <Text style={[type.overline, { marginBottom: spacing.sm, color: colors.inkMuted }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.inkLight}
        {...rest}
        style={[{
          borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted,
          paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.sm,
          fontSize: 15, color: colors.ink, minHeight: 48,
        }, style]}
      />
      {error && <Text style={{ color: colors.alert, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
};

export const Card = ({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) => {
  useTheme();
  return (
    <View testID={testID} style={[{
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      padding: spacing.lg, borderRadius: radii.sm,
    }, style]}>{children}</View>
  );
};

export const Badge = ({ children, tone = "neutral", style }: { children: React.ReactNode; tone?: "neutral" | "success" | "alert" | "info" | "warning"; style?: ViewStyle }) => {
  useTheme();
  const toneMap = {
    neutral: { bg: colors.bgSubtle, fg: colors.ink },
    success: { bg: "rgba(22,163,74,0.15)", fg: colors.success },
    alert: { bg: "rgba(225,29,72,0.15)", fg: colors.alert },
    info: { bg: "rgba(37,99,235,0.15)", fg: colors.info },
    warning: { bg: "rgba(254,240,138,0.3)", fg: "#854D0E" },
  };
  const c = toneMap[tone];
  return (
    <View style={[{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm, alignSelf: "flex-start" }, style]}>
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</Text>
    </View>
  );
};

export const EmptyState = ({ icon, title, subtitle, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; action?: React.ReactNode }) => {
  useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl * 1.5 }}>
      <View style={{ width: 56, height: 56, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg, borderRadius: radii.sm }}>
        <Ionicons name={icon} size={24} color={colors.inkMuted} />
      </View>
      <Text style={[type.h3, { color: colors.ink, marginBottom: spacing.xs, textAlign: "center" }]}>{title}</Text>
      {subtitle && <Text style={[type.bodyMuted, { color: colors.inkMuted, textAlign: "center", marginBottom: spacing.lg }]}>{subtitle}</Text>}
      {action}
    </View>
  );
};

export const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => {
  useTheme();
  const initials = (name || "?").split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.onPrimary, fontSize: size * 0.38, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
};

export const Divider = () => {
  useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
};

export const Screen = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => {
  useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
};

export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>
);

export const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, "neutral" | "success" | "alert" | "info" | "warning"> = {
    active: "success", scheduled: "info", completed: "neutral", paid: "success", sent: "info",
    draft: "neutral", partial: "warning", overdue: "alert", closed: "neutral", prospective: "warning",
    dormant: "neutral", cancelled: "neutral",
  };
  return <Badge tone={map[status] || "neutral"}>{status}</Badge>;
};

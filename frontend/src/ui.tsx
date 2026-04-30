import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, TextInput, TextInputProps } from "react-native";
import { colors, radii, spacing, type } from "./theme";
import { Ionicons } from "@expo/vector-icons";

export const Button = ({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  testID,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) => {
  const base: ViewStyle[] = [btnStyles.base];
  const text: TextStyle[] = [btnStyles.text];
  if (variant === "primary") {
    base.push(btnStyles.primary);
    text.push(btnStyles.primaryText);
  } else if (variant === "secondary") {
    base.push(btnStyles.secondary);
    text.push(btnStyles.secondaryText);
  } else if (variant === "ghost") {
    base.push(btnStyles.ghost);
    text.push(btnStyles.ghostText);
  } else if (variant === "danger") {
    base.push(btnStyles.danger);
    text.push(btnStyles.dangerText);
  }
  if (disabled || loading) base.push({ opacity: 0.5 });
  return (
    <TouchableOpacity
      style={[...base, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.white : colors.ink} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color={variant === "primary" || variant === "danger" ? colors.white : colors.ink} style={{ marginRight: 8 }} />}
          <Text style={text}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const btnStyles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.black,
  },
  primaryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  ghostText: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 14,
  },
  danger: {
    backgroundColor: colors.alert,
  },
  dangerText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  text: {},
});

export const Input = (props: TextInputProps & { label?: string; testID?: string; error?: string }) => {
  const { label, error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && <Text style={[type.overline, { marginBottom: spacing.sm }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.inkLight}
        {...rest}
        style={[inputStyles.input, style]}
      />
      {error && <Text style={{ color: colors.alert, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
};

const inputStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.sm,
    fontSize: 15,
    color: colors.ink,
    minHeight: 48,
  },
});

export const Card = ({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) => (
  <View testID={testID} style={[cardStyles.card, style]}>{children}</View>
);

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.sm,
  },
});

export const Badge = ({
  children,
  tone = "neutral",
  style,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "alert" | "info" | "warning";
  style?: ViewStyle;
}) => {
  const toneMap = {
    neutral: { bg: colors.bgMuted, fg: colors.ink },
    success: { bg: "#DCFCE7", fg: "#166534" },
    alert: { bg: "#FEE2E2", fg: "#991B1B" },
    info: { bg: "#DBEAFE", fg: "#1E40AF" },
    warning: { bg: colors.highlight, fg: "#854D0E" },
  };
  const c = toneMap[tone];
  return (
    <View style={[{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm, alignSelf: "flex-start" }, style]}>
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</Text>
    </View>
  );
};

export const EmptyState = ({ icon, title, subtitle, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; action?: React.ReactNode }) => (
  <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl * 1.5 }}>
    <View style={{ width: 56, height: 56, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg, borderRadius: radii.sm }}>
      <Ionicons name={icon} size={24} color={colors.inkMuted} />
    </View>
    <Text style={[type.h3, { marginBottom: spacing.xs, textAlign: "center" }]}>{title}</Text>
    {subtitle && <Text style={[type.bodyMuted, { textAlign: "center", marginBottom: spacing.lg }]}>{subtitle}</Text>}
    {action}
  </View>
);

export const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.white, fontSize: size * 0.38, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
};

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border }} />;

export const Screen = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flex: 1, backgroundColor: colors.white }, style]}>{children}</View>
);

export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>
);

export const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, "neutral" | "success" | "alert" | "info" | "warning"> = {
    active: "success",
    scheduled: "info",
    completed: "neutral",
    paid: "success",
    sent: "info",
    draft: "neutral",
    partial: "warning",
    overdue: "alert",
    closed: "neutral",
    prospective: "warning",
    dormant: "neutral",
    cancelled: "neutral",
  };
  return <Badge tone={map[status] || "neutral"}>{status}</Badge>;
};

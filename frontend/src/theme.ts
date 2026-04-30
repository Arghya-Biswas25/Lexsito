import { StyleSheet } from "react-native";

export const colors = {
  bg: "#FFFFFF",
  bgMuted: "#F4F4F5",
  bgSubtle: "#E4E4E7",
  ink: "#09090B",
  inkMuted: "#52525B",
  inkLight: "#A1A1AA",
  border: "rgba(0,0,0,0.10)",
  borderStrong: "rgba(0,0,0,0.20)",
  alert: "#E11D48",
  success: "#16A34A",
  info: "#2563EB",
  highlight: "#FEF08A",
  black: "#000000",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  full: 999,
};

export const type = StyleSheet.create({
  overline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  h1: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  bodyMuted: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  metric: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.ink,
  },
});

export const formatINR = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  if (n >= 100000) {
    return `₹${(n / 100000).toFixed(2)} L`;
  }
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

export const daysBetween = (iso: string) => {
  const target = new Date(iso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

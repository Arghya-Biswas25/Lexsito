import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

const LIGHT = {
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
  primary: "#000000",
  onPrimary: "#FFFFFF",
  card: "#FFFFFF",
};

const DARK = {
  bg: "#0A0A0A",
  bgMuted: "#171717",
  bgSubtle: "#262626",
  ink: "#FAFAFA",
  inkMuted: "#A1A1AA",
  inkLight: "#71717A",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.24)",
  alert: "#FB7185",
  success: "#4ADE80",
  info: "#60A5FA",
  highlight: "#FEF08A",
  black: "#000000",
  white: "#FFFFFF",
  primary: "#FAFAFA",
  onPrimary: "#0A0A0A",
  card: "#111111",
};

// Live object — mutated at runtime. Screens/components that use useColors() hook re-render on mode change.
export const colors: typeof LIGHT = { ...LIGHT };

const applyMode = (mode: ThemeMode) => {
  const src = mode === "dark" ? DARK : LIGHT;
  Object.assign(colors, src);
};

// Context
type ThemeCtx = { mode: ThemeMode; setMode: (m: ThemeMode) => void };
const Ctx = createContext<ThemeCtx>({ mode: "light", setMode: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem("lex_theme")) as ThemeMode | null;
      const initial = saved || "light";
      applyMode(initial);
      setModeState(initial);
      setLoaded(true);
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    applyMode(m);
    setModeState(m);
    AsyncStorage.setItem("lex_theme", m).catch(() => {});
  };

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  if (!loaded) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTheme = () => useContext(Ctx);

/**
 * useColors — returns the current palette. Triggers re-render when mode changes.
 * Use INSIDE components together with useMemo for styles.
 */
export const useColors = () => {
  const { mode } = useContext(Ctx);
  // mode dep triggers re-render; colors object itself is mutated in applyMode
  return colors;
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radii = { none: 0, sm: 4, md: 6, lg: 8, full: 999 };

export const type = {
  overline: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
  h1: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.8 },
  h2: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22 },
  bodyMuted: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12 },
  metric: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.6 },
};

export const formatINR = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch { return iso; }
};

export const daysBetween = (iso: string) => {
  const target = new Date(iso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

/**
 * Helper for inline text styles that need color from current palette.
 * Usage: <Text style={[type.h1, inkColor()]}>...</Text>
 */
export const inkColor = () => ({ color: colors.ink });
export const inkMutedColor = () => ({ color: colors.inkMuted });

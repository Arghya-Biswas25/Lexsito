import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "./theme";
import { api } from "./api";

const formatElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Floating timer pill — shows on top of any tab screen when an active timer exists.
 * Polls the timer state and ticks every second.
 */
export const TimerPill = () => {
  const router = useRouter();
  const [timer, setTimer] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<any>(null);

  const fetchTimer = async () => {
    try {
      const res = await api.get("/timer");
      setTimer(res.data?.active ? res.data.timer : null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchTimer();
    // Re-check periodically in case timer started/stopped on another screen
    const poll = setInterval(fetchTimer, 8000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (timer) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer]);

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      fetchTimer();
    }, [])
  );

  if (!timer) return null;

  const elapsedMs = now - new Date(timer.started_at).getTime();

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={() => router.push("/timer")}
      testID="timer-pill"
      activeOpacity={0.85}
    >
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pillTitle} numberOfLines={1}>{timer.matter_title || "Active timer"}</Text>
        <Text style={styles.pillSub} numberOfLines={1}>{timer.activity?.replace("_", " ")}</Text>
      </View>
      <Text style={styles.pillTime}>{formatElapsed(elapsedMs)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.white} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.alert, marginRight: 4 },
  pillTitle: { color: colors.white, fontSize: 13, fontWeight: "700" },
  pillSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },
  pillTime: { color: colors.white, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
});

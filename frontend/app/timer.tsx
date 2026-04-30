import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatINR } from "../src/theme";
import { Button, Input, EmptyState, Badge } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

const ACTIVITIES = ["hearing", "drafting", "research", "client_call", "travel", "other"];

const formatElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function TimerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState<any>(null);
  const [matters, setMatters] = useState<any[]>([]);
  const [matterId, setMatterId] = useState("");
  const [activity, setActivity] = useState("drafting");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<any>(null);

  const load = async () => {
    try {
      const [t, m] = await Promise.all([
        api.get("/timer"),
        api.get("/matters", { params: { status: "active" } }),
      ]);
      if (t.data?.active) {
        setTimer(t.data.timer);
        setDescription(t.data.timer.description || "");
      } else {
        setTimer(null);
      }
      setMatters(m.data);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, []);

  // Tick every second when timer active
  useEffect(() => {
    if (timer) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer]);

  const start = async () => {
    if (!matterId) return Alert.alert("Select matter");
    setBusy(true);
    try {
      const res = await api.post("/timer/start", {
        matter_id: matterId,
        activity,
        description: description.trim() || null,
        is_billable: billable,
      });
      setTimer(res.data.timer);
    } catch (e: any) {
      Alert.alert("Could not start", e?.response?.data?.detail || "Try again");
    } finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const res = await api.post("/timer/stop", { description: description.trim() || null });
      const t = res.data;
      setTimer(null);
      Alert.alert("Time logged", `${t.duration_mins} min · ${formatINR(t.billed_amount)}`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Could not stop", e?.response?.data?.detail || "Try again");
    } finally { setBusy(false); }
  };

  const cancel = () => {
    Alert.alert("Cancel timer?", "The elapsed time will not be saved.", [
      { text: "Keep running", style: "cancel" },
      { text: "Cancel timer", style: "destructive", onPress: async () => {
        try { await api.post("/timer/cancel"); setTimer(null); } catch {}
      } },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Timer" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  // ACTIVE TIMER
  if (timer) {
    const elapsedMs = now - new Date(timer.started_at).getTime();
    const rate = timer.hourly_rate || 2500;
    const accruedAmount = (elapsedMs / 3600000) * rate;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <TopBar title="Timer running" subtitle="Time tracking" />
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}>
          <View style={styles.runningHero}>
            <View style={styles.pulse} />
            <Text style={[type.overline, { color: colors.inkMuted }]}>{timer.activity?.replace("_", " ").toUpperCase()}</Text>
            <Text style={styles.bigClock}>{formatElapsed(elapsedMs)}</Text>
            <Text style={[type.bodyMuted, { color: colors.inkMuted, marginTop: spacing.sm }]}>
              {timer.matter_title || "—"}
            </Text>
            {timer.client_name ? <Text style={[type.small, { color: colors.inkLight }]}>{timer.client_name}</Text> : null}
            {timer.is_billable && (
              <Text style={[type.h3, { marginTop: spacing.lg, color: colors.success }]}>
                +{formatINR(accruedAmount)} accrued
              </Text>
            )}
          </View>

          <View style={{ height: spacing.xl }} />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What are you working on?"
            multiline
            testID="timer-description"
          />

          <Button title="Stop & save" onPress={stop} loading={busy} icon="square" testID="timer-stop-btn" />
          <View style={{ height: spacing.md }} />
          <Button title="Cancel timer" variant="ghost" onPress={cancel} testID="timer-cancel-btn" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // START NEW TIMER
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <TopBar title="Start timer" subtitle="Time tracking" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.startHero}>
          <View style={styles.bigCircle}>
            <Ionicons name="timer-outline" size={48} color={colors.ink} />
          </View>
          <Text style={[type.h2, { marginTop: spacing.lg, color: colors.ink }]}>Track billable time</Text>
          <Text style={[type.bodyMuted, { color: colors.inkMuted, textAlign: "center", marginTop: spacing.sm }]}>
            Start a live timer for any matter. We'll calculate your billable amount automatically.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />
        <Text style={[type.overline, { marginBottom: spacing.sm, color: colors.inkMuted }]}>Matter</Text>
        {matters.length === 0 ? (
          <Text style={[type.bodyMuted, { color: colors.inkMuted }]}>No active matters. Create one first.</Text>
        ) : (
          <View style={styles.chipRow}>
            {matters.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setMatterId(m.id)}
                style={[styles.chip, matterId === m.id && styles.chipActive]}
                testID={`timer-matter-${m.id}`}
              >
                <Text style={[styles.chipText, matterId === m.id && styles.chipTextActive]} numberOfLines={1}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: spacing.lg }} />
        <Text style={[type.overline, { marginBottom: spacing.sm, color: colors.inkMuted }]}>Activity</Text>
        <View style={styles.chipRow}>
          {ACTIVITIES.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setActivity(a)}
              style={[styles.chip, activity === a && styles.chipActive]}
              testID={`timer-activity-${a}`}
            >
              <Text style={[styles.chipText, activity === a && styles.chipTextActive]}>{a.replace("_", " ")}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: spacing.lg }} />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Drafting written arguments"
          multiline
          testID="timer-start-description"
        />

        <TouchableOpacity onPress={() => setBillable(!billable)} style={styles.toggleRow} testID="timer-billable">
          <View style={[styles.checkbox, billable && styles.checkboxOn]}>
            {billable && <Text style={{ color: colors.white, fontWeight: "800" }}>✓</Text>}
          </View>
          <Text style={[type.body, { color: colors.ink }]}>Billable time</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.lg }} />
        <Button
          title="Start timer"
          onPress={start}
          loading={busy}
          icon="play"
          disabled={!matterId}
          testID="timer-start-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  runningHero: {
    alignItems: "center",
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 8,
    backgroundColor: colors.bg,
    marginTop: spacing.md,
    position: "relative",
  },
  pulse: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.alert,
  },
  bigClock: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.ink,
    marginTop: spacing.md,
    fontVariant: ["tabular-nums"],
  },
  startHero: { alignItems: "center", paddingVertical: spacing.xl },
  bigCircle: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMuted,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4, maxWidth: 220 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink, textTransform: "capitalize" },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 3 },
  checkboxOn: { backgroundColor: colors.ink },
});

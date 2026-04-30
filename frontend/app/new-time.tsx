import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

const ACTIVITIES = ["hearing", "drafting", "research", "client_call", "travel", "other"];

export default function NewTime() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matterId?: string }>();
  const [matters, setMatters] = useState<any[]>([]);
  const [matterId, setMatterId] = useState<string>(params.matterId || "");
  const [activity, setActivity] = useState("drafting");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [billable, setBillable] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/matters", { params: { status: "active" } }).then(r => setMatters(r.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!matterId) return Alert.alert("Select matter");
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    const total = h * 60 + m;
    if (total <= 0) return Alert.alert("Enter duration");
    setLoading(true);
    try {
      await api.post("/time-entries", {
        matter_id: matterId,
        activity,
        description: description.trim() || null,
        duration_mins: total,
        date,
        is_billable: billable,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Could not save", e?.response?.data?.detail || "Try again");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="Log time" subtitle="Time tracking" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Matter</Text>
          <View style={styles.chipRow}>
            {matters.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setMatterId(m.id)} style={[styles.chip, matterId === m.id && styles.chipActive]}>
                <Text style={[styles.chipText, matterId === m.id && styles.chipTextActive]} numberOfLines={1}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Activity</Text>
          <View style={styles.chipRow}>
            {ACTIVITIES.map((a) => (
              <TouchableOpacity key={a} onPress={() => setActivity(a)} style={[styles.chip, activity === a && styles.chipActive]}>
                <Text style={[styles.chipText, activity === a && styles.chipTextActive]}>{a.replace("_", " ")}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input label="Hours" value={hours} onChangeText={setHours} placeholder="2" keyboardType="numeric" testID="nt-hours" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Minutes" value={minutes} onChangeText={setMinutes} placeholder="30" keyboardType="numeric" testID="nt-minutes" />
            </View>
          </View>

          <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Brief note" multiline testID="nt-description" />

          <TouchableOpacity onPress={() => setBillable(!billable)} style={styles.toggleRow} testID="nt-billable">
            <View style={[styles.checkbox, billable && styles.checkboxOn]}>
              {billable && <Text style={{ color: colors.white, fontWeight: "800" }}>✓</Text>}
            </View>
            <Text style={type.body}>Billable</Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save entry" onPress={submit} loading={loading} testID="nt-save-btn" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink, textTransform: "capitalize" },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 3 },
  checkboxOn: { backgroundColor: colors.ink },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

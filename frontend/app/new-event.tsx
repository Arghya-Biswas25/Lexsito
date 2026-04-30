import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

const EVENT_TYPES = [
  { key: "hearing", label: "Hearing" },
  { key: "deadline", label: "Deadline" },
  { key: "appointment", label: "Appointment" },
  { key: "task", label: "Task" },
];

export default function NewEvent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matterId?: string }>();
  const [matters, setMatters] = useState<any[]>([]);
  const [matterId, setMatterId] = useState<string | null>(params.matterId || null);
  const [eventType, setEventType] = useState("hearing");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [courtName, setCourtName] = useState("");
  const [courtRoom, setCourtRoom] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/matters", { params: { status: "active" } }).then(r => setMatters(r.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!title.trim()) return Alert.alert("Title required");
    if (!date) return Alert.alert("Date required");
    setLoading(true);
    try {
      await api.post("/events", {
        matter_id: matterId || null,
        title: title.trim(),
        event_type: eventType,
        date,
        time: time.trim() || null,
        court_name: courtName.trim() || null,
        court_room: courtRoom.trim() || null,
        description: description.trim() || null,
        status: "scheduled",
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Could not save", e?.response?.data?.detail || "Try again");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="New event" subtitle="Calendar" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Type</Text>
          <View style={styles.chipRow}>
            {EVENT_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setEventType(t.key)} style={[styles.chip, eventType === t.key && styles.chipActive]} testID={`ne-type-${t.key}`}>
                <Text style={[styles.chipText, eventType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Hearing on property dispute" testID="ne-title" />
          <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-03-15" testID="ne-date" />
          {(eventType === "hearing" || eventType === "appointment") && (
            <Input label="Time (HH:MM)" value={time} onChangeText={setTime} placeholder="10:30" testID="ne-time" />
          )}

          {eventType === "hearing" && (
            <>
              <Input label="Court name" value={courtName} onChangeText={setCourtName} placeholder="Saket District Court" />
              <Input label="Court room" value={courtRoom} onChangeText={setCourtRoom} placeholder="Court No. 12" />
            </>
          )}

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Link to matter (optional)</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity onPress={() => setMatterId(null)} style={[styles.chip, !matterId && styles.chipActive]}>
              <Text style={[styles.chipText, !matterId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {matters.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setMatterId(m.id)} style={[styles.chip, matterId === m.id && styles.chipActive]}>
                <Text style={[styles.chipText, matterId === m.id && styles.chipTextActive]} numberOfLines={1}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Input label="Description" value={description} onChangeText={setDescription} multiline />
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save event" onPress={submit} loading={loading} testID="ne-save-btn" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4, maxWidth: "100%" },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.white },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

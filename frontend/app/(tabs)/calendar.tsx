import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SectionList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatDate, formatDateShort } from "../../src/theme";
import { api } from "../../src/api";
import { Badge, EmptyState } from "../../src/ui";

type EventItem = {
  id: string;
  title: string;
  event_type: string;
  date: string;
  time?: string;
  court_name?: string;
  court_room?: string;
  status: string;
  matter_title?: string;
  client_name?: string;
};

const TYPE_ICON: Record<string, any> = {
  hearing: "hammer-outline",
  deadline: "alarm-outline",
  appointment: "person-outline",
  task: "checkmark-circle-outline",
};

const TYPE_TONE: Record<string, "info" | "alert" | "success" | "warning" | "neutral"> = {
  hearing: "info",
  deadline: "alert",
  appointment: "success",
  task: "warning",
};

export default function Calendar() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const today = new Date();
      const start = today.toISOString().slice(0, 10);
      const end = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);
      const res = await api.get("/events", { params: { start, end } });
      setEvents(res.data);
    } catch (e) { console.log(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(() => {
    const grouped: Record<string, EventItem[]> = {};
    for (const e of events) {
      const key = e.date;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }
    return Object.keys(grouped).sort().map((k) => ({ title: k, data: grouped[k] }));
  }, [events]);

  const labelForDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 7 && diff > 0) return d.toLocaleDateString("en-IN", { weekday: "long" });
    return formatDate(dateStr);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Schedule</Text>
          <Text style={type.h1} testID="calendar-title">Calendar</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/new-event")} style={styles.addBtn} testID="calendar-new-btn">
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No upcoming events"
            subtitle="Add a hearing, deadline, or appointment."
            action={
              <TouchableOpacity onPress={() => router.push("/new-event")} style={styles.emptyBtn} testID="calendar-empty-new">
                <Text style={{ color: colors.white, fontWeight: "700" }}>+ Add event</Text>
              </TouchableOpacity>
            }
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionDate}>{labelForDate(title)}</Text>
            <Text style={styles.sectionSub}>{formatDate(title)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.eventRow}
            onPress={() => {
              if (item.matter_id) router.push({ pathname: "/matter/[id]", params: { id: (item as any).matter_id } });
            }}
            testID={`event-item-${item.id}`}
          >
            <View style={styles.typeBadge}>
              <Ionicons name={TYPE_ICON[item.event_type] || "calendar-outline"} size={16} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: 3 }}>
                <Badge tone={TYPE_TONE[item.event_type]}>{item.event_type}</Badge>
                {item.time ? <Text style={[type.small, { fontWeight: "700", color: colors.ink }]}>{item.time}</Text> : null}
              </View>
              <Text style={type.h3} numberOfLines={2}>{item.matter_title || item.title}</Text>
              {(item.matter_title && item.title !== item.matter_title) && <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{item.title}</Text>}
              {item.court_name ? <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{item.court_name}{item.court_room ? ` · ${item.court_room}` : ""}</Text> : null}
              {item.client_name ? <Text style={[type.small, { marginTop: 2, color: colors.inkLight }]} numberOfLines={1}>{item.client_name}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg,
  },
  addBtn: {
    width: 44, height: 44, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 4,
  },
  sectionHead: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  sectionDate: { fontSize: 18, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 1 },
  eventRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderTopWidth: 1, borderColor: colors.border,
    gap: spacing.md,
  },
  typeBadge: {
    width: 36, height: 36, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", borderRadius: 4,
  },
  emptyBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
});

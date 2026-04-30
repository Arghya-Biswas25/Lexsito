import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SectionList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatDate, useTheme } from "../../src/theme";
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
  matter_id?: string;
};

const TYPE_ICON: Record<string, any> = {
  hearing: "hammer-outline",
  deadline: "alarm-outline",
  appointment: "person-outline",
  task: "checkmark-circle-outline",
};
const TYPE_TONE: Record<string, any> = { hearing: "info", deadline: "alert", appointment: "success", task: "warning" };

export default function Calendar() {
  const router = useRouter();
  const { mode } = useTheme();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const start = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0).toISOString().slice(0, 10);
      const res = await api.get("/events", { params: { start, end } });
      setEvents(res.data);
    } catch (e) { console.log(e); }
  }, [cursor]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const styles = useMemo(() => createStyles(), [mode]);

  // --- Month grid computation ---
  const monthData = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startWeekday = first.getDay(); // Sun=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ date: string | null; events: EventItem[] }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(y, m, d).toISOString().slice(0, 10);
      const dayEvents = events.filter(e => e.date === iso);
      cells.push({ date: iso, events: dayEvents });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, events: [] });
    return cells;
  }, [cursor, events]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const changeMonth = (delta: number) => {
    setSelectedDate(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  // Agenda sections (future events only from cursor month onward)
  const agendaSections = useMemo(() => {
    const startIso = new Date().toISOString().slice(0, 10);
    const source = selectedDate ? events.filter(e => e.date === selectedDate) : events.filter(e => e.date >= startIso);
    const grouped: Record<string, EventItem[]> = {};
    source.forEach(e => { (grouped[e.date] ||= []).push(e); });
    return Object.keys(grouped).sort().map(k => ({ title: k, data: grouped[k] }));
  }, [events, selectedDate]);

  const labelForDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 7 && diff > 0) return d.toLocaleDateString("en-IN", { weekday: "long" });
    return formatDate(dateStr);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.overline, { color: colors.inkMuted }]}>Schedule</Text>
          <Text style={[type.h1, { color: colors.ink }]} testID="calendar-title">Calendar</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/new-event")} style={[styles.addBtn, { backgroundColor: colors.ink }]} testID="calendar-new-btn">
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={[styles.toggle, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.togglePill, view === "month" && { backgroundColor: colors.ink }]}
          onPress={() => setView("month")}
          testID="cal-view-month"
        >
          <Text style={[styles.togglePillText, { color: view === "month" ? colors.onPrimary : colors.inkMuted }]}>Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.togglePill, view === "agenda" && { backgroundColor: colors.ink }]}
          onPress={() => { setView("agenda"); setSelectedDate(null); }}
          testID="cal-view-agenda"
        >
          <Text style={[styles.togglePillText, { color: view === "agenda" ? colors.onPrimary : colors.inkMuted }]}>Agenda</Text>
        </TouchableOpacity>
      </View>

      {view === "month" ? (
        <>
          {/* Month nav */}
          <View style={[styles.monthNav, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => changeMonth(-1)} testID="cal-prev" style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </TouchableOpacity>
            <Text style={[type.h3, { color: colors.ink }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} testID="cal-next" style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekHead}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(w => (
              <Text key={w} style={[styles.weekHeadText, { color: colors.inkMuted }]}>{w.toUpperCase()}</Text>
            ))}
          </View>

          {/* Month grid */}
          <View style={[styles.grid, { borderColor: colors.border }]}>
            {monthData.map((cell, idx) => {
              const isToday = cell.date === todayIso;
              const isSelected = cell.date === selectedDate;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dayCell, { borderColor: colors.border }, isSelected && { backgroundColor: colors.bgSubtle }]}
                  disabled={!cell.date}
                  onPress={() => cell.date && setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                  testID={cell.date ? `cal-day-${cell.date}` : undefined}
                >
                  {cell.date ? (
                    <>
                      <Text style={[
                        styles.dayNum,
                        { color: colors.ink },
                        isToday && { backgroundColor: colors.ink, color: colors.onPrimary, width: 22, height: 22, textAlign: "center", lineHeight: 22, borderRadius: 11, overflow: "hidden" as any },
                      ]}>{parseInt(cell.date.slice(8, 10), 10)}</Text>
                      <View style={styles.dotsRow}>
                        {cell.events.slice(0, 4).map((e, i) => (
                          <View key={i} style={[styles.dot, {
                            backgroundColor:
                              e.event_type === "hearing" ? colors.info
                              : e.event_type === "deadline" ? colors.alert
                              : e.event_type === "appointment" ? colors.success
                              : colors.highlight,
                          }]} />
                        ))}
                      </View>
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Events for selected day */}
          {selectedDate && (
            <View style={{ paddingTop: spacing.md, flex: 1 }}>
              <Text style={[type.overline, { paddingHorizontal: spacing.xl, marginBottom: spacing.sm, color: colors.inkMuted }]}>
                {labelForDate(selectedDate)}
              </Text>
              <FlatList
                data={agendaSections[0]?.data || []}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<Text style={[type.bodyMuted, { paddingHorizontal: spacing.xl, color: colors.inkMuted }]}>No events this day.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.eventRow, { borderColor: colors.border }]}
                    onPress={() => item.matter_id && router.push({ pathname: "/matter/[id]", params: { id: item.matter_id } })}
                  >
                    <View style={[styles.typeBadge, { borderColor: colors.border }]}>
                      <Ionicons name={TYPE_ICON[item.event_type] || "calendar-outline"} size={16} color={colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: 3 }}>
                        <Badge tone={TYPE_TONE[item.event_type]}>{item.event_type}</Badge>
                        {item.time ? <Text style={[type.small, { fontWeight: "700", color: colors.ink }]}>{item.time}</Text> : null}
                      </View>
                      <Text style={[type.h3, { color: colors.ink }]} numberOfLines={2}>{item.matter_title || item.title}</Text>
                      {item.court_name ? <Text style={[type.small, { color: colors.inkMuted, marginTop: 2 }]}>{item.court_name}{item.court_room ? ` · ${item.court_room}` : ""}</Text> : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </>
      ) : (
        <SectionList
          sections={agendaSections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.ink} />}
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" title="No upcoming events" subtitle="Add a hearing, deadline, or appointment." />
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHead, { backgroundColor: colors.bg }]}>
              <Text style={[styles.sectionDate, { color: colors.ink }]}>{labelForDate(title)}</Text>
              <Text style={[styles.sectionSub, { color: colors.inkMuted }]}>{formatDate(title)}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.eventRow, { borderColor: colors.border }]}
              onPress={() => item.matter_id && router.push({ pathname: "/matter/[id]", params: { id: item.matter_id } })}
              testID={`event-item-${item.id}`}
            >
              <View style={[styles.typeBadge, { borderColor: colors.border }]}>
                <Ionicons name={TYPE_ICON[item.event_type] || "calendar-outline"} size={16} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: 3 }}>
                  <Badge tone={TYPE_TONE[item.event_type]}>{item.event_type}</Badge>
                  {item.time ? <Text style={[type.small, { fontWeight: "700", color: colors.ink }]}>{item.time}</Text> : null}
                </View>
                <Text style={[type.h3, { color: colors.ink }]} numberOfLines={2}>{item.matter_title || item.title}</Text>
                {item.court_name ? <Text style={[type.small, { color: colors.inkMuted, marginTop: 2 }]}>{item.court_name}{item.court_room ? ` · ${item.court_room}` : ""}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  addBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  toggle: {
    flexDirection: "row", marginHorizontal: spacing.xl, borderWidth: 1, borderRadius: 4, padding: 2, gap: 2,
  },
  togglePill: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 3 },
  togglePillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1 },
  navBtn: { padding: 8 },
  weekHead: { flexDirection: "row", paddingHorizontal: spacing.xl, paddingVertical: 8 },
  weekHeadText: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: spacing.xl, borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, borderRightWidth: 1, borderBottomWidth: 1, padding: 4, alignItems: "flex-start" },
  dayNum: { fontSize: 13, fontWeight: "600" },
  dotsRow: { flexDirection: "row", gap: 2, marginTop: "auto", flexWrap: "wrap" },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  sectionHead: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionDate: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  eventRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, gap: spacing.md },
  typeBadge: { width: 36, height: 36, borderWidth: 1, alignItems: "center", justifyContent: "center", borderRadius: 4 },
});

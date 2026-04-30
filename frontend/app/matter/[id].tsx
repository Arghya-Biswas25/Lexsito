import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatINR, formatDate, formatDateShort } from "../../src/theme";
import { Badge, Button, EmptyState } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";

const TABS = ["overview", "notes", "timeline", "time", "billing"] as const;
type Tab = typeof TABS[number];

export default function MatterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [newNote, setNewNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/matters/${id}`);
      setData(res.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post("/notes", { matter_id: id, content: newNote.trim(), note_type: "general" });
      setNewNote("");
      load();
    } catch (e: any) {
      Alert.alert("Could not save note");
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <TopBar title="Matter" />
      </SafeAreaView>
    );
  }

  const totalBilled = (data.invoices || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
  const totalPaid = (data.invoices || []).reduce((s: number, i: any) => s + (i.paid_amount || 0), 0);
  const unbilledAmount = (data.time_entries || []).filter((t: any) => !t.invoice_id && t.is_billable).reduce((s: number, t: any) => s + (t.billed_amount || 0), 0);
  const totalHours = ((data.time_entries || []).reduce((s: number, t: any) => s + (t.duration_mins || 0), 0) / 60).toFixed(1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title={data.title} subtitle={data.client?.name || "Matter"} />

      {/* Matter info strip */}
      <View style={styles.infoStrip}>
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm }}>
          <Badge tone="neutral">{data.matter_type}</Badge>
          <Badge tone="info">{data.stage}</Badge>
          <Badge tone={data.status === "active" ? "success" : "neutral"}>{data.status}</Badge>
        </View>
        {data.case_number ? <Text style={[type.small, { marginBottom: 2 }]}>Case: {data.case_number}</Text> : null}
        {data.court_name ? <Text style={[type.small, { marginBottom: 2 }]}>{data.court_name}{data.court_room ? ` · ${data.court_room}` : ""}</Text> : null}
        {data.opposing_party ? <Text style={type.small}>vs {data.opposing_party}</Text> : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]} testID={`matter-tab-${t}`}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {tab === "overview" && (
          <View style={styles.section}>
            {/* Stat grid */}
            <View style={styles.statGrid}>
              <View style={[styles.statCell, { borderRightWidth: 1, borderBottomWidth: 1 }]}>
                <Text style={type.overline}>Hours logged</Text>
                <Text style={type.metric}>{totalHours}</Text>
              </View>
              <View style={[styles.statCell, { borderBottomWidth: 1 }]}>
                <Text style={type.overline}>Unbilled</Text>
                <Text style={type.metric}>{formatINR(unbilledAmount)}</Text>
              </View>
              <View style={[styles.statCell, { borderRightWidth: 1 }]}>
                <Text style={type.overline}>Billed</Text>
                <Text style={type.metric}>{formatINR(totalBilled)}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={type.overline}>Paid</Text>
                <Text style={[type.metric, { color: colors.success }]}>{formatINR(totalPaid)}</Text>
              </View>
            </View>

            <View style={{ padding: spacing.xl, gap: spacing.md }}>
              <Button title="+ Log time" icon="time-outline" variant="secondary" onPress={() => router.push({ pathname: "/new-time", params: { matterId: id } })} testID="md-log-time" />
              <Button title="+ Add note" icon="document-text-outline" variant="secondary" onPress={() => setTab("notes")} testID="md-add-note-nav" />
              <Button title="+ Add event" icon="calendar-outline" variant="secondary" onPress={() => router.push({ pathname: "/new-event", params: { matterId: id } })} testID="md-add-event" />
              <Button title="Create invoice" icon="receipt-outline" onPress={() => router.push({ pathname: "/new-invoice", params: { matterId: id } })} testID="md-create-invoice" />
            </View>

            {data.events?.length ? (
              <>
                <Text style={[type.overline, { paddingHorizontal: spacing.xl, marginTop: spacing.md }]}>Upcoming</Text>
                {data.events.slice(0, 3).map((e: any) => (
                  <View key={e.id} style={styles.row}>
                    <Ionicons name={e.event_type === "hearing" ? "hammer-outline" : "alarm-outline"} size={16} color={colors.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.body} numberOfLines={1}>{e.title}</Text>
                      <Text style={type.small}>{formatDate(e.date)}{e.time ? ` · ${e.time}` : ""}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        )}

        {tab === "notes" && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <TextInput
                  value={newNote}
                  onChangeText={setNewNote}
                  placeholder="Add a note..."
                  placeholderTextColor={colors.inkLight}
                  multiline
                  style={styles.noteInput}
                  testID="md-note-input"
                />
                <TouchableOpacity onPress={addNote} style={styles.noteBtn} testID="md-note-save">
                  <Ionicons name="arrow-up" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
            {(data.notes || []).length === 0 ? (
              <EmptyState icon="document-text-outline" title="No notes yet" subtitle="Capture hearing outcomes, instructions, and reminders." />
            ) : (
              (data.notes || []).map((n: any) => (
                <View key={n.id} style={styles.noteRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>{n.content}</Text>
                    <Text style={[type.small, { marginTop: 4 }]}>{formatDate(n.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </KeyboardAvoidingView>
        )}

        {tab === "timeline" && (
          <View style={{ padding: spacing.xl }}>
            {[...(data.events || []), ...(data.notes || []).map((n: any) => ({ ...n, event_type: "note", date: n.created_at, title: n.content?.slice(0, 60) }))]
              .sort((a: any, b: any) => new Date(a.date || a.created_at).getTime() - new Date(b.date || b.created_at).getTime())
              .map((item: any, idx: number) => (
                <View key={idx} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.overline}>{item.event_type}</Text>
                    <Text style={type.body} numberOfLines={2}>{item.title}</Text>
                    <Text style={type.small}>{formatDateShort(item.date || item.created_at)}</Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {tab === "time" && (
          <>
            {(data.time_entries || []).length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="No time logged"
                subtitle="Track billable hours to generate invoices."
                action={<TouchableOpacity onPress={() => router.push({ pathname: "/new-time", params: { matterId: id } })} style={styles.inkBtn}><Text style={{ color: colors.white, fontWeight: "700" }}>+ Log time</Text></TouchableOpacity>}
              />
            ) : (
              (data.time_entries || []).map((t: any) => (
                <View key={t.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>{t.activity.replace("_", " ")} · {Math.floor(t.duration_mins / 60)}h {t.duration_mins % 60}m</Text>
                    {t.description ? <Text style={type.small}>{t.description}</Text> : null}
                    <Text style={type.small}>{formatDate(t.date)}{t.invoice_id ? " · billed" : " · unbilled"}</Text>
                  </View>
                  <Text style={type.h3}>{formatINR(t.billed_amount || 0)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === "billing" && (
          <>
            <View style={{ padding: spacing.xl }}>
              <Button title="Create invoice" onPress={() => router.push({ pathname: "/new-invoice", params: { matterId: id } })} testID="md-billing-create" />
            </View>
            {(data.invoices || []).length === 0 ? (
              <EmptyState icon="receipt-outline" title="No invoices" subtitle="Bill time entries or disbursements." />
            ) : (
              (data.invoices || []).map((inv: any) => {
                const out = (inv.total_amount || 0) - (inv.paid_amount || 0);
                return (
                  <TouchableOpacity key={inv.id} style={styles.row} onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>{inv.invoice_number}</Text>
                      <Text style={type.small}>Issued {formatDate(inv.issue_date)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={type.h3}>{formatINR(inv.total_amount)}</Text>
                      <Badge tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "alert" : "info"}>{inv.status}</Badge>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  infoStrip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted },
  tabs: { flexDirection: "row", backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: colors.ink },
  tabText: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tabTextActive: { color: colors.ink },
  section: {},
  statGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: colors.border },
  statCell: { width: "50%", padding: spacing.lg, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  noteInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 60, borderRadius: 4, fontSize: 14,
  },
  noteBtn: { width: 44, height: 44, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  noteRow: { padding: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  timelineRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, marginTop: 8 },
  inkBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
});

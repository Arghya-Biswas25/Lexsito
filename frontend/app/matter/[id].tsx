import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, KeyboardAvoidingView, Platform, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, type, formatINR, formatDate, formatDateShort, useTheme } from "../../src/theme";
import { Badge, Button, EmptyState } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";

const TABS = ["overview", "notes", "drafts", "docs", "time", "billing"] as const;
type Tab = typeof TABS[number];

const DOC_CATEGORIES = [
  { key: "all", label: "All", icon: "folder-outline" as const },
  { key: "pleadings", label: "Pleadings", icon: "document-text-outline" as const },
  { key: "orders", label: "Orders", icon: "hammer-outline" as const },
  { key: "evidence", label: "Evidence", icon: "albums-outline" as const },
  { key: "correspondence", label: "Letters", icon: "mail-outline" as const },
  { key: "other", label: "Other", icon: "ellipsis-horizontal" as const },
];

export default function MatterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [drafts, setDrafts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [docCategory, setDocCategory] = useState<string>("all");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [matter, draftsRes, docsRes] = await Promise.all([
        api.get(`/matters/${id}`),
        api.get("/drafts", { params: { matter_id: id } }),
        api.get("/documents", { params: { matter_id: id } }),
      ]);
      setData(matter.data);
      setDrafts(draftsRes.data);
      setDocs(docsRes.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post("/notes", { matter_id: id, content: newNote.trim(), note_type: "general" });
      setNewNote("");
      load();
    } catch { Alert.alert("Could not save note"); }
  };

  const pickDocument = async (category: string = "other") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        return Alert.alert("Too large", "Max file size is 10 MB.");
      }
      setUploading(true);
      let base64 = "";
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const FileSystem = await import("expo-file-system").catch(() => null as any);
        if (FileSystem?.readAsStringAsync) {
          const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
          const prefix = asset.mimeType ? `data:${asset.mimeType};base64,` : "data:application/octet-stream;base64,";
          base64 = prefix + content;
        } else {
          throw new Error("File reading not available");
        }
      }
      const fileType = asset.mimeType?.startsWith("image/") ? "image" : asset.mimeType === "application/pdf" ? "pdf" : "other";
      await api.post("/documents", {
        matter_id: id,
        name: asset.name,
        file_type: fileType,
        mime_type: asset.mimeType || "application/octet-stream",
        file_size: asset.size || 0,
        base64,
        category,
      });
      await load();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Try again");
    } finally { setUploading(false); }
  };

  const deleteDoc = (docId: string, name: string) => {
    Alert.alert("Delete document?", name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/documents/${docId}`); load(); } catch {}
      } },
    ]);
  };

  if (!data) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}><TopBar title="Matter" /></SafeAreaView>;
  }

  const totalBilled = (data.invoices || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
  const totalPaid = (data.invoices || []).reduce((s: number, i: any) => s + (i.paid_amount || 0), 0);
  const unbilledAmount = (data.time_entries || []).filter((t: any) => !t.invoice_id && t.is_billable).reduce((s: number, t: any) => s + (t.billed_amount || 0), 0);
  const totalHours = ((data.time_entries || []).reduce((s: number, t: any) => s + (t.duration_mins || 0), 0) / 60).toFixed(1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title={data.title} subtitle={data.client?.name || "Matter"} />

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={{ flexGrow: 0 }}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]} testID={`matter-tab-${t}`}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {tab === "overview" && (
          <View>
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
              <Button title="+ Add event" icon="calendar-outline" variant="secondary" onPress={() => router.push({ pathname: "/new-event", params: { matterId: id } })} testID="md-add-event" />
              <Button title="+ New draft (AI)" icon="sparkles" variant="secondary" onPress={() => router.push({ pathname: "/new-draft", params: { matterId: id } })} testID="md-new-draft" />
              <Button title="Create invoice" icon="receipt-outline" onPress={() => router.push({ pathname: "/new-invoice", params: { matterId: id } })} testID="md-create-invoice" />
            </View>
          </View>
        )}

        {tab === "notes" && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
              <EmptyState icon="document-text-outline" title="No notes yet" subtitle="Capture hearing outcomes and instructions." />
            ) : (
              (data.notes || []).map((n: any) => (
                <View key={n.id} style={styles.noteRow}>
                  <Text style={type.body}>{n.content}</Text>
                  <Text style={[type.small, { marginTop: 4 }]}>{formatDate(n.created_at)}</Text>
                </View>
              ))
            )}
          </KeyboardAvoidingView>
        )}

        {tab === "drafts" && (
          <>
            <View style={{ padding: spacing.xl }}>
              <Button title="+ New AI draft" icon="sparkles" onPress={() => router.push({ pathname: "/new-draft", params: { matterId: id } })} testID="md-drafts-new" />
            </View>
            {drafts.length === 0 ? (
              <EmptyState icon="document-text-outline" title="No drafts yet" subtitle="Generate court-ready drafts with AI assistance." />
            ) : (
              drafts.map((d) => (
                <TouchableOpacity key={d.id} style={styles.row} onPress={() => router.push({ pathname: "/draft/[id]", params: { id: d.id } })} testID={`md-draft-${d.id}`}>
                  <View style={{ width: 36, height: 36, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", borderRadius: 4 }}>
                    <Ionicons name="document-text-outline" size={18} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body} numberOfLines={1}>{d.title}</Text>
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4 }}>
                      <Badge tone="neutral">{d.document_type.replace("_", " ")}</Badge>
                      <Badge tone={d.status === "filed" ? "success" : d.status === "ready" ? "info" : "neutral"}>{d.status}</Badge>
                    </View>
                    <Text style={[type.small, { marginTop: 4 }]}>v{d.version} · {formatDate(d.updated_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkLight} />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {tab === "docs" && (
          <>
            {/* Category folders */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              {DOC_CATEGORIES.map((c) => {
                const count = c.key === "all" ? docs.length : docs.filter(d => d.category === c.key).length;
                const active = docCategory === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setDocCategory(c.key)}
                    style={[styles.catChip, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}
                    testID={`docs-cat-${c.key}`}
                  >
                    <Ionicons name={c.icon} size={14} color={active ? colors.white : colors.ink} />
                    <Text style={[styles.catLabel, { color: active ? colors.white : colors.ink }]}>{c.label}</Text>
                    {count > 0 && <View style={[styles.catBadge, active && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: active ? colors.white : colors.ink }}>{count}</Text>
                    </View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ padding: spacing.xl }}>
              <Button
                title={uploading ? "Uploading..." : `+ Upload to ${docCategory === "all" ? "Other" : DOC_CATEGORIES.find(c => c.key === docCategory)?.label}`}
                icon="cloud-upload-outline"
                onPress={() => pickDocument(docCategory === "all" ? "other" : docCategory)}
                loading={uploading}
                testID="md-docs-upload"
              />
              <Text style={[type.small, { marginTop: 8, textAlign: "center" }]}>PDF, JPG, PNG · max 10 MB</Text>
            </View>
            {(() => {
              const filtered = docCategory === "all" ? docs : docs.filter(d => d.category === docCategory);
              if (filtered.length === 0) {
                return <EmptyState icon="folder-outline" title="No documents" subtitle={`Upload ${docCategory === "all" ? "pleadings, orders, evidence, or correspondence" : DOC_CATEGORIES.find(c => c.key === docCategory)?.label.toLowerCase()}.`} />;
              }
              return filtered.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: "/document/[id]", params: { id: d.id } })}
                  onLongPress={() => deleteDoc(d.id, d.name)}
                  testID={`md-doc-${d.id}`}
                >
                  <View style={{ width: 36, height: 36, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", borderRadius: 4 }}>
                    <Ionicons name={d.file_type === "pdf" ? "document-outline" : d.file_type === "image" ? "image-outline" : "document-attach-outline"} size={18} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body} numberOfLines={1}>{d.name}</Text>
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 3, alignItems: "center" }}>
                      <Badge tone="neutral">{d.category || "other"}</Badge>
                      <Text style={type.small}>{(d.file_size / 1024).toFixed(0)} KB · {formatDate(d.uploaded_at)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkLight} />
                </TouchableOpacity>
              ));
            })()}
          </>
        )}

        {tab === "time" && (
          <>
            {(data.time_entries || []).length === 0 ? (
              <EmptyState icon="time-outline" title="No time logged" subtitle="Track billable hours." action={
                <TouchableOpacity onPress={() => router.push({ pathname: "/new-time", params: { matterId: id } })} style={styles.inkBtn}>
                  <Text style={{ color: colors.white, fontWeight: "700" }}>+ Log time</Text>
                </TouchableOpacity>
              } />
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
              <EmptyState icon="receipt-outline" title="No invoices" subtitle="Bill time or disbursements." />
            ) : (
              (data.invoices || []).map((inv: any) => (
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
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  infoStrip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted },
  tabScroll: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border, maxHeight: 46 },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: 12, alignItems: "center", minWidth: 80 },
  tabActive: { borderBottomWidth: 2, borderColor: colors.ink },
  tabText: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tabTextActive: { color: colors.ink },
  statGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: colors.border },
  statCell: { width: "50%", padding: spacing.lg, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  noteInput: { flex: 1, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 60, borderRadius: 4, fontSize: 14 },
  noteBtn: { width: 44, height: 44, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  noteRow: { padding: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  inkBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
  catRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm, flexDirection: "row" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginRight: spacing.sm },
  catLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  catBadge: { minWidth: 20, height: 18, backgroundColor: colors.bgMuted, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});

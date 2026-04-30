import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, type, formatDate } from "../../src/theme";
import { Button, Badge } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";
import { Ionicons } from "@expo/vector-icons";

const STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "ready", label: "Ready" },
  { key: "filed", label: "Filed" },
];

export default function DraftEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/drafts/${id}`);
      setData(res.data);
      setContent(res.data.content || "");
      setTitle(res.data.title || "");
      setStatus(res.data.status || "draft");
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (nextStatus?: string) => {
    if (!data) return;
    setSaving(true);
    try {
      await api.put(`/drafts/${id}`, {
        matter_id: data.matter_id,
        title,
        document_type: data.document_type,
        content,
        status: nextStatus || status,
      });
      if (nextStatus) setStatus(nextStatus);
      await load();
    } catch (e) {
      Alert.alert("Could not save");
    } finally { setSaving(false); }
  };

  const runAI = async (mode: "strengthen" | "simplify" | "formalize") => {
    const { start, end } = selectionRef.current;
    let selected = "";
    if (end > start) {
      selected = content.substring(start, end);
    }
    if (!selected) {
      Alert.alert("Select text first", "Highlight a passage in the editor, then try AI assist again.");
      setShowAIMenu(false);
      return;
    }
    setAiLoading(true);
    setShowAIMenu(false);
    try {
      const res = await api.post("/ai/strengthen", { text: selected, mode });
      const replacement = res.data.content || selected;
      const newContent = content.substring(0, start) + replacement + content.substring(end);
      setContent(newContent);
    } catch (e: any) {
      Alert.alert("AI failed", e?.response?.data?.detail || "Try again");
    } finally { setAiLoading(false); }
  };

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <TopBar title="Draft" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title={title || "Untitled"} subtitle={data.document_type.replace("_", " ")} right={
        <TouchableOpacity onPress={() => save()} disabled={saving} testID="draft-save-btn" style={styles.topBtn}>
          {saving ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ink }}>Save</Text>}
        </TouchableOpacity>
      } />

      {/* Status + Matter */}
      <View style={styles.metaStrip}>
        <View style={styles.chipRow}>
          {STATUSES.map((s) => (
            <TouchableOpacity key={s.key} onPress={() => save(s.key)} style={[styles.chip, status === s.key && styles.chipActive]} testID={`draft-status-${s.key}`}>
              <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[type.small, { marginTop: 6 }]}>{data.matter?.title} · v{data.version} · {wordCount} words</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* Title input */}
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Draft title"
            style={styles.titleInput}
            testID="draft-title-input"
          />
        </View>

        <TextInput
          value={content}
          onChangeText={setContent}
          onSelectionChange={(e) => { selectionRef.current = e.nativeEvent.selection; }}
          placeholder="Start drafting..."
          placeholderTextColor={colors.inkLight}
          multiline
          style={styles.editor}
          textAlignVertical="top"
          testID="draft-content-input"
        />

        {/* AI bottom bar */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={() => setShowAIMenu(!showAIMenu)}
            disabled={aiLoading}
            testID="draft-ai-btn"
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: "700", marginLeft: 6 }}>AI assist</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[type.small, { marginLeft: spacing.md, flex: 1 }]}>Select text, then tap AI</Text>
        </View>

        {showAIMenu && (
          <View style={styles.aiMenu}>
            <TouchableOpacity style={styles.aiMenuRow} onPress={() => runAI("strengthen")} testID="ai-strengthen">
              <Ionicons name="trending-up" size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.body}>Strengthen</Text>
                <Text style={type.small}>Sharper legal English</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiMenuRow} onPress={() => runAI("formalize")} testID="ai-formalize">
              <Ionicons name="briefcase" size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.body}>Formalize</Text>
                <Text style={type.small}>Court-ready tone</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiMenuRow} onPress={() => runAI("simplify")} testID="ai-simplify">
              <Ionicons name="color-wand-outline" size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.body}>Simplify</Text>
                <Text style={type.small}>Plain client-friendly English</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBtn: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.ink, borderRadius: 4 },
  metaStrip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 4, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  chipTextActive: { color: colors.white },
  titleInput: { fontSize: 20, fontWeight: "700", color: colors.ink, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  editor: { flex: 1, fontSize: 15, lineHeight: 23, color: colors.ink, padding: spacing.xl, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  toolbar: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  aiBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 4 },
  aiMenu: { position: "absolute", bottom: 60, left: spacing.md, right: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink, borderRadius: 4 },
  aiMenuRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
});

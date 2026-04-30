import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";
import { Ionicons } from "@expo/vector-icons";

const DOC_TYPES = [
  { key: "plaint", label: "Plaint" },
  { key: "legal_notice", label: "Legal Notice" },
  { key: "bail_application", label: "Bail Application" },
  { key: "written_statement", label: "Written Statement" },
  { key: "vakalatnama", label: "Vakalatnama" },
  { key: "affidavit", label: "Affidavit" },
  { key: "other", label: "Other" },
];

export default function NewDraft() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matterId?: string }>();
  const [matters, setMatters] = useState<any[]>([]);
  const [matterId, setMatterId] = useState<string>(params.matterId || "");
  const [documentType, setDocumentType] = useState("legal_notice");
  const [title, setTitle] = useState("");
  const [facts, setFacts] = useState("");
  const [mode, setMode] = useState<"ai" | "blank">("ai");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get("/matters", { params: { status: "active" } }).then(r => setMatters(r.data)).catch(() => {});
  }, []);

  const proceed = async () => {
    if (!matterId) return Alert.alert("Select matter");
    if (!title.trim()) return Alert.alert("Title required");
    setGenerating(true);
    try {
      let content = "";
      if (mode === "ai") {
        if (!facts.trim()) {
          setGenerating(false);
          return Alert.alert("Enter facts to generate");
        }
        const matter = matters.find(m => m.id === matterId);
        const clientRes = matter ? await api.get(`/clients/${matter.client_id}`).catch(() => null) : null;
        const res = await api.post("/ai/draft-from-facts", {
          document_type: documentType,
          facts: facts.trim(),
          matter_id: matterId,
          court_name: matter?.court_name,
          case_number: matter?.case_number,
          client_name: clientRes?.data?.name,
          opposing_party: matter?.opposing_party,
        });
        content = res.data.content || "";
      }
      // Create draft
      const saved = await api.post("/drafts", {
        matter_id: matterId,
        title: title.trim(),
        document_type: documentType,
        content,
        status: "draft",
      });
      router.replace({ pathname: "/draft/[id]", params: { id: saved.data.id } });
    } catch (e: any) {
      Alert.alert("Could not create draft", e?.response?.data?.detail || "Try again");
    } finally { setGenerating(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="New draft" subtitle="Drafting Studio" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Matter</Text>
          <View style={styles.chipRow}>
            {matters.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setMatterId(m.id)} style={[styles.chip, matterId === m.id && styles.chipActive]} testID={`nd-matter-${m.id}`}>
                <Text style={[styles.chipText, matterId === m.id && styles.chipTextActive]} numberOfLines={1}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Document type</Text>
          <View style={styles.chipRow}>
            {DOC_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setDocumentType(t.key)} style={[styles.chip, documentType === t.key && styles.chipActive]} testID={`nd-type-${t.key}`}>
                <Text style={[styles.chipText, documentType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Input label="Draft title" value={title} onChangeText={setTitle} placeholder="e.g. Legal Notice to Mr. Sharma" testID="nd-title" />

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>How would you like to start?</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeCard, mode === "ai" && styles.modeCardActive]} onPress={() => setMode("ai")} testID="nd-mode-ai">
              <Ionicons name="sparkles" size={18} color={mode === "ai" ? colors.white : colors.ink} />
              <Text style={[styles.modeTitle, mode === "ai" && { color: colors.white }]}>AI draft</Text>
              <Text style={[styles.modeSub, mode === "ai" && { color: "rgba(255,255,255,0.8)" }]}>From facts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeCard, mode === "blank" && styles.modeCardActive]} onPress={() => setMode("blank")} testID="nd-mode-blank">
              <Ionicons name="document-outline" size={18} color={mode === "blank" ? colors.white : colors.ink} />
              <Text style={[styles.modeTitle, mode === "blank" && { color: colors.white }]}>Blank</Text>
              <Text style={[styles.modeSub, mode === "blank" && { color: "rgba(255,255,255,0.8)" }]}>Start empty</Text>
            </TouchableOpacity>
          </View>

          {mode === "ai" && (
            <>
              <Input
                label="Facts / brief"
                value={facts}
                onChangeText={setFacts}
                placeholder="Describe the facts, amounts, dates, relief sought..."
                multiline
                numberOfLines={6}
                style={{ minHeight: 140, textAlignVertical: "top" }}
                testID="nd-facts"
              />
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={14} color={colors.inkMuted} />
                <Text style={[type.small, { flex: 1 }]}>Powered by Claude Haiku 4.5. Draft is generated in Indian legal English and should be reviewed by you before filing.</Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={mode === "ai" ? "Generate draft" : "Create draft"}
            onPress={proceed}
            loading={generating}
            icon={mode === "ai" ? "sparkles" : undefined}
            testID="nd-generate"
          />
          {generating && mode === "ai" ? <Text style={[type.small, { textAlign: "center", marginTop: 8 }]}>Drafting in Indian legal English...</Text> : null}
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
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink, maxWidth: 200 },
  chipTextActive: { color: colors.white },
  modeRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  modeCard: {
    flex: 1, borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
    borderRadius: 4, alignItems: "flex-start", gap: 6,
  },
  modeCardActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  modeTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 4 },
  modeSub: { fontSize: 12, color: colors.inkMuted },
  infoBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: colors.bgMuted, padding: 12, borderRadius: 4, marginTop: -spacing.sm,
  },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

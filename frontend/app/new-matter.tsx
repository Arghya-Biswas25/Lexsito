import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

const MATTER_TYPES = ["civil", "criminal", "family", "property", "consumer", "labour", "other"];
const FEE_TYPES = [
  { key: "hourly", label: "Hourly" },
  { key: "fixed", label: "Fixed" },
  { key: "retainer", label: "Retainer" },
];
const STAGES = ["filing", "arguments", "judgment", "appeal", "closed"];

export default function NewMatter() {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string }>();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string>(params.clientId || "");
  const [title, setTitle] = useState("");
  const [matterType, setMatterType] = useState("civil");
  const [courtName, setCourtName] = useState("");
  const [courtRoom, setCourtRoom] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [opposingParty, setOpposingParty] = useState("");
  const [opposingCounsel, setOpposingCounsel] = useState("");
  const [feeType, setFeeType] = useState("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [stage, setStage] = useState("filing");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/clients", { params: { status: "all" } }).then(r => setClients(r.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!clientId) return Alert.alert("Select a client");
    if (!title.trim()) return Alert.alert("Title required");
    setLoading(true);
    try {
      const res = await api.post("/matters", {
        client_id: clientId,
        title: title.trim(),
        matter_type: matterType,
        court_name: courtName.trim() || null,
        court_room: courtRoom.trim() || null,
        case_number: caseNumber.trim() || null,
        opposing_party: opposingParty.trim() || null,
        opposing_counsel: opposingCounsel.trim() || null,
        fee_type: feeType,
        hourly_rate: feeType === "hourly" && hourlyRate ? parseFloat(hourlyRate) : null,
        fixed_fee: feeType === "fixed" && fixedFee ? parseFloat(fixedFee) : null,
        retainer_amount: null,
        stage,
        status: "active",
        description: description.trim() || null,
      });
      router.replace({ pathname: "/matter/[id]", params: { id: res.data.id } });
    } catch (e: any) {
      Alert.alert("Could not save", e?.response?.data?.detail || "Try again");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="New matter" subtitle="Cases" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Client</Text>
          <View style={styles.chipRow}>
            {clients.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => setClientId(c.id)} style={[styles.chip, clientId === c.id && styles.chipActive]} testID={`nm-client-${c.id}`}>
                <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />

          <Input label="Matter title" value={title} onChangeText={setTitle} placeholder="e.g. Sharma vs State - Property" testID="nm-title" />

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Matter type</Text>
          <View style={styles.chipRow}>
            {MATTER_TYPES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setMatterType(t)} style={[styles.chip, matterType === t && styles.chipActive]}>
                <Text style={[styles.chipText, matterType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />

          <Input label="Court name" value={courtName} onChangeText={setCourtName} placeholder="Saket District Court, Delhi" testID="nm-court" />
          <Input label="Court room" value={courtRoom} onChangeText={setCourtRoom} placeholder="Court No. 12" />
          <Input label="Case number" value={caseNumber} onChangeText={setCaseNumber} placeholder="CS/2024/4521" testID="nm-case-no" />
          <Input label="Opposing party" value={opposingParty} onChangeText={setOpposingParty} placeholder="" />
          <Input label="Opposing counsel" value={opposingCounsel} onChangeText={setOpposingCounsel} placeholder="(optional)" />

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Fee type</Text>
          <View style={styles.chipRow}>
            {FEE_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setFeeType(t.key)} style={[styles.chip, feeType === t.key && styles.chipActive]}>
                <Text style={[styles.chipText, feeType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: spacing.md }} />
          {feeType === "hourly" ? (
            <Input label="Hourly rate (₹)" value={hourlyRate} onChangeText={setHourlyRate} placeholder="3500" keyboardType="numeric" testID="nm-hourly-rate" />
          ) : feeType === "fixed" ? (
            <Input label="Fixed fee (₹)" value={fixedFee} onChangeText={setFixedFee} placeholder="150000" keyboardType="numeric" testID="nm-fixed-fee" />
          ) : null}

          <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.md }]}>Stage</Text>
          <View style={styles.chipRow}>
            {STAGES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setStage(t)} style={[styles.chip, stage === t && styles.chipActive]}>
                <Text style={[styles.chipText, stage === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Brief note" multiline testID="nm-description" />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Save matter" onPress={submit} loading={loading} testID="nm-save-btn" />
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
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

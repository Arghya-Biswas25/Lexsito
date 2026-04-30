import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input, Badge } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

const CLIENT_TYPES = [
  { key: "individual", label: "Individual" },
  { key: "company", label: "Company" },
];
const STATUSES = [
  { key: "active", label: "Active" },
  { key: "prospective", label: "Prospective" },
];
const ID_TYPES = [
  { key: "aadhaar", label: "Aadhaar" },
  { key: "pan", label: "PAN" },
  { key: "passport", label: "Passport" },
];

export default function NewClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [clientType, setClientType] = useState("individual");
  const [idType, setIdType] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [referral, setReferral] = useState("");
  const [status, setStatus] = useState("active");
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const runConflictCheck = async (value: string) => {
    if (!value || value.length < 3) { setConflictMsg(null); return; }
    setChecking(true);
    try {
      const res = await api.get("/clients/conflict-check", { params: { name: value } });
      if (res.data?.conflict) {
        const matchNames = res.data.matches.map((m: any) => m.name).join(", ");
        setConflictMsg(`Possible conflict: ${matchNames}`);
      } else {
        setConflictMsg(null);
      }
    } catch {}
    finally { setChecking(false); }
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert("Name required");
    if (phone && !/^[0-9+\- ]{7,15}$/.test(phone)) return Alert.alert("Invalid phone");
    setLoading(true);
    try {
      const res = await api.post("/clients", {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        client_type: clientType,
        id_type: idType,
        id_number: idNumber.trim() || null,
        referral_source: referral.trim() || null,
        status,
        notes: null,
      });
      router.replace({ pathname: "/client/[id]", params: { id: res.data.id } });
    } catch (e: any) {
      Alert.alert("Could not save", e?.response?.data?.detail || "Try again");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="New client" subtitle="Directory" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Input label="Full name" value={name} onChangeText={(v) => { setName(v); runConflictCheck(v); }} placeholder="e.g. Rajesh Kumar Sharma" testID="nc-name" />
          {conflictMsg ? (
            <View style={styles.conflictBanner}>
              <Text style={styles.conflictText}>⚠ {conflictMsg}</Text>
            </View>
          ) : null}

          <Input label="Mobile" value={phone} onChangeText={setPhone} placeholder="9876543210" keyboardType="phone-pad" testID="nc-phone" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" testID="nc-email" />
          <Input label="City" value={city} onChangeText={setCity} placeholder="New Delhi" testID="nc-city" />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Street, locality" multiline testID="nc-address" />

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Client type</Text>
          <View style={styles.chipRow}>
            {CLIENT_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setClientType(t.key)} style={[styles.chip, clientType === t.key && styles.chipActive]} testID={`nc-type-${t.key}`}>
                <Text style={[styles.chipText, clientType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.lg }]}>Status</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setStatus(t.key)} style={[styles.chip, status === t.key && styles.chipActive]} testID={`nc-status-${t.key}`}>
                <Text style={[styles.chipText, status === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.lg }]}>ID type (optional)</Text>
          <View style={styles.chipRow}>
            {ID_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setIdType(idType === t.key ? null : t.key)} style={[styles.chip, idType === t.key && styles.chipActive]}>
                <Text style={[styles.chipText, idType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {idType ? <Input label="ID number" value={idNumber} onChangeText={setIdNumber} placeholder={idType === "aadhaar" ? "1234-5678-9012" : "—"} style={{ marginTop: spacing.md }} testID="nc-id-number" /> : null}

          <Input label="Referral source (optional)" value={referral} onChangeText={setReferral} placeholder="How did they find you?" testID="nc-referral" />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Save client" onPress={submit} loading={loading} testID="nc-save-btn" />
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
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.white },
  conflictBanner: { backgroundColor: "#FEE2E2", padding: 12, borderRadius: 4, marginBottom: spacing.lg, marginTop: -spacing.md },
  conflictText: { color: "#991B1B", fontSize: 13, fontWeight: "600" },
  footer: {
    padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
});

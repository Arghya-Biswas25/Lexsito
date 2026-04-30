import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, spacing, type, formatINR, formatDate } from "../src/theme";
import { Button, Input, Badge } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";
import { Ionicons } from "@expo/vector-icons";

export default function NewInvoice() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matterId?: string }>();
  const [matters, setMatters] = useState<any[]>([]);
  const [matterId, setMatterId] = useState<string>(params.matterId || "");
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});
  const [customItems, setCustomItems] = useState<any[]>([]);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
  const [includeGst, setIncludeGst] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/matters", { params: { status: "active" } }).then(r => setMatters(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (matterId) {
      api.get("/time-entries", { params: { matter_id: matterId, unbilled: true } }).then(r => {
        setTimeEntries(r.data);
        const init: Record<string, boolean> = {};
        r.data.forEach((t: any) => { init[t.id] = true; });
        setSelectedEntries(init);
      });
    }
  }, [matterId]);

  const matter = matters.find(m => m.id === matterId);

  const lineItemsFromTime = timeEntries.filter(t => selectedEntries[t.id]).map(t => ({
    description: `${t.activity.replace("_", " ")}${t.description ? ` - ${t.description}` : ""} (${(t.duration_mins / 60).toFixed(1)}h)`,
    quantity: t.duration_mins / 60,
    rate: t.hourly_rate || 0,
    amount: t.billed_amount || 0,
  }));
  const allLineItems = [...lineItemsFromTime, ...customItems];

  const subtotal = allLineItems.reduce((s, li) => s + (li.amount || 0), 0);
  const gstAmount = includeGst ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  const total = subtotal + gstAmount;

  const addCustomItem = () => {
    const amt = parseFloat(newItemAmount);
    if (!newItemDesc.trim() || isNaN(amt) || amt <= 0) return;
    setCustomItems([...customItems, { description: newItemDesc.trim(), quantity: 1, rate: amt, amount: amt }]);
    setNewItemDesc("");
    setNewItemAmount("");
  };

  const submit = async () => {
    if (!matterId) return Alert.alert("Select matter");
    if (!matter) return;
    if (allLineItems.length === 0) return Alert.alert("Add at least one line item");
    setLoading(true);
    try {
      const res = await api.post("/invoices", {
        client_id: matter.client_id,
        matter_id: matterId,
        issue_date: issueDate,
        due_date: dueDate || null,
        line_items: allLineItems,
        disbursements: [],
        include_gst: includeGst,
        notes: notes.trim() || null,
        status: "sent",
      });
      router.replace({ pathname: "/invoice/[id]", params: { id: res.data.id } });
    } catch (e: any) {
      Alert.alert("Could not create", e?.response?.data?.detail || "Try again");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title="New invoice" subtitle="Billing" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Matter</Text>
          <View style={styles.chipRow}>
            {matters.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setMatterId(m.id)} style={[styles.chip, matterId === m.id && styles.chipActive]} testID={`ni-matter-${m.id}`}>
                <Text style={[styles.chipText, matterId === m.id && styles.chipTextActive]} numberOfLines={1}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <Input label="Issue date" value={issueDate} onChangeText={setIssueDate} />
          <Input label="Due date" value={dueDate} onChangeText={setDueDate} />

          {timeEntries.length > 0 && (
            <>
              <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.md }]}>Unbilled time ({timeEntries.length})</Text>
              {timeEntries.map(t => (
                <TouchableOpacity key={t.id} style={styles.entryRow} onPress={() => setSelectedEntries({ ...selectedEntries, [t.id]: !selectedEntries[t.id] })}>
                  <View style={[styles.checkbox, selectedEntries[t.id] && styles.checkboxOn]}>
                    {selectedEntries[t.id] && <Text style={{ color: colors.white, fontWeight: "800", fontSize: 12 }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>{t.activity.replace("_", " ")} · {(t.duration_mins / 60).toFixed(1)}h</Text>
                    <Text style={type.small}>{t.description || "—"}</Text>
                  </View>
                  <Text style={type.h3}>{formatINR(t.billed_amount)}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.lg }]}>Custom items</Text>
          {customItems.map((ci, i) => (
            <View key={i} style={styles.entryRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{ci.description}</Text>
              </View>
              <Text style={type.h3}>{formatINR(ci.amount)}</Text>
              <TouchableOpacity onPress={() => setCustomItems(customItems.filter((_, idx) => idx !== i))}>
                <Ionicons name="close" size={16} color={colors.alert} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 2 }}>
              <Input label="Description" value={newItemDesc} onChangeText={setNewItemDesc} placeholder="Consultation" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="₹" value={newItemAmount} onChangeText={setNewItemAmount} keyboardType="numeric" />
            </View>
          </View>
          <Button title="+ Add item" variant="secondary" onPress={addCustomItem} testID="ni-add-item" />

          <TouchableOpacity onPress={() => setIncludeGst(!includeGst)} style={styles.toggleRow} testID="ni-gst-toggle">
            <View style={[styles.checkbox, includeGst && styles.checkboxOn]}>
              {includeGst && <Text style={{ color: colors.white, fontWeight: "800" }}>✓</Text>}
            </View>
            <Text style={type.body}>Include GST 18%</Text>
          </TouchableOpacity>

          <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

          {/* Totals summary */}
          <View style={styles.totals}>
            <View style={styles.totalRow}><Text style={type.body}>Subtotal</Text><Text style={type.body}>{formatINR(subtotal)}</Text></View>
            {includeGst && <View style={styles.totalRow}><Text style={type.body}>GST</Text><Text style={type.body}>{formatINR(gstAmount)}</Text></View>}
            <View style={[styles.totalRow, { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm }]}>
              <Text style={type.h3}>Total</Text>
              <Text style={type.h2}>{formatINR(total)}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Create invoice" onPress={submit} loading={loading} testID="ni-save-btn" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink, maxWidth: 200 },
  chipTextActive: { color: colors.white },
  entryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 3 },
  checkboxOn: { backgroundColor: colors.ink },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  totals: { marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { colors, spacing, type, formatINR, formatDate } from "../../src/theme";
import { Badge, Button } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setData(res.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markPaid = () => {
    if (!data) return;
    const outstanding = (data.total_amount || 0) - (data.paid_amount || 0);
    Alert.alert("Mark as paid?", `Record full payment of ${formatINR(outstanding)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark paid",
        onPress: async () => {
          try {
            await api.post(`/invoices/${id}/payment`, { paid_amount: outstanding, status: "paid" });
            load();
          } catch {
            Alert.alert("Could not update");
          }
        },
      },
    ]);
  };

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}><TopBar title="Invoice" /></SafeAreaView>;

  const outstanding = (data.total_amount || 0) - (data.paid_amount || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title={data.invoice_number} subtitle="Invoice" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={type.overline}>{data.client?.name || "—"}</Text>
          <Text style={[type.h1, { marginTop: spacing.sm }]}>{formatINR(data.total_amount)}</Text>
          <View style={{ marginTop: spacing.sm, flexDirection: "row", gap: spacing.sm }}>
            <Badge tone={data.status === "paid" ? "success" : data.status === "overdue" ? "alert" : data.status === "partial" ? "warning" : "info"}>{data.status}</Badge>
            {data.include_gst && <Badge tone="neutral">GST 18%</Badge>}
          </View>
          <Text style={[type.small, { marginTop: spacing.md }]}>Issued {formatDate(data.issue_date)}{data.due_date ? ` · Due ${formatDate(data.due_date)}` : ""}</Text>
          <Text style={[type.small, { marginTop: 2 }]}>Matter: {data.matter?.title}</Text>
        </View>

        {/* Line items */}
        <Text style={[type.overline, { paddingHorizontal: spacing.xl, marginTop: spacing.md }]}>Line items</Text>
        {(data.line_items || []).map((li: any, idx: number) => (
          <View key={idx} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{li.description}</Text>
              <Text style={type.small}>{li.quantity} × {formatINR(li.rate)}</Text>
            </View>
            <Text style={type.h3}>{formatINR(li.amount)}</Text>
          </View>
        ))}
        {(data.disbursements || []).map((d: any, idx: number) => (
          <View key={`d${idx}`} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{d.description}</Text>
              <Text style={type.small}>Disbursement</Text>
            </View>
            <Text style={type.h3}>{formatINR(d.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={type.body}>Subtotal</Text>
            <Text style={type.body}>{formatINR(data.subtotal)}</Text>
          </View>
          {data.include_gst && (
            <View style={styles.totalRow}>
              <Text style={type.body}>GST @ 18%</Text>
              <Text style={type.body}>{formatINR(data.gst_amount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm }]}>
            <Text style={type.h3}>Total</Text>
            <Text style={type.h2}>{formatINR(data.total_amount)}</Text>
          </View>
          {data.paid_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={type.body}>Paid</Text>
              <Text style={[type.body, { color: colors.success }]}>{formatINR(data.paid_amount)}</Text>
            </View>
          )}
          {outstanding > 0 && (
            <View style={styles.totalRow}>
              <Text style={type.h3}>Outstanding</Text>
              <Text style={[type.h3, { color: colors.alert }]}>{formatINR(outstanding)}</Text>
            </View>
          )}
        </View>

        {outstanding > 0 && (
          <View style={{ padding: spacing.xl }}>
            <Button title="Mark as paid" onPress={markPaid} testID="inv-mark-paid" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.border },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  totals: { padding: spacing.xl, borderTopWidth: 1, borderColor: colors.border, gap: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

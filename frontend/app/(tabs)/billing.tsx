import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatINR, formatDate, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { Badge, EmptyState } from "../../src/ui";

type Invoice = {
  id: string;
  invoice_number: string;
  client_name?: string;
  matter_title?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  issue_date: string;
  due_date?: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

export default function Billing() {
  const router = useRouter();
  const { mode } = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/invoices", { params: { status: filter } });
      setInvoices(res.data);
    } catch (e) { console.log(e); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);
  const totalCollected = invoices
    .filter((i) => i.paid_amount > 0)
    .reduce((sum, i) => sum + (i.paid_amount || 0), 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]} key={mode}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Revenue</Text>
          <Text style={type.h1} testID="billing-title">Billing</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/new-invoice")} style={styles.addBtn} testID="billing-new-btn">
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statGrid}>
        <View style={[styles.statCell, { borderRightWidth: 1 }]}>
          <Text style={type.overline}>Outstanding</Text>
          <Text style={[type.metric, { marginTop: 8, color: totalOutstanding > 0 ? colors.alert : colors.ink }]}>{formatINR(totalOutstanding)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={type.overline}>Collected</Text>
          <Text style={[type.metric, { marginTop: 8, color: colors.success }]}>{formatINR(totalCollected)}</Text>
        </View>
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            testID={`billing-filter-${f.key}`}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No invoices"
            subtitle="Create your first invoice from a matter."
            action={
              <TouchableOpacity onPress={() => router.push("/new-invoice")} style={styles.emptyBtn} testID="billing-empty-new">
                <Text style={{ color: colors.white, fontWeight: "700" }}>+ New invoice</Text>
              </TouchableOpacity>
            }
          />
        }
        renderItem={({ item }) => {
          const outstanding = (item.total_amount || 0) - (item.paid_amount || 0);
          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: item.id } })}
              style={styles.invoiceRow}
              testID={`invoice-item-${item.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={type.small}>{item.invoice_number}</Text>
                <Text style={type.h3} numberOfLines={1}>{item.client_name || "—"}</Text>
                <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{item.matter_title}</Text>
                <Text style={[type.small, { marginTop: 2 }]}>Issued {formatDate(item.issue_date)}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={[type.h3, { color: item.status === "overdue" ? colors.alert : colors.ink }]}>
                  {formatINR(item.status === "paid" ? item.total_amount : outstanding)}
                </Text>
                <Badge tone={item.status === "overdue" ? "alert" : item.status === "paid" ? "success" : item.status === "partial" ? "warning" : item.status === "sent" ? "info" : "neutral"}>
                  {item.status}
                </Badge>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  addBtn: {
    width: 44, height: 44, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderRadius: 4,
  },
  statGrid: {
    flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  statCell: {
    flex: 1, padding: spacing.lg, borderColor: colors.border,
  },
  filterRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.4, textTransform: "uppercase" },
  chipTextActive: { color: colors.white },
  invoiceRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderTopWidth: 1, borderColor: colors.border,
    gap: spacing.md,
  },
  emptyBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
});

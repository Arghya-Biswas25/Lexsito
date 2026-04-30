import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatDateShort, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { Avatar, Badge, EmptyState } from "../../src/ui";

type Matter = {
  id: string;
  title: string;
  matter_type: string;
  case_number?: string;
  court_name?: string;
  status: string;
  client_name?: string;
  next_hearing?: any;
  opposing_party?: string;
};

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
  { key: "closed", label: "Closed" },
];

export default function Matters() {
  const router = useRouter();
  const { mode } = useTheme();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("active");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/matters", { params: { status: filter, q } });
      setMatters(res.data);
    } catch (e) { console.log(e); }
  }, [filter, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]} key={mode}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Cases</Text>
          <Text style={type.h1} testID="matters-title">Matters</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/new-matter")} style={styles.addBtn} testID="matters-new-btn">
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.inkMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search title, case no, opposing party"
          placeholderTextColor={colors.inkLight}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          returnKeyType="search"
          testID="matters-search"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            testID={`matters-filter-${f.key}`}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={matters}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase-outline"
            title="No matters yet"
            subtitle="Create your first case to begin tracking hearings, time, and billing."
            action={
              <TouchableOpacity onPress={() => router.push("/new-matter")} style={styles.emptyBtn} testID="matters-empty-new">
                <Text style={{ color: colors.white, fontWeight: "700" }}>+ New matter</Text>
              </TouchableOpacity>
            }
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/matter/[id]", params: { id: item.id } })}
            style={styles.matterRow}
            testID={`matter-item-${item.id}`}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 }}>
                <Badge tone="neutral">{item.matter_type}</Badge>
                {item.case_number ? <Text style={type.small}>{item.case_number}</Text> : null}
              </View>
              <Text style={type.h3} numberOfLines={2}>{item.title}</Text>
              <Text style={[type.small, { marginTop: 4 }]} numberOfLines={1}>
                {item.client_name || "—"}{item.court_name ? `  ·  ${item.court_name}` : ""}
              </Text>
              {item.next_hearing ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: 6 }}>
                  <Ionicons name="calendar-outline" size={12} color={colors.inkMuted} />
                  <Text style={[type.small, { color: colors.ink, fontWeight: "600" }]}>
                    Next hearing: {formatDateShort(item.next_hearing.date)}
                    {item.next_hearing.time ? ` · ${item.next_hearing.time}` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkLight} />
          </TouchableOpacity>
        )}
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
  searchRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: spacing.xl,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 44, borderRadius: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  filterRow: {
    flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.4, textTransform: "uppercase" },
  chipTextActive: { color: colors.white },
  matterRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderTopWidth: 1, borderColor: colors.border,
    gap: spacing.md,
  },
  emptyBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
});

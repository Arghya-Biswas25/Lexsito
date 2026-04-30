import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { Avatar, Badge, EmptyState } from "../../src/ui";

type Client = {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  status: string;
  client_type: string;
  matter_count?: number;
};

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "prospective", label: "Prospective" },
  { key: "all", label: "All" },
];

export default function Clients() {
  const router = useRouter();
  const { mode } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("active");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/clients", { params: { status: filter, q } });
      setClients(res.data);
    } catch (e) { console.log(e); }
  }, [filter, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]} key={mode}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Directory</Text>
          <Text style={type.h1} testID="clients-title">Clients</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/new-client")} style={styles.addBtn} testID="clients-new-btn">
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.inkMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, city"
          placeholderTextColor={colors.inkLight}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          returnKeyType="search"
          testID="clients-search"
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            testID={`clients-filter-${f.key}`}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No clients yet"
            subtitle="Your client directory will appear here."
            action={
              <TouchableOpacity onPress={() => router.push("/new-client")} style={styles.emptyBtn} testID="clients-empty-new">
                <Text style={{ color: colors.white, fontWeight: "700" }}>+ Add client</Text>
              </TouchableOpacity>
            }
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/client/[id]", params: { id: item.id } })}
            style={styles.clientRow}
            testID={`client-item-${item.id}`}
          >
            <Avatar name={item.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3} numberOfLines={1}>{item.name}</Text>
              <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                {item.phone || "No phone"}{item.city ? ` · ${item.city}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 6 }}>
                <Badge tone={item.status === "active" ? "success" : item.status === "prospective" ? "warning" : "neutral"}>{item.status}</Badge>
                {item.matter_count ? <Badge>{item.matter_count} matter{item.matter_count === 1 ? "" : "s"}</Badge> : null}
              </View>
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
  clientRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderTopWidth: 1, borderColor: colors.border,
    gap: spacing.md,
  },
  emptyBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4 },
});

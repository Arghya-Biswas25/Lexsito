import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatDate } from "../../src/theme";
import { Avatar, Badge, Button, EmptyState } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setData(res.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}><TopBar title="Client" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title={data.name} subtitle="Client" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.hero}>
          <Avatar name={data.name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={type.h2} numberOfLines={2}>{data.name}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
              <Badge tone={data.status === "active" ? "success" : "neutral"}>{data.status}</Badge>
              <Badge tone="neutral">{data.client_type}</Badge>
            </View>
          </View>
        </View>

        <View style={styles.infoList}>
          {data.phone ? (
            <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${data.phone}`)}>
              <Ionicons name="call-outline" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.overline}>Phone</Text>
                <Text style={type.body}>{data.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkLight} />
            </TouchableOpacity>
          ) : null}
          {data.email ? (
            <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`mailto:${data.email}`)}>
              <Ionicons name="mail-outline" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.overline}>Email</Text>
                <Text style={type.body}>{data.email}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {data.city ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.overline}>City</Text>
                <Text style={type.body}>{data.city}</Text>
              </View>
            </View>
          ) : null}
          {data.address ? (
            <View style={styles.infoRow}>
              <Ionicons name="home-outline" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.overline}>Address</Text>
                <Text style={type.body}>{data.address}</Text>
              </View>
            </View>
          ) : null}
          {data.id_type ? (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.overline}>{data.id_type.toUpperCase()}</Text>
                <Text style={type.body}>{data.id_number || "—"}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button title="+ New matter" onPress={() => router.push({ pathname: "/new-matter", params: { clientId: id } })} testID="cd-new-matter" />
        </View>

        <Text style={[type.overline, { paddingHorizontal: spacing.xl, marginTop: spacing.md }]}>Matters ({data.matters?.length || 0})</Text>
        {(data.matters || []).length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No matters yet" subtitle="Add this client's first case." />
        ) : (
          (data.matters || []).map((m: any) => (
            <TouchableOpacity key={m.id} style={styles.matterRow} onPress={() => router.push({ pathname: "/matter/[id]", params: { id: m.id } })} testID={`cd-matter-${m.id}`}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: 4 }}>
                  <Badge tone="neutral">{m.matter_type}</Badge>
                  {m.case_number ? <Text style={type.small}>{m.case_number}</Text> : null}
                </View>
                <Text style={type.h3} numberOfLines={2}>{m.title}</Text>
                {m.court_name ? <Text style={[type.small, { marginTop: 2 }]}>{m.court_name}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.border },
  infoList: { borderBottomWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  matterRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderTopWidth: 1, borderColor: colors.border },
});

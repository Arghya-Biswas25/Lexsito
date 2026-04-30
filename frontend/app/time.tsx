import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, type, formatINR, formatDate } from "../src/theme";
import { Button, EmptyState } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { api } from "../src/api";

export default function TimeLog() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/time-entries", { params: { unbilled: true } });
      setEntries(res.data);
    } catch (e) {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalUnbilled = entries.reduce((s, t) => s + (t.billed_amount || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title="Unbilled time" subtitle="Time tracking" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.hero}>
          <Text style={type.overline}>Unbilled total</Text>
          <Text style={[type.h1, { marginTop: 8 }]}>{formatINR(totalUnbilled)}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>{entries.length} entr{entries.length === 1 ? "y" : "ies"}</Text>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button title="+ Log time" onPress={() => router.push("/new-time")} testID="tl-log" />
        </View>

        {entries.length === 0 ? (
          <EmptyState icon="time-outline" title="No unbilled time" subtitle="Great work — all billable hours are invoiced." />
        ) : (
          entries.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{t.activity.replace("_", " ")} · {Math.floor(t.duration_mins / 60)}h {t.duration_mins % 60}m</Text>
                <Text style={type.small}>{t.matter_title || "—"} · {t.client_name || "—"}</Text>
                {t.description ? <Text style={type.small}>{t.description}</Text> : null}
                <Text style={type.small}>{formatDate(t.date)}</Text>
              </View>
              <Text style={type.h3}>{formatINR(t.billed_amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border },
});

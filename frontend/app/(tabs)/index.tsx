import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, type, formatINR, formatDateShort, daysBetween, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Badge } from "../../src/ui";
import { TimerPill } from "../../src/TimerPill";

type Stats = {
  active_matters: number;
  unbilled_amount: number;
  overdue_amount: number;
  overdue_count: number;
  hearings_this_week: number;
  todays_hearings: any[];
  upcoming_deadlines: any[];
  outstanding_invoices: any[];
};

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { mode } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => makeStyles(), [mode]);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (e) {
      console.log(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = (user?.name || "").split(" ").slice(-1)[0] || user?.name || "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.overline}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
            <Text style={[type.h1, { marginTop: 4 }]} testID="dashboard-greeting">{greeting}, {firstName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.iconBtn}
            testID="home-settings-btn"
          >
            <Ionicons name="settings-outline" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Active timer pill */}
        <TimerPill />

        {/* Stat Grid - Grid Borders pattern */}
        <View style={styles.statGrid}>
          <StatCell
            styles={styles}
            label="Active matters"
            value={String(stats?.active_matters ?? "—")}
            onPress={() => router.push("/(tabs)/matters")}
            testID="stat-active-matters"
            borderRight
            borderBottom
          />
          <StatCell
            styles={styles}
            label="Unbilled"
            value={formatINR(stats?.unbilled_amount ?? 0)}
            onPress={() => router.push("/time")}
            testID="stat-unbilled"
            borderBottom
          />
          <StatCell
            styles={styles}
            label="Overdue"
            value={formatINR(stats?.overdue_amount ?? 0)}
            tone={stats?.overdue_amount ? "alert" : "neutral"}
            onPress={() => router.push("/(tabs)/billing")}
            testID="stat-overdue"
            borderRight
          />
          <StatCell
            styles={styles}
            label="Hearings / week"
            value={String(stats?.hearings_this_week ?? "—")}
            onPress={() => router.push("/(tabs)/calendar")}
            testID="stat-hearings-week"
          />
        </View>

        {/* Today's Hearings */}
        <View style={styles.section}>
          <SectionHeader styles={styles} title="Today's schedule" action="See all" onAction={() => router.push("/(tabs)/calendar")} />
          {(stats?.todays_hearings || []).length === 0 ? (
            <Text style={[type.bodyMuted, { paddingHorizontal: spacing.xl, paddingBottom: spacing.md }]}>No hearings today.</Text>
          ) : (
            stats!.todays_hearings.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={styles.hearingRow}
                onPress={() => h.matter_id && router.push({ pathname: "/matter/[id]", params: { id: h.matter_id } })}
                testID={`today-hearing-${h.id}`}
              >
                <View style={styles.timeCol}>
                  <Text style={styles.timeBig}>{(h.time || "--").split(":")[0]}</Text>
                  <Text style={styles.timeSmall}>{(h.time || "--:00").split(":")[1] || "00"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3} numberOfLines={1}>{h.matter_title || h.title}</Text>
                  <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{h.court_name || "—"}{h.court_room ? ` · ${h.court_room}` : ""}</Text>
                  {h.client_name ? <Text style={[type.small, { marginTop: 2, color: colors.inkLight }]}>{h.client_name}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkLight} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={[styles.section, { paddingHorizontal: spacing.xl }]}>
          <Text style={[type.overline, { marginBottom: spacing.md }]}>Quick actions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            <QuickAction styles={styles} icon="person-add-outline" label="New client" onPress={() => router.push("/new-client")} testID="qa-new-client" />
            <QuickAction styles={styles} icon="briefcase-outline" label="New matter" onPress={() => router.push("/new-matter")} testID="qa-new-matter" />
            <QuickAction styles={styles} icon="calendar-outline" label="Add hearing" onPress={() => router.push("/new-event")} testID="qa-new-event" />
            <QuickAction styles={styles} icon="timer-outline" label="Start timer" onPress={() => router.push("/timer")} testID="qa-timer" />
          </View>
        </View>

        {/* Upcoming deadlines */}
        <View style={styles.section}>
          <SectionHeader styles={styles} title="Deadlines" action="Calendar" onAction={() => router.push("/(tabs)/calendar")} />
          {(stats?.upcoming_deadlines || []).length === 0 ? (
            <Text style={[type.bodyMuted, { paddingHorizontal: spacing.xl, paddingBottom: spacing.md }]}>No upcoming deadlines.</Text>
          ) : (
            stats!.upcoming_deadlines.map((d) => {
              const days = daysBetween(d.date);
              const tone = days <= 1 ? "alert" : days <= 3 ? "warning" : "neutral";
              return (
                <View key={d.id} style={styles.deadlineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body} numberOfLines={1}>{d.title}</Text>
                    <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                      {d.matter_title || "—"} · {formatDateShort(d.date)}
                    </Text>
                  </View>
                  <Badge tone={tone}>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}</Badge>
                </View>
              );
            })
          )}
        </View>

        {/* Outstanding Invoices */}
        <View style={styles.section}>
          <SectionHeader styles={styles} title="Outstanding invoices" action="Billing" onAction={() => router.push("/(tabs)/billing")} />
          {(stats?.outstanding_invoices || []).length === 0 ? (
            <Text style={[type.bodyMuted, { paddingHorizontal: spacing.xl, paddingBottom: spacing.md }]}>All clear. No outstanding invoices.</Text>
          ) : (
            stats!.outstanding_invoices.map((inv) => {
              const outstanding = (inv.total_amount || 0) - (inv.paid_amount || 0);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.invoiceRow}
                  onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}
                  testID={`dash-invoice-${inv.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3} numberOfLines={1}>{inv.client_name || "Client"}</Text>
                    <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{inv.invoice_number} · Due {formatDateShort(inv.due_date)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[type.h3, { color: inv.status === "overdue" ? colors.alert : colors.ink }]}>{formatINR(outstanding)}</Text>
                    <Badge tone={inv.status === "overdue" ? "alert" : inv.status === "partial" ? "warning" : "info"}>{inv.status}</Badge>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <TouchableOpacity onPress={logout} style={{ alignItems: "center", padding: spacing.xl }} testID="home-signout-btn">
          <Text style={[type.small, { color: colors.inkMuted }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCell = ({
  styles, label, value, onPress, testID, tone = "neutral", borderRight, borderBottom
}: { styles: any; label: string; value: string; onPress?: () => void; testID?: string; tone?: "neutral" | "alert"; borderRight?: boolean; borderBottom?: boolean }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[
      styles.statCell,
      borderRight && { borderRightWidth: 1 },
      borderBottom && { borderBottomWidth: 1 },
    ]}
    testID={testID}
  >
    <Text style={[type.overline, { marginBottom: 8, color: colors.inkMuted }]}>{label}</Text>
    <Text style={[type.metric, { color: tone === "alert" ? colors.alert : colors.ink }]}>{value}</Text>
  </TouchableOpacity>
);

const SectionHeader = ({ styles, title, action, onAction }: { styles: any; title: string; action?: string; onAction?: () => void }) => (
  <View style={styles.sectionHeader}>
    <Text style={[type.h3, { color: colors.ink }]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>{action} <Ionicons name="arrow-forward" size={12} color={colors.ink} /></Text>
      </TouchableOpacity>
    )}
  </View>
);

const QuickAction = ({ styles, icon, label, onPress, testID }: { styles: any; icon: any; label: string; onPress: () => void; testID?: string }) => (
  <TouchableOpacity onPress={onPress} style={styles.qa} testID={testID}>
    <Ionicons name={icon} size={18} color={colors.ink} />
    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink, marginTop: 6 }}>{label}</Text>
  </TouchableOpacity>
);

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statCell: {
    width: "50%",
    padding: spacing.lg,
    borderColor: colors.border,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  hearingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  timeCol: {
    width: 52, alignItems: "flex-start",
  },
  timeBig: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: colors.ink },
  timeSmall: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, letterSpacing: 1 },
  qa: {
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "flex-start",
    backgroundColor: colors.white,
    minHeight: 80,
    justifyContent: "center",
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
});

// Module-level default styles snapshot so sub-components (StatCell, SectionHeader, QuickAction) can use `styles`.
// Home component recreates via useMemo for dark-mode updates.
const styles = makeStyles();

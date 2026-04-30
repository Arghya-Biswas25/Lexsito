import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, type } from "../src/theme";
import { Button, Input, Avatar } from "../src/ui";
import { TopBar } from "../src/TopBar";
import { useAuth } from "../src/auth";
import { api } from "../src/api";

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [bar, setBar] = useState(user?.bar_council_no || "");
  const [city, setCity] = useState(user?.city || "");
  const [chamber, setChamber] = useState(user?.chamber_address || "");
  const [gstin, setGstin] = useState(user?.gstin || "");
  const [rate, setRate] = useState(String(user?.hourly_rate || "2500"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setBar(user?.bar_council_no || "");
    setCity(user?.city || "");
    setChamber(user?.chamber_address || "");
    setGstin(user?.gstin || "");
    setRate(String(user?.hourly_rate || "2500"));
  }, [user]);

  const save = async () => {
    setLoading(true);
    try {
      await api.put("/auth/me", {
        name,
        bar_council_no: bar || null,
        city: city || null,
        chamber_address: chamber || null,
        gstin: gstin || null,
        hourly_rate: parseFloat(rate) || 2500,
      });
      await refreshUser();
      Alert.alert("Saved", "Profile updated");
    } catch (e: any) {
      Alert.alert("Could not save");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar title="Settings" subtitle="Profile" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", padding: spacing.xl, marginBottom: spacing.lg }}>
            <Avatar name={name} size={72} />
            <Text style={[type.h3, { marginTop: spacing.md }]}>{name}</Text>
            <Text style={type.small}>{user?.email}</Text>
          </View>

          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Profile</Text>
          <Input label="Name" value={name} onChangeText={setName} testID="s-name" />
          <Input label="Bar Council Number" value={bar} onChangeText={setBar} placeholder="D/12345/2020" testID="s-bar" />
          <Input label="City" value={city} onChangeText={setCity} placeholder="New Delhi" testID="s-city" />
          <Input label="Chamber address" value={chamber} onChangeText={setChamber} multiline testID="s-chamber" />

          <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.md }]}>Billing</Text>
          <Input label="GSTIN (optional)" value={gstin} onChangeText={setGstin} placeholder="07ABCDE1234F1Z5" testID="s-gstin" />
          <Input label="Default hourly rate (₹)" value={rate} onChangeText={setRate} keyboardType="numeric" testID="s-rate" />

          <Button title="Save changes" onPress={save} loading={loading} testID="s-save" />

          <TouchableOpacity onPress={logout} style={{ marginTop: spacing.xl, padding: spacing.md, alignItems: "center" }} testID="s-logout">
            <Text style={{ color: colors.alert, fontWeight: "700" }}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});

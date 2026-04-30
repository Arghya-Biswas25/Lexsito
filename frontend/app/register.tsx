import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { useAuth } from "../src/auth";
import { api } from "../src/api";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bar, setBar] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !password) return setError("Name, email, and password required");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setError("");
    setLoading(true);
    try {
      await register({ name, email: email.trim(), password, bar_council_no: bar, city });
      // Ask to seed demo data
      try {
        await api.post("/seed-demo");
      } catch {}
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginTop: spacing.lg }]}>LEX·MANAGER</Text>
          <Text style={[type.h1, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Create account</Text>
          <Text style={[type.bodyMuted, { marginBottom: spacing.xl }]}>A professional home for your practice.</Text>

          <Input label="Full name" value={name} onChangeText={setName} placeholder="Adv. Your Name" testID="register-name-input" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@chamber.in" keyboardType="email-address" autoCapitalize="none" testID="register-email-input" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" testID="register-password-input" />
          <Input label="Bar council no. (optional)" value={bar} onChangeText={setBar} placeholder="D/12345/2020" testID="register-bar-input" />
          <Input label="City (optional)" value={city} onChangeText={setCity} placeholder="New Delhi" testID="register-city-input" />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Create account" onPress={submit} loading={loading} testID="register-submit-btn" />

          <TouchableOpacity onPress={() => router.push("/login")} style={{ marginTop: spacing.xl, alignSelf: "center" }} testID="register-to-login">
            <Text style={type.bodyMuted}>
              Already have an account? <Text style={{ color: colors.ink, fontWeight: "700" }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  error: { color: colors.alert, fontSize: 13, marginBottom: spacing.sm },
});

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button, Input } from "../src/ui";
import { useAuth } from "../src/auth";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return setError("Enter email and password");
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={[type.overline, { marginTop: spacing.lg }]}>LEX·MANAGER</Text>
          <Text style={[type.h1, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Sign in</Text>
          <Text style={[type.bodyMuted, { marginBottom: spacing.xl }]}>Continue to your practice.</Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@chamber.in"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="login-email-input"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            testID="login-password-input"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: spacing.md }}>
            <Button title="Sign in" onPress={submit} loading={loading} testID="login-submit-btn" />
          </View>

          <TouchableOpacity onPress={() => router.push("/register")} style={{ marginTop: spacing.xl, alignSelf: "center" }} testID="login-to-register">
            <Text style={type.bodyMuted}>
              New here? <Text style={{ color: colors.ink, fontWeight: "700" }}>Create an account</Text>
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

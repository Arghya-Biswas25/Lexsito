import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  return <Redirect href={user ? "/(tabs)" : "/welcome"} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
});

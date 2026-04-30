import React from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, type } from "../src/theme";
import { Button } from "../src/ui";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1678117367116-efb97dfc4183?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBjb3VydGhvdXNlfGVufDB8fHx8MTc3NzU0Mzc3MHww&ixlib=rb-4.1.0&q=85",
        }}
        style={styles.hero}
        imageStyle={{ opacity: 0.9 }}
      >
        <View style={styles.overlay} />
        <SafeAreaView style={{ flex: 1, padding: spacing.xl }}>
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <View>
              <Text style={[styles.brand, type.overline]} testID="app-brand">LEX·MANAGER</Text>
            </View>
            <View>
              <Text style={styles.headline}>Your practice.{"\n"}Organised.</Text>
              <Text style={styles.sub}>A professional workspace for the solo advocate. Matters, hearings, billing — all in one place.</Text>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={styles.footer}>
        <Button
          title="Get started"
          onPress={() => router.push("/register")}
          testID="welcome-register-btn"
        />
        <View style={{ height: spacing.md }} />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => router.push("/login")}
          testID="welcome-login-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  hero: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,11,0.55)" },
  brand: { color: "#FFFFFF", letterSpacing: 3 },
  headline: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: spacing.md, lineHeight: 22, maxWidth: 360 },
  footer: { padding: spacing.xl, paddingBottom: spacing.xl + 20, backgroundColor: colors.white },
});

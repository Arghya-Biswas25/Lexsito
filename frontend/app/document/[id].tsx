import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image, Platform, Dimensions, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { WebView } from "react-native-webview";
import { colors, spacing, type, formatDate } from "../../src/theme";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";
import { Ionicons } from "@expo/vector-icons";

export default function DocumentViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/documents/${id}`);
      setDoc(res.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = () => {
    Alert.alert("Delete document?", doc?.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/documents/${id}`); router.back(); } catch {}
      } },
    ]);
  };

  if (!doc) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <TopBar title="Document" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  const uri = doc.base64 || "";
  const isPdf = doc.file_type === "pdf" || (doc.mime_type || "").includes("pdf");
  const isImage = doc.file_type === "image" || (doc.mime_type || "").startsWith("image/");
  const screenHeight = Dimensions.get("window").height;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <TopBar
        title={doc.name}
        subtitle="Document"
        right={
          <TouchableOpacity onPress={onDelete} style={{ padding: 8 }} testID="doc-delete">
            <Ionicons name="trash-outline" size={20} color={colors.alert} />
          </TouchableOpacity>
        }
      />
      <View style={styles.meta}>
        <Text style={type.small}>{(doc.file_size / 1024).toFixed(0)} KB · {doc.file_type.toUpperCase()} · {formatDate(doc.uploaded_at)}</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bgMuted }}>
        {isImage ? (
          <Image source={{ uri }} style={{ flex: 1, width: "100%" }} resizeMode="contain" />
        ) : isPdf ? (
          Platform.OS === "web" ? (
            <iframe src={uri} style={{ width: "100%", height: screenHeight - 160, border: "none" }} />
          ) : (
            <WebView
              source={{ uri }}
              originWhitelist={["*"]}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.ink} /></View>}
            />
          )
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
            <Ionicons name="document-attach-outline" size={48} color={colors.inkMuted} />
            <Text style={[type.bodyMuted, { marginTop: spacing.md, textAlign: "center" }]}>Preview not available for this file type.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  meta: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

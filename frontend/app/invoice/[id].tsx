import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors, spacing, type, formatINR, formatDate } from "../../src/theme";
import { Badge, Button } from "../../src/ui";
import { TopBar } from "../../src/TopBar";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";

function buildInvoiceHtml(inv: any, user: any): string {
  const today = formatDate(new Date().toISOString());
  const items = (inv.line_items || []).map((li: any) =>
    `<tr><td>${escape(li.description)}</td><td style="text-align:center">${li.quantity}</td><td style="text-align:right">₹${Number(li.rate).toLocaleString("en-IN")}</td><td style="text-align:right">₹${Number(li.amount).toLocaleString("en-IN")}</td></tr>`
  ).join("");
  const disb = (inv.disbursements || []).map((d: any) =>
    `<tr><td colspan="3">${escape(d.description)} (disbursement)</td><td style="text-align:right">₹${Number(d.amount).toLocaleString("en-IN")}</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { margin: 40px; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #09090B; font-size: 12px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #09090B; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
    .brand { text-align: right; }
    .overline { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #52525B; }
    .meta { display: flex; gap: 40px; margin-bottom: 24px; }
    .meta-block { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,0.1); text-align: left; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #52525B; font-weight: 700; }
    .totals { margin-top: 24px; width: 280px; margin-left: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals-total { border-top: 2px solid #09090B; padding-top: 8px; margin-top: 8px; font-weight: 800; font-size: 16px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 11px; color: #52525B; }
    .outstanding { color: #E11D48; font-weight: 700; }
  </style></head><body>
    <div class="header">
      <div>
        <h1>TAX INVOICE</h1>
        <div class="overline" style="margin-top:4px">${escape(inv.invoice_number)}</div>
      </div>
      <div class="brand">
        <div style="font-weight:700;font-size:16px">Adv. ${escape(user?.name || "")}</div>
        ${user?.bar_council_no ? `<div>Bar Council: ${escape(user.bar_council_no)}</div>` : ""}
        ${user?.chamber_address ? `<div>${escape(user.chamber_address)}</div>` : ""}
        ${user?.city ? `<div>${escape(user.city)}</div>` : ""}
        ${user?.gstin ? `<div>GSTIN: ${escape(user.gstin)}</div>` : ""}
      </div>
    </div>

    <div class="meta">
      <div class="meta-block">
        <div class="overline">Billed to</div>
        <div style="font-weight:700;font-size:14px;margin-top:4px">${escape(inv.client?.name || "—")}</div>
        ${inv.client?.address ? `<div>${escape(inv.client.address)}</div>` : ""}
        ${inv.client?.city ? `<div>${escape(inv.client.city)}</div>` : ""}
        ${inv.client?.phone ? `<div>${escape(inv.client.phone)}</div>` : ""}
      </div>
      <div class="meta-block">
        <div class="overline">Matter</div>
        <div style="font-weight:600;margin-top:4px">${escape(inv.matter?.title || "—")}</div>
        ${inv.matter?.case_number ? `<div>Case No.: ${escape(inv.matter.case_number)}</div>` : ""}
        ${inv.matter?.court_name ? `<div>${escape(inv.matter.court_name)}</div>` : ""}
      </div>
      <div class="meta-block">
        <div class="overline">Issue date</div>
        <div style="margin-top:4px">${formatDate(inv.issue_date)}</div>
        ${inv.due_date ? `<div class="overline" style="margin-top:8px">Due date</div><div>${formatDate(inv.due_date)}</div>` : ""}
      </div>
    </div>

    <table>
      <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${items}${disb}</tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>₹${Number(inv.subtotal || 0).toLocaleString("en-IN")}</span></div>
      ${inv.include_gst ? `<div class="totals-row"><span>GST @ 18%</span><span>₹${Number(inv.gst_amount || 0).toLocaleString("en-IN")}</span></div>` : ""}
      <div class="totals-row totals-total"><span>Total</span><span>₹${Number(inv.total_amount || 0).toLocaleString("en-IN")}</span></div>
      ${Number(inv.paid_amount || 0) > 0 ? `<div class="totals-row"><span>Paid</span><span>₹${Number(inv.paid_amount).toLocaleString("en-IN")}</span></div>` : ""}
      ${((inv.total_amount || 0) - (inv.paid_amount || 0)) > 0 ? `<div class="totals-row outstanding"><span>Outstanding</span><span>₹${((inv.total_amount || 0) - (inv.paid_amount || 0)).toLocaleString("en-IN")}</span></div>` : ""}
    </div>

    ${inv.notes ? `<div style="margin-top:32px"><div class="overline">Notes</div><div style="margin-top:4px">${escape(inv.notes)}</div></div>` : ""}

    <div class="footer">
      <div>Generated on ${today}</div>
      <div style="margin-top:4px">This is a system-generated invoice and does not require signature.</div>
    </div>
  </body></html>`;
}

function escape(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setData(res.data);
    } catch (e) { console.log(e); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markPaid = () => {
    if (!data) return;
    const outstanding = (data.total_amount || 0) - (data.paid_amount || 0);
    Alert.alert("Mark as paid?", `Record full payment of ${formatINR(outstanding)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark paid",
        onPress: async () => {
          try {
            await api.post(`/invoices/${id}/payment`, { paid_amount: outstanding, status: "paid" });
            load();
          } catch { Alert.alert("Could not update"); }
        },
      },
    ]);
  };

  const exportPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const html = buildInvoiceHtml(data, user);
      if (Platform.OS === "web") {
        // Open in new tab to print / save as PDF
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(html);
          w.document.close();
          setTimeout(() => { try { w.print(); } catch {} }, 600);
        } else {
          Alert.alert("Popup blocked", "Allow pop-ups to export PDF.");
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${data.invoice_number}.pdf`, UTI: "com.adobe.pdf" });
        } else {
          Alert.alert("PDF saved", uri);
        }
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Try again");
    } finally { setExporting(false); }
  };

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><TopBar title="Invoice" /></SafeAreaView>;

  const outstanding = (data.total_amount || 0) - (data.paid_amount || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <TopBar title={data.invoice_number} subtitle="Invoice" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { borderColor: colors.border }]}>
          <Text style={[type.overline, { color: colors.inkMuted }]}>{data.client?.name || "—"}</Text>
          <Text style={[type.h1, { color: colors.ink, marginTop: spacing.sm }]}>{formatINR(data.total_amount)}</Text>
          <View style={{ marginTop: spacing.sm, flexDirection: "row", gap: spacing.sm }}>
            <Badge tone={data.status === "paid" ? "success" : data.status === "overdue" ? "alert" : data.status === "partial" ? "warning" : "info"}>{data.status}</Badge>
            {data.include_gst && <Badge tone="neutral">GST 18%</Badge>}
          </View>
          <Text style={[type.small, { marginTop: spacing.md, color: colors.inkMuted }]}>Issued {formatDate(data.issue_date)}{data.due_date ? ` · Due ${formatDate(data.due_date)}` : ""}</Text>
          <Text style={[type.small, { marginTop: 2, color: colors.inkMuted }]}>Matter: {data.matter?.title}</Text>
        </View>

        <Text style={[type.overline, { paddingHorizontal: spacing.xl, marginTop: spacing.md, color: colors.inkMuted }]}>Line items</Text>
        {(data.line_items || []).map((li: any, idx: number) => (
          <View key={idx} style={[styles.lineRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: colors.ink }]}>{li.description}</Text>
              <Text style={[type.small, { color: colors.inkMuted }]}>{li.quantity} × {formatINR(li.rate)}</Text>
            </View>
            <Text style={[type.h3, { color: colors.ink }]}>{formatINR(li.amount)}</Text>
          </View>
        ))}
        {(data.disbursements || []).map((d: any, idx: number) => (
          <View key={`d${idx}`} style={[styles.lineRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: colors.ink }]}>{d.description}</Text>
              <Text style={[type.small, { color: colors.inkMuted }]}>Disbursement</Text>
            </View>
            <Text style={[type.h3, { color: colors.ink }]}>{formatINR(d.amount)}</Text>
          </View>
        ))}

        <View style={[styles.totals, { borderColor: colors.border }]}>
          <View style={styles.totalRow}><Text style={[type.body, { color: colors.ink }]}>Subtotal</Text><Text style={[type.body, { color: colors.ink }]}>{formatINR(data.subtotal)}</Text></View>
          {data.include_gst && (
            <View style={styles.totalRow}><Text style={[type.body, { color: colors.ink }]}>GST @ 18%</Text><Text style={[type.body, { color: colors.ink }]}>{formatINR(data.gst_amount)}</Text></View>
          )}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm }]}>
            <Text style={[type.h3, { color: colors.ink }]}>Total</Text>
            <Text style={[type.h2, { color: colors.ink }]}>{formatINR(data.total_amount)}</Text>
          </View>
          {data.paid_amount > 0 && (
            <View style={styles.totalRow}><Text style={[type.body, { color: colors.ink }]}>Paid</Text><Text style={[type.body, { color: colors.success }]}>{formatINR(data.paid_amount)}</Text></View>
          )}
          {outstanding > 0 && (
            <View style={styles.totalRow}><Text style={[type.h3, { color: colors.ink }]}>Outstanding</Text><Text style={[type.h3, { color: colors.alert }]}>{formatINR(outstanding)}</Text></View>
          )}
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Button title={exporting ? "Preparing PDF..." : "Download PDF"} icon="download-outline" variant="secondary" onPress={exportPdf} loading={exporting} testID="inv-export-pdf" />
          {outstanding > 0 && (
            <Button title="Mark as paid" onPress={markPaid} testID="inv-mark-paid" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderBottomWidth: 1 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1 },
  totals: { padding: spacing.xl, borderTopWidth: 1, gap: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

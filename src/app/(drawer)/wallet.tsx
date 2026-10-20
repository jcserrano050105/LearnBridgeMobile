import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";
import ParentWallet from "../../screens/parent/ParentWallet";

// Mirrors the website's src/pages/tutor/WalletPage.jsx — same tables, same withdrawal flow,
// so requests made here show up in the admin's Transactions page on the website.

const PRIMARY = "#3D3BF3";
const GREEN   = "#059669";
const MUTED   = "#6B7280";
const MID     = "#374151";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";
const CARD    = "#FFFFFF";

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: string; sign: string }> = {
  earning:    { label: "Session Earning",    color: "#065F46", bg: "#D1FAE5", icon: "💰", sign: "+" },
  withdrawal: { label: "Withdrawal",         color: "#DC2626", bg: "#FEE2E2", icon: "📤", sign: "-" },
  deduction:  { label: "Platform Fee (10%)", color: "#D97706", bg: "#FEF9C3", icon: "🏛",  sign: "-" },
  topup:      { label: "Top Up",             color: "#1D4ED8", bg: "#EFF6FF", icon: "💳", sign: "+" },
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusStyle(status: string) {
  if (status === "completed") return { bg: "#D1FAE5", color: "#065F46" };
  if (status === "pending")   return { bg: "#FEF9C3", color: "#92400E" };
  return { bg: "#FEE2E2", color: "#DC2626" };
}

// Same split as the website's RoleWallet: tutors get earnings + withdraw, parents get top-up
export default function WalletScreen() {
  const { profile } = useAuth() as any;
  return profile?.role === "tutor" ? <TutorWallet /> : <ParentWallet />;
}

function TutorWallet() {
  const { user } = useAuth() as any;

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const [withdrawModal,  setWithdrawModal]  = useState(false);
  const [withdrawAmt,    setWithdrawAmt]    = useState("");
  const [paymongoName,   setPaymongoName]   = useState("");
  const [paymongoNumber, setPaymongoNumber] = useState("");
  const [withdrawing,    setWithdrawing]    = useState(false);
  const [formError,      setFormError]      = useState("");
  const [toast,          setToast]          = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch wallet ──────────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    if (!user) return;
    const [{ data: tutorRow }, { data: txns }] = await Promise.all([
      supabase.from("tutors").select("wallet_balance").eq("id", user.id).single(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setWalletBalance(Number(tutorRow?.wallet_balance || 0));
    setTransactions(txns || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWallet();
    setRefreshing(false);
  };

  const closeModal = () => {
    setWithdrawModal(false);
    setWithdrawAmt("");
    setPaymongoName("");
    setPaymongoNumber("");
    setFormError("");
  };

  // ── Withdraw (same rules as the website) ──────────────────────────
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmt);
    if (!amount || amount < 1)  { setFormError("Minimum withdrawal is ₱1."); return; }
    if (amount > walletBalance) { setFormError("Insufficient wallet balance."); return; }
    if (!paymongoName.trim())   { setFormError("Please enter your PayMongo account name."); return; }
    if (!paymongoNumber.trim()) { setFormError("Please enter your PayMongo account number."); return; }

    setFormError("");
    setWithdrawing(true);
    try {
      const { error: rpcErr } = await supabase.rpc("decrement_tutor_wallet", { tutor_id: user.id, amount });
      if (rpcErr) throw rpcErr;

      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        user_id:     user.id,
        type:        "withdrawal",
        amount,
        description: `Withdrawal to PayMongo — ${paymongoName.trim()} (${paymongoNumber.trim()})`,
        status:      "pending",
      });
      if (txErr) throw txErr;

      closeModal();
      showToast(`Withdrawal request of ₱${amount.toFixed(2)} submitted! Admin will process within 1-3 business days.`);
      fetchWallet();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  // ── Totals (same formulas as the website) ─────────────────────────
  const totalEarnings   = transactions.filter(t => t.type === "earning").reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalWithdrawn  = transactions.filter(t => t.type === "withdrawal" && t.status !== "failed").reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalEarned     = totalEarnings > 0 ? totalEarnings : walletBalance + totalWithdrawn;
  const totalCommission = transactions.filter(t => t.type === "deduction").reduce((s, t) => s + Number(t.amount || 0), 0);

  const canWithdraw = walletBalance > 0;
  const canSubmit   = !withdrawing && !!withdrawAmt && !!paymongoName && !!paymongoNumber;

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Wallet" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
      >
        <Text style={s.pageTitle}>💰 My Wallet</Text>
        <Text style={s.pageSub}>Track your earnings and request withdrawals.</Text>

        {toast && (
          <View style={[s.toast, toast.type === "error" ? s.toastErr : s.toastOk]}>
            <Text style={[s.toastTxt, { color: toast.type === "error" ? "#DC2626" : "#065F46" }]}>
              {toast.type === "error" ? "❌ " : "✅ "}{toast.msg}
            </Text>
            <TouchableOpacity onPress={() => setToast(null)}>
              <Ionicons name="close" size={16} color={toast.type === "error" ? "#DC2626" : "#065F46"} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Balance card ── */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>💰 Available Balance</Text>
          {loading
            ? <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
            : <Text style={s.balanceAmt}>{peso(walletBalance)}</Text>}
          <Text style={s.balanceNote}>90% of confirmed session payments</Text>
          <TouchableOpacity
            style={[s.withdrawBtn, !canWithdraw && { opacity: 0.6 }]}
            onPress={() => setWithdrawModal(true)}
            disabled={!canWithdraw}
          >
            <Text style={s.withdrawBtnTxt}>📤 Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary cards ── */}
        <View style={s.summaryRow}>
          {[
            { label: "Total Earned (90%)", value: peso(totalEarned),     bg: "#D1FAE5", color: "#065F46", icon: "💰" },
            { label: "Platform Fee (10%)", value: peso(totalCommission), bg: "#FEF9C3", color: "#D97706", icon: "🏛" },
            { label: "Total Withdrawn",    value: peso(totalWithdrawn),  bg: "#FEE2E2", color: "#DC2626", icon: "📤" },
          ].map(c => (
            <View key={c.label} style={[s.summaryCard, { backgroundColor: c.bg }]}>
              <Text style={s.summaryIcon}>{c.icon}</Text>
              <Text style={[s.summaryVal, { color: c.color }]} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
              <Text style={[s.summaryLabel, { color: c.color }]}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Transaction history ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Transaction History</Text>
            <Text style={s.cardCount}>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</Text>
          </View>

          {loading ? (
            <View style={s.empty}><ActivityIndicator color={GREEN} /></View>
          ) : transactions.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💰</Text>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptyTxt}>Your earnings will appear here after parents confirm and pay for sessions.</Text>
            </View>
          ) : (
            transactions.map((t, i) => {
              const tc = TYPE_CFG[t.type] || { label: t.type, color: MUTED, bg: "#F3F4F6", icon: "💸", sign: "" };
              const st = statusStyle(t.status);
              return (
                <View key={t.id} style={[s.txnRow, i < transactions.length - 1 && s.txnBorder]}>
                  <View style={[s.txnIcon, { backgroundColor: tc.bg }]}>
                    <Text style={{ fontSize: 18 }}>{tc.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txnDesc}>{t.description || tc.label}</Text>
                    <Text style={s.txnDate}>{fmtDateTime(t.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.txnAmt, { color: tc.color }]}>{tc.sign}{peso(Number(t.amount))}</Text>
                    {!!t.status && (
                      <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                        <Text style={[s.statusTxt, { color: st.color }]}>{t.status}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════
          WITHDRAW MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal visible={withdrawModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>📤 Withdraw Earnings</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.availBox}>
                <Text style={s.availLabel}>Available Balance</Text>
                <Text style={s.availAmt}>{peso(walletBalance)}</Text>
              </View>

              <Text style={s.fieldLabel}>Withdrawal Amount (₱)</Text>
              <View style={s.amtWrap}>
                <Text style={s.amtPeso}>₱</Text>
                <TextInput
                  style={[s.input, { paddingLeft: 30, marginBottom: 0 }]}
                  placeholder="0.00"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                  value={withdrawAmt}
                  onChangeText={setWithdrawAmt}
                />
              </View>
              <TouchableOpacity onPress={() => setWithdrawAmt(String(walletBalance))}>
                <Text style={s.withdrawAll}>Withdraw all (₱{walletBalance.toFixed(2)})</Text>
              </TouchableOpacity>

              <Text style={s.fieldLabel}>PayMongo Account Name</Text>
              <TextInput style={s.input} value={paymongoName} onChangeText={setPaymongoName} />

              <Text style={s.fieldLabel}>PayMongo Account Number</Text>
              <TextInput style={s.input} value={paymongoNumber} onChangeText={setPaymongoNumber} />

              <View style={s.noteBox}>
                <Text style={s.noteTxt}>
                  ⏳ Withdrawals are processed by admin within <Text style={{ fontWeight: "800" }}>1–3 business days</Text> via PayMongo.
                </Text>
              </View>

              {formError !== "" && <Text style={s.errorTxt}>{formError}</Text>}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeModal}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, !canSubmit && { opacity: 0.5 }]}
                onPress={handleWithdraw}
                disabled={!canSubmit}
              >
                {withdrawing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.submitTxt}>Submit Withdrawal Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content:   { padding: 16, paddingBottom: 80 },

  pageTitle: { fontSize: 22, fontWeight: "800", color: DARK },
  pageSub:   { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 16 },

  // Toast
  toast:    { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, marginBottom: 16 },
  toastOk:  { backgroundColor: "#D1FAE5" },
  toastErr: { backgroundColor: "#FEE2E2" },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "600" },

  // Balance card
  balanceCard:    { backgroundColor: GREEN, borderRadius: 16, padding: 24, marginBottom: 16 },
  balanceLabel:   { color: "#fff", opacity: 0.85, fontSize: 13, marginBottom: 6 },
  balanceAmt:     { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  balanceNote:    { color: "#fff", opacity: 0.75, fontSize: 12, marginTop: 6 },
  withdrawBtn:    { marginTop: 16, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  withdrawBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Summary
  summaryRow:   { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard:  { flex: 1, borderRadius: 14, padding: 12 },
  summaryIcon:  { fontSize: 20, marginBottom: 4 },
  summaryVal:   { fontSize: 15, fontWeight: "900" },
  summaryLabel: { fontSize: 10, opacity: 0.8, marginTop: 2 },

  // History card
  card:       { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  cardTitle:  { fontSize: 15, fontWeight: "700", color: DARK },
  cardCount:  { fontSize: 12, color: MUTED },
  empty:      { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: MUTED },
  emptyTxt:   { fontSize: 13, color: MUTED, textAlign: "center" },
  txnRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  txnBorder:  { borderBottomWidth: 1, borderBottomColor: BORDER },
  txnIcon:    { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  txnDesc:    { fontSize: 13, fontWeight: "600", color: DARK },
  txnDate:    { fontSize: 11, color: MUTED, marginTop: 2 },
  txnAmt:     { fontSize: 15, fontWeight: "800" },
  statusPill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusTxt:  { fontSize: 10, fontWeight: "700" },

  // Modal
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:  { fontSize: 17, fontWeight: "800", color: DARK },
  availBox:    { backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#6EE7B7", borderRadius: 10, padding: 14, marginBottom: 20 },
  availLabel:  { fontSize: 12, color: "#065F46", fontWeight: "600", marginBottom: 2 },
  availAmt:    { fontSize: 28, fontWeight: "900", color: "#065F46" },
  fieldLabel:  { fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 6 },
  amtWrap:     { justifyContent: "center" },
  amtPeso:     { position: "absolute", left: 14, zIndex: 1, fontWeight: "700", color: MID },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 16 },
  withdrawAll: { marginTop: 6, marginBottom: 16, fontSize: 11, color: PRIMARY, fontWeight: "600" },
  noteBox:     { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginBottom: 12 },
  noteTxt:     { fontSize: 12, color: "#92400E", lineHeight: 18 },
  errorTxt:    { fontSize: 12, color: "#DC2626", fontWeight: "600", marginBottom: 8 },
  modalFooter: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  cancelTxt:   { fontSize: 14, color: MUTED, fontWeight: "600" },
  submitBtn:   { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  submitTxt:   { color: "#fff", fontSize: 14, fontWeight: "700" },
});

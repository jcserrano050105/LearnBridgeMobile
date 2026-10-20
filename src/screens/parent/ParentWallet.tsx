import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";

// Mirrors the website's src/pages/parent/ParentWalletPage.jsx — same tables,
// same "paymongo-topup" Edge Function, same Simulate Payment demo button.

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const MID        = "#374151";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CARD       = "#FFFFFF";

const QUICK_AMOUNTS = [8, 50, 100, 500];

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: string; sign: string }> = {
  topup:      { label: "Top Up",   color: "#065F46", bg: "#D1FAE5", icon: "💰", sign: "+" },
  deduction:  { label: "Payment",  color: "#DC2626", bg: "#FEE2E2", icon: "💳", sign: "-" },
  earning:    { label: "Earning",  color: "#1D4ED8", bg: "#EFF6FF", icon: "📈", sign: "+" },
  withdrawal: { label: "Withdraw", color: "#D97706", bg: "#FEF9C3", icon: "📤", sign: "-" },
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

export default function ParentWallet() {
  const { user, profile } = useAuth() as any;

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions,  setTransactions]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const [topUpModal,  setTopUpModal]  = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topping,     setTopping]     = useState<"" | "simulate" | "paymongo">("");
  const [formError,   setFormError]   = useState("");
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Fetch wallet ──────────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: txns }] = await Promise.all([
      supabase.from("profiles").select("wallet_balance").eq("id", user.id).single(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setWalletBalance(Number(prof?.wallet_balance || 0));
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
    setTopUpModal(false);
    setTopUpAmount("");
    setFormError("");
  };

  const parseAmount = () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 1) { setFormError("Minimum top up is ₱1."); return null; }
    return amount;
  };

  // ── Simulate Payment (demo — same as the website's button) ────────
  const handleSimulatePayment = async () => {
    const amount = parseAmount();
    if (!amount) return;
    setFormError("");
    setTopping("simulate");
    try {
      const { error: rpcErr } = await supabase.rpc("increment_wallet", { user_id: user.id, amount });
      if (rpcErr) throw rpcErr;
      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        user_id:     user.id,
        type:        "topup",
        amount,
        description: "Wallet top up via PayMongo",
        status:      "completed",
      });
      if (txErr) throw txErr;
      closeModal();
      showToast(`₱${amount.toFixed(2)} added to your wallet!`);
      fetchWallet();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setTopping("");
    }
  };

  // ── Pay via PayMongo (same Edge Function as the website) ──────────
  const handleTopUp = async () => {
    const amount = parseAmount();
    if (!amount) return;
    setFormError("");
    setTopping("paymongo");
    try {
      const { data, error } = await supabase.functions.invoke("paymongo-topup", {
        body: { amount, userId: user.id, type: "topup" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { linkId, checkoutUrl } = data || {};
      if (!checkoutUrl) throw new Error("Could not start PayMongo checkout.");

      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        user_id:          user.id,
        type:             "topup",
        amount,
        description:      "Wallet top up via PayMongo",
        status:           "pending",
        paymongo_link_id: linkId,
      });
      if (txErr) throw txErr;

      closeModal();
      await WebBrowser.openBrowserAsync(checkoutUrl);
      // Back from the checkout page. The payment can't be verified from the app
      // (that needs a server-side check), so the top-up stays "pending" until confirmed.
      showToast("Your PayMongo top-up is pending. It will be added to your balance once the payment is confirmed.");
      fetchWallet();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setTopping("");
    }
  };

  const isVerified = profile?.status === "approved";

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Wallet" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <Text style={s.pageTitle}>💳 My Wallet</Text>
        <Text style={s.pageSub}>Manage your LearnBridge wallet balance and transactions.</Text>

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
          <Text style={s.balanceLabel}>💳 Available Balance</Text>
          {loading
            ? <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
            : <Text style={s.balanceAmt}>{peso(walletBalance)}</Text>}
          <Text style={s.balanceNote}>Used for session payments</Text>
          {isVerified ? (
            <TouchableOpacity style={s.topUpBtn} onPress={() => setTopUpModal(true)}>
              <Text style={s.topUpBtnTxt}>+ Top Up</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.verifyBox}>
              <Text style={s.verifyTxt}>🪪 Verify ID first</Text>
            </View>
          )}
        </View>

        {/* ── Transaction history ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Transaction History</Text>
            <Text style={s.cardCount}>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</Text>
          </View>

          {loading ? (
            <View style={s.empty}><ActivityIndicator color={PRIMARY} /></View>
          ) : transactions.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💳</Text>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptyTxt}>Top up your wallet to get started.</Text>
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
          TOP UP MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal visible={topUpModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>💳 Top Up Wallet</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.intro}>
                Add funds to your LearnBridge wallet via GCash, Maya, or Credit Card through PayMongo.
              </Text>

              <Text style={s.fieldLabel}>Quick amounts:</Text>
              <View style={s.quickRow}>
                {QUICK_AMOUNTS.map(a => {
                  const active = topUpAmount === String(a);
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[s.quickBtn, active && s.quickBtnActive]}
                      onPress={() => setTopUpAmount(String(a))}
                    >
                      <Text style={[s.quickTxt, active && { color: PRIMARY }]}>₱{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Or enter custom amount:</Text>
              <View style={s.amtWrap}>
                <Text style={s.amtPeso}>₱</Text>
                <TextInput
                  style={[s.input, { paddingLeft: 30 }]}
                  placeholder="0.00"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                  value={topUpAmount}
                  onChangeText={setTopUpAmount}
                />
              </View>

              <View style={s.noteBox}>
                <Text style={s.noteTxt}>
                  🧪 <Text style={{ fontWeight: "800" }}>Simulate Payment</Text> — instantly credits your wallet without PayMongo. For demo purposes only.
                </Text>
              </View>

              {formError !== "" && <Text style={s.errorTxt}>{formError}</Text>}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.simBtn, (!!topping || !topUpAmount) && { opacity: 0.5 }]}
                onPress={handleSimulatePayment}
                disabled={!!topping || !topUpAmount}
              >
                {topping === "simulate"
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.simTxt}>🧪 Simulate Payment</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.payBtn, (!!topping || !topUpAmount) && { opacity: 0.5 }]}
                onPress={handleTopUp}
                disabled={!!topping || !topUpAmount}
              >
                {topping === "paymongo"
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.payTxt}>Pay via PayMongo →</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.cancelLink} onPress={closeModal}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
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

  toast:    { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, marginBottom: 16 },
  toastOk:  { backgroundColor: "#D1FAE5" },
  toastErr: { backgroundColor: "#FEE2E2" },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "600" },

  balanceCard: { backgroundColor: PRIMARY, borderRadius: 16, padding: 24, marginBottom: 16 },
  balanceLabel:{ color: "#fff", opacity: 0.85, fontSize: 13, marginBottom: 6 },
  balanceAmt:  { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  balanceNote: { color: "#fff", opacity: 0.75, fontSize: 12, marginTop: 6 },
  topUpBtn:    { marginTop: 16, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  topUpBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  verifyBox:   { marginTop: 16, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  verifyTxt:   { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },

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

  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle:  { fontSize: 17, fontWeight: "800", color: DARK },
  intro:       { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 16 },
  fieldLabel:  { fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 8 },
  quickRow:    { flexDirection: "row", gap: 8, marginBottom: 16 },
  quickBtn:    { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: BORDER, backgroundColor: "#FAFAFA", alignItems: "center" },
  quickBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  quickTxt:    { fontSize: 13, fontWeight: "700", color: MID },
  amtWrap:     { justifyContent: "center" },
  amtPeso:     { position: "absolute", left: 14, top: 13, zIndex: 1, fontWeight: "700", color: MID },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 12 },
  noteBox:     { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginBottom: 12 },
  noteTxt:     { fontSize: 12, color: "#92400E", lineHeight: 18 },
  errorTxt:    { fontSize: 12, color: "#DC2626", fontWeight: "600", marginBottom: 8 },
  modalFooter: { flexDirection: "row", gap: 10, marginTop: 8 },
  simBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  simTxt:      { color: "#fff", fontSize: 13, fontWeight: "700" },
  payBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  payTxt:      { color: "#fff", fontSize: 13, fontWeight: "700" },
  cancelLink:  { alignItems: "center", paddingVertical: 12 },
  cancelTxt:   { fontSize: 14, color: MUTED, fontWeight: "600" },
});

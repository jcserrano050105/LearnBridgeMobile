import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const GREEN      = "#10B981";
const GREEN_BG   = "#D1FAE5";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const GCASH_NUMBER   = "0968 709 5884";
const GCASH_NAME     = "Ronn Alexis Leonardo";
const PRESET_AMOUNTS = [100, 200, 500, 1000];

const TXN_CFG: Record<string, { label: string; color: string; bg: string }> = {
  topup:                { label: "Top Up",     color: GREEN,  bg: GREEN_BG  },
  commission_deduction: { label: "Commission", color: CORAL,  bg: CORAL_BG  },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: ORANGE, bg: ORANGE_BG },
  approved: { label: "Approved", color: GREEN,  bg: GREEN_BG  },
  rejected: { label: "Rejected", color: CORAL,  bg: CORAL_BG  },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function WalletScreen() {
  const { user } = useAuth() as any;

  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topups,       setTopups]       = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"history" | "requests">("history");

  // Top-up modal state
  const [showTopup,  setShowTopup]  = useState(false);
  const [step,       setStep]       = useState<1 | 2>(1);
  const [amount,     setAmount]     = useState("");
  const [refNumber,  setRefNumber]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  // ── Fetch wallet data ─────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: tutorRow }, { data: txns }, { data: topupData }] = await Promise.all([
        supabase.from("tutors").select("wallet_balance").eq("id", user.id).single(),
        supabase.from("wallet_transactions").select("*").eq("tutor_id", user.id).order("created_at", { ascending: false }),
        supabase.from("wallet_topups").select("*").eq("tutor_id", user.id).order("created_at", { ascending: false }),
      ]);
      setBalance(tutorRow?.wallet_balance ?? 0);
      setTransactions(txns || []);
      setTopups(topupData || []);
    } catch (e: any) {
      console.error("fetchWallet error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const resetModal = () => {
    setShowTopup(false);
    setStep(1);
    setAmount("");
    setRefNumber("");
    setFormError("");
  };

  // ── Submit top-up request ─────────────────────────────────────────
  const handleSubmitTopup = async () => {
    if (!amount)           { setFormError("Please select a top-up amount."); return; }
    if (!refNumber.trim()) { setFormError("Please enter the GCash reference number."); return; }

    setFormError("");
    setSubmitting(true);
    try {
      // Check for duplicate reference
      const { data: existing } = await supabase
        .from("wallet_topups")
        .select("id")
        .eq("reference_number", refNumber.trim())
        .single();
      if (existing) throw new Error("This GCash reference number has already been submitted.");

      const { error } = await supabase.from("wallet_topups").insert({
        tutor_id:         user.id,
        amount:           Number(amount),
        reference_number: refNumber.trim(),
        status:           "pending",
      });
      if (error) throw error;

      resetModal();
      Alert.alert("Request Submitted! ✅", "Your top-up request has been submitted.\nThe admin will review and approve within 24 hours.");
      await fetchWallet();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount    = topups.filter(t => t.status === "pending").length;
  const totalTopups     = topups.filter(t => t.status === "approved").reduce((s, t) => s + Number(t.amount), 0);
  const totalCommission = transactions.filter(t => t.type === "commission_deduction").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Wallet" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Wallet" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWallet} tintColor={PRIMARY} />}
      >

        {/* ── Balance banner ── */}
        <View style={s.balanceBanner}>
          <Text style={s.balanceLabel}>Available Balance</Text>
          <Text style={s.balanceAmt}>
            ₱{Number(balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </Text>
          <TouchableOpacity style={s.topupBannerBtn} onPress={() => setShowTopup(true)}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={s.topupBannerTxt}>Top Up Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary cards ── */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: GREEN }]}>₱{totalTopups.toLocaleString()}</Text>
            <Text style={s.summaryLabel}>Total Top-Ups</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: CORAL }]}>₱{totalCommission.toLocaleString()}</Text>
            <Text style={s.summaryLabel}>Commission Paid</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: ORANGE }]}>{pendingCount}</Text>
            <Text style={s.summaryLabel}>Pending Requests</Text>
          </View>
        </View>

        {/* ── Info banner ── */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={s.infoTxt}>
            LearnBridge deducts a{" "}
            <Text style={{ fontWeight: "700" }}>10% platform commission</Text>
            {" "}from your wallet when the parent confirms session completion.
          </Text>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabRow}>
          {(["history", "requests"] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, activeTab === t && s.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>
                {t === "history"
                  ? "Transaction History"
                  : `Top-Up Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Transaction history ── */}
        {activeTab === "history" && (
          <View style={s.card}>
            {transactions.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
                <Text style={s.emptyTxt}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((t, i) => {
                const cfg      = TXN_CFG[t.type] || { label: t.type, color: MUTED, bg: "#F3F4F6" };
                const isCredit = Number(t.amount) > 0;
                return (
                  <View key={t.id} style={[s.txnRow, i < transactions.length - 1 && s.txnBorder]}>
                    <View style={[s.txnIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={isCredit ? "arrow-down" : "arrow-up"} size={16} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txnDesc}>{t.description || cfg.label}</Text>
                      <Text style={s.txnDate}>{fmtDate(t.created_at)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.txnAmt, { color: isCredit ? GREEN : CORAL }]}>
                        {isCredit ? "+" : ""}₱{Math.abs(Number(t.amount)).toLocaleString()}
                      </Text>
                      <Text style={s.txnBalance}>Bal: ₱{Number(t.balance_after || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Top-up requests ── */}
        {activeTab === "requests" && (
          <View style={s.card}>
            {topups.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="wallet-outline" size={40} color="#D1D5DB" />
                <Text style={s.emptyTxt}>No top-up requests yet</Text>
              </View>
            ) : (
              topups.map((t, i) => {
                const cfg = STATUS_CFG[t.status] || STATUS_CFG.pending;
                return (
                  <View key={t.id} style={[s.txnRow, i < topups.length - 1 && s.txnBorder]}>
                    <View style={[s.txnIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name="cash-outline" size={16} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txnDesc}>₱{Number(t.amount).toLocaleString()} Top-Up</Text>
                      <Text style={s.txnDate}>Ref: {t.reference_number}</Text>
                      <Text style={s.txnDate}>{fmtDate(t.created_at)}</Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════
          TOP UP MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal visible={showTopup} transparent animationType="slide" onRequestClose={resetModal}>
        <View style={s.overlay}>
          <View style={s.modalBox}>

            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {step === 1 ? "Top Up Wallet" : "Submit Payment Proof"}
              </Text>
              <TouchableOpacity onPress={resetModal}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── Step 1: Amount + GCash info ── */}
              {step === 1 && (
                <>
                  <Text style={s.fieldLabel}>Select Amount</Text>
                  <View style={s.amountGrid}>
                    {PRESET_AMOUNTS.map(a => (
                      <TouchableOpacity
                        key={a}
                        style={[s.amountBtn, amount === String(a) && s.amountBtnActive]}
                        onPress={() => setAmount(String(a))}
                      >
                        <Text style={[s.amountTxt, amount === String(a) && s.amountTxtActive]}>
                          ₱{a}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={s.input}
                    placeholder="Or enter custom amount (e.g. 750)"
                    placeholderTextColor={MUTED}
                    keyboardType="numeric"
                    value={PRESET_AMOUNTS.includes(Number(amount)) ? "" : amount}
                    onChangeText={v => setAmount(v)}
                  />

                  {/* GCash info box */}
                  <View style={s.gcashBox}>
                    <Text style={s.gcashTitle}>📱 Send to GCash</Text>
                    <View style={s.gcashRow}>
                      <Text style={s.gcashLabel}>Number</Text>
                      <Text style={s.gcashVal}>{GCASH_NUMBER}</Text>
                    </View>
                    <View style={s.gcashRow}>
                      <Text style={s.gcashLabel}>Name</Text>
                      <Text style={s.gcashVal}>{GCASH_NAME}</Text>
                    </View>
                    <View style={[s.gcashRow, { borderBottomWidth: 0 }]}>
                      <Text style={s.gcashLabel}>Amount</Text>
                      <Text style={[s.gcashVal, { color: PRIMARY, fontWeight: "800" }]}>
                        {amount ? `₱${Number(amount).toLocaleString()}` : "—"}
                      </Text>
                    </View>
                  </View>

                  {formError !== "" && <Text style={s.errorTxt}>{formError}</Text>}

                  <TouchableOpacity
                    style={[s.nextBtn, !amount && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!amount) { setFormError("Please select an amount."); return; }
                      setFormError("");
                      setStep(2);
                    }}
                    disabled={!amount}
                  >
                    <Text style={s.nextBtnTxt}>I've Sent the Payment →</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 2: Reference number ── */}
              {step === 2 && (
                <>
                  <View style={s.infoBanner}>
                    <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
                    <Text style={[s.infoTxt, { flex: 1 }]}>
                      Enter the GCash reference number from your transaction. Admin will verify and credit your wallet within 24 hours.
                    </Text>
                  </View>

                  <Text style={s.fieldLabel}>GCash Reference Number *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 1234567890"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    value={refNumber}
                    onChangeText={setRefNumber}
                  />

                  <View style={s.summaryBox}>
                    <Text style={s.summaryBoxTitle}>Request Summary</Text>
                    <View style={s.gcashRow}>
                      <Text style={s.gcashLabel}>Amount</Text>
                      <Text style={[s.gcashVal, { color: PRIMARY, fontWeight: "800" }]}>
                        ₱{Number(amount).toLocaleString()}
                      </Text>
                    </View>
                    <View style={[s.gcashRow, { borderBottomWidth: 0 }]}>
                      <Text style={s.gcashLabel}>Reference</Text>
                      <Text style={s.gcashVal}>{refNumber || "—"}</Text>
                    </View>
                  </View>

                  {formError !== "" && <Text style={s.errorTxt}>{formError}</Text>}
                </>
              )}
            </ScrollView>

            {/* Modal footer */}
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.modalBackBtn}
                onPress={() => step === 1 ? resetModal() : setStep(1)}
              >
                <Text style={s.modalBackTxt}>{step === 1 ? "Cancel" : "← Back"}</Text>
              </TouchableOpacity>
              {step === 2 && (
                <TouchableOpacity
                  style={[s.submitBtn, (submitting || !refNumber.trim()) && { opacity: 0.5 }]}
                  onPress={handleSubmitTopup}
                  disabled={submitting || !refNumber.trim()}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={s.submitBtnTxt}>Submit Request</Text></>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content:   { padding: 16, paddingBottom: 80 },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center" },

  // Balance banner
  balanceBanner:  { backgroundColor: PRIMARY, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16 },
  balanceLabel:   { color: "rgba(255,255,255,.8)", fontSize: 13, marginBottom: 4 },
  balanceAmt:     { color: "#fff", fontSize: 36, fontWeight: "800", marginBottom: 16 },
  topupBannerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.2)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,.3)" },
  topupBannerTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Summary cards
  summaryRow:  { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: "center" },
  summaryVal:  { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  summaryLabel:{ fontSize: 10, color: MUTED, textAlign: "center" },

  // Info banner
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: PRIMARY_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoTxt:    { fontSize: 12, color: PRIMARY, lineHeight: 17 },

  // Tabs
  tabRow:      { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 10, padding: 4, marginBottom: 16 },
  tabBtn:      { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  tabBtnActive:{ backgroundColor: CARD, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt:      { fontSize: 12, color: MUTED, fontWeight: "600" },
  tabTxtActive:{ color: DARK, fontWeight: "700" },

  // Card
  card:    { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16, overflow: "hidden" },
  empty:   { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxt:{ fontSize: 13, color: MUTED },

  // Transaction row
  txnRow:     { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  txnBorder:  { borderBottomWidth: 1, borderBottomColor: BORDER },
  txnIcon:    { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  txnDesc:    { fontSize: 13, fontWeight: "600", color: DARK },
  txnDate:    { fontSize: 11, color: MUTED, marginTop: 2 },
  txnAmt:     { fontSize: 14, fontWeight: "800" },
  txnBalance: { fontSize: 10, color: MUTED, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillTxt: { fontSize: 11, fontWeight: "700" },

  // Modal
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:     { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:   { fontSize: 17, fontWeight: "800", color: DARK },
  fieldLabel:   { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 8 },
  amountGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  amountBtn:    { width: "47%", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB", alignItems: "center" },
  amountBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  amountTxt:    { fontSize: 16, fontWeight: "700", color: MUTED },
  amountTxtActive: { color: PRIMARY },
  input:        { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 16 },
  gcashBox:     { backgroundColor: "#F0FDF4", borderRadius: 12, borderWidth: 1.5, borderColor: "#6EE7B7", padding: 16, marginBottom: 16 },
  gcashTitle:   { fontSize: 14, fontWeight: "700", color: "#065F46", marginBottom: 10 },
  gcashRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#D1FAE5" },
  gcashLabel:   { fontSize: 12, color: MUTED, fontWeight: "600" },
  gcashVal:     { fontSize: 13, fontWeight: "600", color: DARK },
  summaryBox:   { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 16 },
  summaryBoxTitle: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 10 },
  errorTxt:     { fontSize: 12, color: CORAL, marginBottom: 12 },
  nextBtn:      { backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  nextBtnTxt:   { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalFooter:  { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBackBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  modalBackTxt: { fontSize: 14, color: MUTED, fontWeight: "600" },
  submitBtn:    { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY },
  submitBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
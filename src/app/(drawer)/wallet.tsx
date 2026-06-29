import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY = "#3D3BF3";
const TEAL    = "#0D9488";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";
const BG      = "#F5F7FB";
const GREEN   = "#10B981";
const CORAL   = "#EF4444";

export default function WalletPage() {
  const { user } = useAuth() as any;
  const [balance,  setBalance]  = useState(0);
  const [txns,     setTxns]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: tutor } = await supabase
        .from("tutors").select("wallet_balance").eq("id", user.id).single();
      setBalance(tutor?.wallet_balance || 0);

      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });
      setTxns(data || []);
      setLoading(false);
    })();
  }, [user]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <View style={styles.container}>
      <Header title="LearnBridge" subtitle="Wallet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Ionicons name="wallet-outline" size={28} color={TEAL} />
          </View>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceValue}>₱{balance.toLocaleString()}</Text>
          <TouchableOpacity style={styles.topupBtn}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.topupBtnText}>Request Top-Up</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
        ) : txns.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>Your wallet activity will appear here.</Text>
          </View>
        ) : (
          txns.map((t, i) => (
            <View key={t.id} style={[styles.txnRow, i < txns.length - 1 && styles.txnBorder]}>
              <View style={[styles.txnIcon, { backgroundColor: Number(t.amount) > 0 ? "#D1FAE5" : "#FEE2E2" }]}>
                <Ionicons
                  name={Number(t.amount) > 0 ? "arrow-down-outline" : "arrow-up-outline"}
                  size={16}
                  color={Number(t.amount) > 0 ? GREEN : CORAL}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc}>{t.description || t.type}</Text>
                <Text style={styles.txnDate}>{t.created_at ? formatDate(t.created_at) : "—"}</Text>
              </View>
              <Text style={[styles.txnAmount, { color: Number(t.amount) > 0 ? GREEN : CORAL }]}>
                {Number(t.amount) > 0 ? "+" : ""}₱{Math.abs(Number(t.amount)).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  content:       { padding: 16, paddingBottom: 40 },
  balanceCard:   { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, alignItems: "center", marginBottom: 24 },
  balanceIcon:   { width: 60, height: 60, borderRadius: 16, backgroundColor: "#CCFBF1", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  balanceLabel:  { fontSize: 13, color: MUTED, marginBottom: 4 },
  balanceValue:  { fontSize: 36, fontWeight: "800", color: DARK, marginBottom: 20 },
  topupBtn:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  topupBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle:  { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 12 },
  empty:         { alignItems: "center", marginTop: 40 },
  emptyIcon:     { fontSize: 40, marginBottom: 10 },
  emptyTitle:    { fontSize: 15, fontWeight: "700", color: DARK },
  emptyText:     { fontSize: 13, color: MUTED, marginTop: 6 },
  txnRow:        { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, backgroundColor: "#fff", paddingHorizontal: 16 },
  txnBorder:     { borderBottomWidth: 1, borderBottomColor: BORDER },
  txnIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txnDesc:       { fontSize: 13, fontWeight: "600", color: DARK },
  txnDate:       { fontSize: 11, color: MUTED, marginTop: 2 },
  txnAmount:     { fontSize: 15, fontWeight: "800" },
});
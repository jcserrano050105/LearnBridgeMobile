import React, { useState } from "react";
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import useTutorDashboard from "../../hooks/useTutorDashboard";
import { useGreeting } from "../../hooks/useGreeting";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const TEAL       = "#0D9488";
const TEAL_BG    = "#CCFBF1";
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const GREEN      = "#10B981";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD_BG    = "#FFFFFF";

function StatCard({ label, value, icon, accentColor, bgColor }: {
  label: string; value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string; bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accentColor }]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
    </View>
  );
}

function QuickAction({ label, icon, color, bg, onPress }: {
  label: string; icon: keyof typeof Ionicons.glyphMap;
  color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TutorDashboard() {
  const { profile } = useAuth() as any;
  const router = useRouter();
  const {
    stats, todaySessions, pendingBookings,
    loading, error, respondToBooking, refresh,
  } = useTutorDashboard() as any;

  const [responding, setResponding] = useState<Record<string, boolean>>({});
  const name = profile?.full_name?.split(" ")[0] || "Tutor";

  const greeting = useGreeting();

  const handleRespond = async (bookingId: string, accept: boolean) => {
    setResponding(r => ({ ...r, [bookingId]: true }));
    try {
      await respondToBooking(bookingId, accept);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setResponding(r => ({ ...r, [bookingId]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="LearnBridge" subtitle="Tutor" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="LearnBridge" subtitle="Tutor" />
        <View style={styles.centered}>
          <Text style={{ color: CORAL, marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="LearnBridge" subtitle="Tutor" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={PRIMARY} />}
      >
        {/* ── Welcome ── */}
        <Text style={styles.greeting}>{greeting}, {name} 👋</Text>
        <Text style={styles.subtitle}>Manage your sessions, wallet, and tutee requests.</Text>

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          <StatCard label="Active Tutees"       value={stats?.activeTutees ?? 0}                                icon="people-outline"  accentColor={PRIMARY} bgColor={PRIMARY_BG} />
          <StatCard label="Sessions This Month" value={stats?.sessionsThisMonth ?? 0}                          icon="calendar-outline" accentColor={ORANGE}  bgColor={ORANGE_BG}  />
          <StatCard label="Wallet Balance"      value={`₱${(stats?.walletBalance ?? 0).toLocaleString()}`}    icon="wallet-outline"  accentColor={TEAL}   bgColor={TEAL_BG}    />
          <StatCard label="Pending Requests"    value={pendingBookings?.length ?? 0}                           icon="time-outline"    accentColor={CORAL}  bgColor={CORAL_BG}   />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction label="Bookings"      icon="calendar-outline" color={PRIMARY} bg={PRIMARY_BG} onPress={() => router.push("/(drawer)/bookings"      as any)} />
          <QuickAction label="Sessions"      icon="book-outline"     color={ORANGE}  bg={ORANGE_BG}  onPress={() => router.push("/(drawer)/sessions"       as any)} />
          <QuickAction label="Wallet"        icon="wallet-outline"   color={TEAL}    bg={TEAL_BG}    onPress={() => router.push("/(drawer)/wallet"         as any)} />
          <QuickAction label="Certification" icon="ribbon-outline"   color={CORAL}   bg={CORAL_BG}   onPress={() => router.push("/(drawer)/certification"  as any)} />
        </View>

        {/* ── Today's Sessions ── */}
        <Text style={styles.sectionTitle}>Today's Sessions</Text>
        <View style={styles.card}>
          {!todaySessions || todaySessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No sessions today</Text>
              <Text style={styles.emptyText}>Your scheduled sessions will appear here.</Text>
            </View>
          ) : (
            todaySessions.map((s: any, i: number) => (
              <View key={s.id} style={[styles.sessionRow, i < todaySessions.length - 1 && styles.rowBorder]}>
                <View style={[styles.sessionDot, { backgroundColor: PRIMARY }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>{s.booking?.student?.name || "Student"}</Text>
                  <Text style={styles.sessionSub}>{s.booking?.subject} · {s.scheduled_time?.slice(0, 5) || ""}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: PRIMARY_BG }]}>
                  <Text style={[styles.statusTxt, { color: PRIMARY }]}>Scheduled</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Pending Booking Requests ── */}
        <Text style={styles.sectionTitle}>Booking Requests</Text>
        <View style={styles.card}>
          {!pendingBookings || pendingBookings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyText}>New booking requests will appear here.</Text>
            </View>
          ) : (
            pendingBookings.map((b: any, i: number) => (
              <View key={b.id} style={[styles.bookingItem, i < pendingBookings.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>
                    {b.student?.name || "Student"}
                    {b.student?.grade_level ? ` · Grade ${b.student.grade_level}` : ""}
                  </Text>
                  <Text style={styles.sessionSub}>
                    {b.parent?.full_name || "Parent"} · {b.subject}
                  </Text>
                  <Text style={styles.sessionSub}>
                    {b.session_mode} · {b.payment_method}
                  </Text>
                </View>
                <View style={styles.respondBtns}>
                  <TouchableOpacity
                    style={[styles.respondBtn, styles.acceptBtn]}
                    onPress={() => handleRespond(b.id, true)}
                    disabled={responding[b.id]}
                  >
                    {responding[b.id]
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.respondTxt}>Accept</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.respondBtn, styles.rejectBtn]}
                    onPress={() => handleRespond(b.id, false)}
                    disabled={responding[b.id]}
                  >
                    <Text style={[styles.respondTxt, { color: CORAL }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "transparent" },
  content:      { padding: 16, paddingBottom: 100 },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  retryBtn:     { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  greeting:     { fontSize: 22, fontWeight: "800", color: DARK, marginTop: 4 },
  subtitle:     { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 20 },

  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:     { width: "47.5%", backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: BORDER },
  statIcon:     { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:    { fontSize: 10, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue:    { fontSize: 24, fontWeight: "800" },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 12 },

  quickGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  quickBtn:     { width: "47%", backgroundColor: CARD_BG, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: BORDER },
  quickIcon:    { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLabel:   { fontSize: 12, fontWeight: "600", color: DARK, textAlign: "center" },

  card:         { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 24, overflow: "hidden" },
  emptyBox:     { alignItems: "center", padding: 32 },
  emptyIcon:    { fontSize: 32, marginBottom: 8 },
  emptyTitle:   { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 4 },
  emptyText:    { fontSize: 12, color: MUTED, textAlign: "center" },

  sessionRow:   { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: BORDER },
  sessionDot:   { width: 8, height: 8, borderRadius: 4 },
  sessionName:  { fontSize: 14, fontWeight: "700", color: DARK },
  sessionSub:   { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:    { fontSize: 10, fontWeight: "700" },

  bookingItem:  { padding: 14, gap: 10 },
  respondBtns:  { flexDirection: "row", gap: 8, marginTop: 10 },
  respondBtn:   { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  acceptBtn:    { backgroundColor: PRIMARY },
  rejectBtn:    { backgroundColor: CORAL_BG, borderWidth: 1, borderColor: CORAL },
  respondTxt:   { fontSize: 13, fontWeight: "700", color: "#fff" },
});
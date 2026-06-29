import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import useTutorDashboard from "../../hooks/useTutorDashboard";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const TEAL       = "#0D9488";
const ORANGE     = "#F59E0B";
const CORAL      = "#EF4444";
const GREEN      = "#10B981";
const BORDER     = "#E5E7EB";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BG         = "#F5F7FB";
const CARD_BG    = "#FFFFFF";
const PRIMARY_BG = "#EBEBFF";
const ORANGE_BG  = "#FEF3C7";
const TEAL_BG    = "#CCFBF1";
const CORAL_BG   = "#FEE2E2";

function StatCard({
  label, value, icon, accentColor, bgColor,
}: {
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

export default function TutorDashboard() {
  const { profile } = useAuth() as any;
  const {
    stats,
    todaySessions,
    pendingBookings,
    loading,
    error,
    respondToBooking,
    refresh,
  } = useTutorDashboard() as any;

  const [responding, setResponding] = useState<Record<string, boolean>>({});

  const name = profile?.full_name?.split(" ")[0] || "Tutor";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleRespond = async (bookingId: string, accept: boolean) => {
    setResponding((r) => ({ ...r, [bookingId]: true }));
    try {
      await respondToBooking(bookingId, accept);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setResponding((r) => ({ ...r, [bookingId]: false }));
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
      {/* ── Header with hamburger menu ── */}
      <Header title="LearnBridge" subtitle="Tutor" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome ── */}
        <Text style={styles.greeting}>
          {getGreeting()}, {name} 👋
        </Text>
        <Text style={styles.subtitle}>
          Manage your sessions, wallet, and tutee requests.
        </Text>

        {/* ── 4 Stat Cards ── */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Active Tutees"
            value={stats?.activeTutees ?? 0}
            icon="people-outline"
            accentColor={PRIMARY}
            bgColor={PRIMARY_BG}
          />
          <StatCard
            label="Sessions This Month"
            value={stats?.sessionsThisMonth ?? 0}
            icon="calendar-outline"
            accentColor={ORANGE}
            bgColor={ORANGE_BG}
          />
          <StatCard
            label="Wallet Balance"
            value={`₱${(stats?.walletBalance ?? 0).toLocaleString()}`}
            icon="wallet-outline"
            accentColor={TEAL}
            bgColor={TEAL_BG}
          />
          <StatCard
            label="Pending Requests"
            value={pendingBookings?.length ?? 0}
            icon="star-outline"
            accentColor={CORAL}
            bgColor={CORAL_BG}
          />
        </View>

        {/* ── Today's Sessions & Booking Requests ── */}
        <View style={styles.twoCol}>

          {/* Today's Sessions */}
          <View style={[styles.card, { flex: 1, marginRight: 6 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's{"\n"}Sessions</Text>
              <View style={[styles.badge, { backgroundColor: PRIMARY_BG }]}>
                <Text style={[styles.badgeText, { color: PRIMARY }]}>
                  {todaySessions?.length ?? 0} TODAY
                </Text>
              </View>
            </View>

            {!todaySessions || todaySessions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No sessions today</Text>
                <Text style={styles.emptyText}>
                  Your scheduled sessions will appear here.
                </Text>
              </View>
            ) : (
              todaySessions.map((s: any, i: number) => (
                <View
                  key={s.id}
                  style={[
                    styles.sessionRow,
                    i < todaySessions.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={[styles.sessionDot, { backgroundColor: PRIMARY }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionName}>
                      {s.booking?.student?.name || "Student"}
                    </Text>
                    <Text style={styles.sessionSub}>
                      {s.booking?.subject} · {s.scheduled_time?.slice(0, 5) || ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Booking Requests */}
          <View style={[styles.card, { flex: 1, marginLeft: 6 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Booking{"\n"}Requests</Text>
              {pendingBookings?.length > 0 && (
                <View style={[styles.badge, { backgroundColor: ORANGE_BG }]}>
                  <Text style={[styles.badgeText, { color: ORANGE }]}>
                    {pendingBookings.length} PENDING
                  </Text>
                </View>
              )}
            </View>

            {!pendingBookings || pendingBookings.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>No pending requests</Text>
              </View>
            ) : (
              pendingBookings.map((b: any, i: number) => (
                <View
                  key={b.id}
                  style={[
                    styles.bookingItem,
                    i < pendingBookings.length - 1 && styles.rowBorder,
                  ]}
                >
                  <Text style={styles.sessionName}>
                    {b.student?.name || "Student"}
                    {b.student?.grade_level ? ` (Grade ${b.student.grade_level})` : ""}
                  </Text>
                  <Text style={styles.sessionSub}>
                    {b.subject} · {b.session_mode}
                  </Text>
                  <Text style={styles.sessionSub}>
                    Parent: {b.parent?.full_name || "—"}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#D1FAE5" }]}
                      onPress={() => handleRespond(b.id, true)}
                      disabled={responding[b.id]}
                    >
                      <Ionicons name="checkmark" size={12} color={GREEN} />
                      <Text style={[styles.actionText, { color: GREEN }]}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: CORAL_BG }]}
                      onPress={() => handleRespond(b.id, false)}
                      disabled={responding[b.id]}
                    >
                      <Ionicons name="close" size={12} color={CORAL} />
                      <Text style={[styles.actionText, { color: CORAL }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── AI Certification Banner ── */}
        <View style={styles.certBanner}>
          <View style={styles.certIcon}>
            <Ionicons name="ribbon-outline" size={28} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.certTitle}>AI Certification Exam</Text>
            <Text style={styles.certSub}>
              Take topic-based exams to get matched with students
            </Text>
            <TouchableOpacity style={styles.certBtn}>
              <Text style={styles.certBtnText}>Go to Certification</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: BG },
  content:          { padding: 16, paddingBottom: 40 },
  centered:         { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  retryBtn:         { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },

  greeting:         { fontSize: 20, fontWeight: "800", color: DARK, marginTop: 4 },
  subtitle:         { fontSize: 12, color: MUTED, marginTop: 4, marginBottom: 16 },

  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard:         {
    width: "47.5%", backgroundColor: CARD_BG, borderRadius: 12,
    padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: BORDER,
  },
  statIcon:         { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:        { fontSize: 10, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue:        { fontSize: 24, fontWeight: "800" },

  twoCol:           { flexDirection: "row", marginBottom: 14 },

  card:             { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12 },
  cardHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardTitle:        { fontSize: 12, fontWeight: "700", color: DARK, flex: 1 },

  badge:            { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText:        { fontSize: 9, fontWeight: "700" },

  emptyBox:         { alignItems: "center", paddingVertical: 16 },
  emptyIcon:        { fontSize: 26, marginBottom: 6 },
  emptyTitle:       { fontSize: 12, fontWeight: "700", color: DARK, textAlign: "center" },
  emptyText:        { fontSize: 10, color: MUTED, textAlign: "center", marginTop: 4 },

  sessionRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  rowBorder:        { borderBottomWidth: 1, borderBottomColor: BORDER },
  sessionDot:       { width: 7, height: 7, borderRadius: 4 },
  sessionName:      { fontSize: 11, fontWeight: "700", color: DARK },
  sessionSub:       { fontSize: 10, color: MUTED, marginTop: 2 },

  bookingItem:      { paddingVertical: 8 },
  actionRow:        { flexDirection: "row", gap: 6, marginTop: 6 },
  actionBtn:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  actionText:       { fontSize: 11, fontWeight: "700" },

  certBanner:       {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#FEFCE8", borderRadius: 12,
    borderWidth: 1, borderColor: "#FEF08A", padding: 14,
  },
  certIcon:         { width: 44, height: 44, borderRadius: 10, backgroundColor: PRIMARY_BG, alignItems: "center", justifyContent: "center" },
  certTitle:        { fontSize: 14, fontWeight: "800", color: DARK, marginBottom: 4 },
  certSub:          { fontSize: 11, color: MUTED, marginBottom: 10 },
  certBtn:          { backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, alignSelf: "flex-start" },
  certBtnText:      { color: "#fff", fontSize: 12, fontWeight: "700" },
});
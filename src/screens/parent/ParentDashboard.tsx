import React from "react";
import {
  ScrollView, Text, View, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import useParentDashboard from "../../hooks/useParentDashboard";

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

function PerformanceBadge({ indicator }: { indicator: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    good:             { label: "Good",             color: GREEN,  bg: "#D1FAE5" },
    improving:        { label: "Improving",        color: ORANGE, bg: ORANGE_BG },
    needs_improvement:{ label: "Needs Improvement",color: CORAL,  bg: CORAL_BG  },
  };
  const cfg = map[indicator] || { label: indicator, color: MUTED, bg: "#F3F4F6" };
  return (
    <View style={[styles.perfBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.perfBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function ParentDashboard() {
  const { profile } = useAuth() as any;
  const router = useRouter();
  const { stats, upcomingSessions, recentFeedback, loading, error, refresh } = useParentDashboard() as any;

  const firstName = profile?.full_name?.split(" ")[0] || "Parent";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="LearnBridge" subtitle="Parent" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="LearnBridge" subtitle="Parent" />
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
      <Header title="LearnBridge" subtitle="Parent" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={PRIMARY} />}
      >
        {/* ── Welcome ── */}
        <Text style={styles.greeting}>{getGreeting()}, {firstName} 👋</Text>
        <Text style={styles.subtitle}>Here's an overview of your children's learning progress.</Text>

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          <StatCard label="Active Children"   value={stats?.children ?? 0}            icon="people-outline"   accentColor={PRIMARY} bgColor={PRIMARY_BG} />
          <StatCard label="Upcoming Sessions" value={stats?.upcoming ?? 0}            icon="calendar-outline" accentColor={ORANGE}  bgColor={ORANGE_BG}  />
          <StatCard label="Hours This Month"  value={`${stats?.hoursThisMonth ?? 0}h`} icon="book-outline"    accentColor={TEAL}   bgColor={TEAL_BG}    />
          <StatCard label="Recent Feedback"   value={recentFeedback?.length ?? 0}     icon="star-outline"    accentColor={CORAL}  bgColor={CORAL_BG}   />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction label="My Children" icon="people-outline"     color={PRIMARY} bg={PRIMARY_BG} onPress={() => router.push("/(drawer)/children" as any)} />
          <QuickAction label="Find Tutors" icon="search-outline"     color={ORANGE}  bg={ORANGE_BG}  onPress={() => router.push("/(drawer)/tutors"   as any)} />
          <QuickAction label="Bookings"    icon="calendar-outline"   color={TEAL}    bg={TEAL_BG}    onPress={() => router.push("/(drawer)/bookings"  as any)} />
          <QuickAction label="Progress"    icon="stats-chart-outline" color={CORAL}  bg={CORAL_BG}   onPress={() => router.push("/(drawer)/progress"  as any)} />
        </View>

        {/* ── Upcoming Sessions ── */}
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        <View style={styles.card}>
          {!upcomingSessions || upcomingSessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No upcoming sessions</Text>
              <Text style={styles.emptyText}>Book a tutor to get started.</Text>
            </View>
          ) : (
            upcomingSessions.map((s: any, i: number) => (
              <View key={s.id} style={[styles.sessionRow, i < upcomingSessions.length - 1 && styles.rowBorder]}>
                <View style={[styles.sessionDot, { backgroundColor: PRIMARY }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>{s.booking?.student?.name || "Student"}</Text>
                  <Text style={styles.sessionSub}>{s.booking?.subject} · {s.booking?.tutor?.full_name || "Tutor"}</Text>
                  <Text style={styles.sessionSub}>{s.scheduled_date}{s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ""}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: PRIMARY_BG }]}>
                  <Text style={[styles.statusTxt, { color: PRIMARY }]}>Scheduled</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Recent Feedback ── */}
        <Text style={styles.sectionTitle}>Recent Feedback</Text>
        <View style={styles.card}>
          {!recentFeedback || recentFeedback.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No feedback yet</Text>
              <Text style={styles.emptyText}>Feedback from completed sessions will appear here.</Text>
            </View>
          ) : (
            recentFeedback.map((s: any, i: number) => (
              <View key={s.id} style={[styles.feedbackRow, i < recentFeedback.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.feedbackTop}>
                    <Text style={styles.sessionName}>{s.booking?.student?.name || "Student"}</Text>
                    {s.performance_indicator && <PerformanceBadge indicator={s.performance_indicator} />}
                  </View>
                  <Text style={styles.sessionSub}>{s.booking?.subject} · {s.booking?.tutor?.full_name}</Text>
                  {s.topic_covered && <Text style={styles.feedbackTopic}>Topic: {s.topic_covered}</Text>}
                  {s.tutor_comments && <Text style={styles.feedbackComment}>"{s.tutor_comments}"</Text>}
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
  container:    { flex: 1, backgroundColor: BG },
  content:      { padding: 16, paddingBottom: 100 },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  retryBtn:     { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  greeting:     { fontSize: 22, fontWeight: "800", color: DARK, marginTop: 4 },
  subtitle:     { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 20 },

  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:     { width: "47.5%", backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: BORDER },
  statIcon:     { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:    { fontSize: 10, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue:    { fontSize: 26, fontWeight: "800" },

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

  feedbackRow:  { padding: 14 },
  feedbackTop:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  feedbackTopic:{ fontSize: 12, color: MUTED, marginTop: 4 },
  feedbackComment:{ fontSize: 12, color: DARK, fontStyle: "italic", marginTop: 4 },
  perfBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  perfBadgeTxt: { fontSize: 10, fontWeight: "700" },
});
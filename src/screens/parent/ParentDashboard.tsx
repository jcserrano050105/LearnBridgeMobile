import {
  ScrollView, Text, View, StyleSheet,
  ActivityIndicator, TouchableOpacity,
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

// ── Stat Card ────────────────────────────────────────────────────────────────
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

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({
  label, icon, color, bg, onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; bg: string;
  onPress: () => void;
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const { profile } = useAuth() as any;
  const router = useRouter();

  // ── Real data from Supabase via useParentDashboard hook ──
  const {
    stats,
    upcomingSessions,
    recentFeedback,
    loading,
    error,
    refresh,
  } = useParentDashboard() as any;

  const firstName = profile?.full_name?.split(" ")[0] || "Parent";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const performanceColor = (indicator: string) => {
    if (indicator === "good")              return { text: GREEN,  bg: "#D1FAE5" };
    if (indicator === "improving")         return { text: ORANGE, bg: ORANGE_BG };
    if (indicator === "needs_improvement") return { text: CORAL,  bg: CORAL_BG  };
    return { text: MUTED, bg: "#F3F4F6" };
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
      >
        {/* ── Welcome ── */}
        <Text style={styles.greeting}>
          {getGreeting()}, {firstName} 👋
        </Text>
        <Text style={styles.subtitle}>
          Here's an overview of your children's learning progress.
        </Text>

        {/* ── 4 Stat Cards (all from real DB) ── */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Active Children"
            value={stats?.children ?? 0}
            icon="people-outline"
            accentColor={PRIMARY}
            bgColor={PRIMARY_BG}
          />
          <StatCard
            label="Upcoming Sessions"
            value={stats?.upcoming ?? 0}
            icon="calendar-outline"
            accentColor={ORANGE}
            bgColor={ORANGE_BG}
          />
          <StatCard
            label="Hours This Month"
            value={stats?.hoursThisMonth ?? 0}
            icon="book-outline"
            accentColor={TEAL}
            bgColor={TEAL_BG}
          />
          <StatCard
            label="Recent Feedback"
            value={recentFeedback?.length ?? 0}
            icon="star-outline"
            accentColor={CORAL}
            bgColor={CORAL_BG}
          />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction
            label="My Children"
            icon="people-outline"
            color={PRIMARY}
            bg={PRIMARY_BG}
            onPress={() => router.push("/(drawer)/children" as any)}
          />
          <QuickAction
            label="Find Tutors"
            icon="search-outline"
            color={ORANGE}
            bg={ORANGE_BG}
            onPress={() => router.push("/(drawer)/tutors" as any)}
          />
          <QuickAction
            label="Bookings"
            icon="calendar-outline"
            color={TEAL}
            bg={TEAL_BG}
            onPress={() => router.push("/(drawer)/bookings" as any)}
          />
          <QuickAction
            label="Progress"
            icon="stats-chart-outline"
            color={CORAL}
            bg={CORAL_BG}
            onPress={() => router.push("/(drawer)/progress" as any)}
          />
        </View>

        {/* ── Upcoming Sessions (real DB) ── */}
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
              <View
                key={s.id}
                style={[
                  styles.sessionRow,
                  i < upcomingSessions.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={[styles.sessionDot, { backgroundColor: PRIMARY }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>
                    {s.booking?.student?.name || "Student"}
                  </Text>
                  <Text style={styles.sessionSub}>
                    {s.booking?.subject} · {s.booking?.tutor?.full_name || "Tutor"}
                  </Text>
                  <Text style={styles.sessionSub}>
                    {s.scheduled_date} {s.scheduled_time ? `· ${s.scheduled_time.slice(0, 5)}` : ""}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: PRIMARY_BG }]}>
                  <Text style={[styles.badgeText, { color: PRIMARY }]}>SCHEDULED</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Recent Feedback (real DB) ── */}
        <Text style={styles.sectionTitle}>Recent Feedback</Text>
        <View style={styles.card}>
          {!recentFeedback || recentFeedback.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyTitle}>No feedback yet</Text>
              <Text style={styles.emptyText}>
                Feedback from completed sessions will appear here.
              </Text>
            </View>
          ) : (
            recentFeedback.map((f: any, i: number) => {
              const perf = performanceColor(f.performance_indicator);
              return (
                <View
                  key={f.id}
                  style={[
                    styles.feedbackRow,
                    i < recentFeedback.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.feedbackTop}>
                      <Text style={styles.sessionName}>
                        {f.booking?.student?.name || "Student"}
                      </Text>
                      {f.performance_indicator && (
                        <View style={[styles.badge, { backgroundColor: perf.bg }]}>
                          <Text style={[styles.badgeText, { color: perf.text }]}>
                            {f.performance_indicator.replace("_", " ").toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sessionSub}>
                      {f.booking?.subject} · {f.booking?.tutor?.full_name || "Tutor"}
                    </Text>
                    {f.topic_covered && (
                      <Text style={styles.topic}>📝 Topic: {f.topic_covered}</Text>
                    )}
                    {f.tutor_comments && (
                      <Text style={styles.comment}>💬 {f.tutor_comments}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  content:     { padding: 16, paddingBottom: 40 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  retryBtn:    { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },

  greeting:    { fontSize: 22, fontWeight: "800", color: DARK, marginTop: 4 },
  subtitle:    { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 20 },

  // Stats
  statsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:    {
    width: "47.5%", backgroundColor: CARD_BG, borderRadius: 12,
    padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: BORDER,
  },
  statIcon:    { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:   { fontSize: 10, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue:   { fontSize: 26, fontWeight: "800" },

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 12 },

  // Quick Actions
  quickGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  quickBtn:    { width: "47%", backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, alignItems: "center" },
  quickIcon:   { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  quickLabel:  { fontSize: 13, fontWeight: "700", color: DARK },

  // Card
  card:        { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 20, overflow: "hidden" },

  // Empty state
  emptyBox:    { alignItems: "center", paddingVertical: 28 },
  emptyIcon:   { fontSize: 36, marginBottom: 8 },
  emptyTitle:  { fontSize: 14, fontWeight: "700", color: DARK },
  emptyText:   { fontSize: 12, color: MUTED, marginTop: 4, textAlign: "center" },

  // Session rows
  sessionRow:  { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: BORDER },
  sessionDot:  { width: 8, height: 8, borderRadius: 4 },
  sessionName: { fontSize: 13, fontWeight: "700", color: DARK },
  sessionSub:  { fontSize: 11, color: MUTED, marginTop: 2 },

  // Feedback
  feedbackRow: { padding: 14 },
  feedbackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  topic:       { fontSize: 11, color: MUTED, marginTop: 6 },
  comment:     { fontSize: 11, color: MUTED, marginTop: 4, fontStyle: "italic" },

  // Badge
  badge:       { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:   { fontSize: 9, fontWeight: "700" },
});
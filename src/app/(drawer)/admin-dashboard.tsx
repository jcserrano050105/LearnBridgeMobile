import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
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
const GREEN_BG   = "#D1FAE5";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

function StatCard({ label, value, icon, color, bg }: any) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth() as any;
  const router      = useRouter();

  const [stats,        setStats]        = useState({ total_users: 0, approved_tutors: 0, pending_tutors: 0, completed_sessions: 0 });
  const [pendingTutors,setPendingTutors]= useState<any[]>([]);
  const [recentSessions,setRecentSessions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { count: totalUsers },
        { count: approvedTutors },
        { count: pendingTutors },
        { count: completedSessions },
        { data: pendingList },
        { data: sessions },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tutors").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("tutors").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("tutors")
          .select("id, status, rate_per_session, created_at, profile:id ( full_name, email )")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("sessions")
          .select("id, status, topic_covered, scheduled_date, booking:booking_id ( subject, tutor:tutor_id ( full_name ), student:student_id ( name ) )")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        total_users:        totalUsers        || 0,
        approved_tutors:    approvedTutors    || 0,
        pending_tutors:     pendingTutors     || 0,
        completed_sessions: completedSessions || 0,
      });
      setPendingTutors(pendingList || []);
      setRecentSessions(sessions  || []);
    } catch (e: any) {
      console.error("Admin dashboard error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Admin" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Admin" />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={PRIMARY} />}
      >
        <Text style={s.heading}>Admin Dashboard</Text>
        <Text style={s.sub}>Welcome back, {profile?.full_name || "Administrator"}. Platform overview.</Text>

        {/* ── Stats ── */}
        <View style={s.statsGrid}>
          <StatCard label="Total Users"           value={stats.total_users}        icon="people-outline"   color={PRIMARY} bg={PRIMARY_BG} />
          <StatCard label="Approved Tutors"        value={stats.approved_tutors}    icon="ribbon-outline"   color={TEAL}    bg={TEAL_BG}    />
          <StatCard label="Pending Verifications"  value={stats.pending_tutors}     icon="shield-outline"   color={ORANGE}  bg={ORANGE_BG}  />
          <StatCard label="Completed Sessions"     value={stats.completed_sessions} icon="calendar-outline" color={GREEN}   bg={GREEN_BG}   />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} onPress={() => router.push("/(drawer)/verification" as any)}>
            <View style={[s.quickIcon, { backgroundColor: ORANGE_BG }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={ORANGE} />
            </View>
            <Text style={s.quickLabel}>Verification</Text>
            {stats.pending_tutors > 0 && (
              <View style={s.quickBadge}>
                <Text style={s.quickBadgeTxt}>{stats.pending_tutors}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.quickBtn} onPress={() => router.push("/(drawer)/sessions" as any)}>
            <View style={[s.quickIcon, { backgroundColor: PRIMARY_BG }]}>
              <Ionicons name="calendar-outline" size={22} color={PRIMARY} />
            </View>
            <Text style={s.quickLabel}>All Sessions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.quickBtn} onPress={() => router.push("/(drawer)/messages" as any)}>
            <View style={[s.quickIcon, { backgroundColor: TEAL_BG }]}>
              <Ionicons name="chatbubble-outline" size={22} color={TEAL} />
            </View>
            <Text style={s.quickLabel}>Messages</Text>
          </TouchableOpacity>
        </View>

        {/* ── Pending Verifications ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Pending Verifications</Text>
          <TouchableOpacity onPress={() => router.push("/(drawer)/verification" as any)}>
            <Text style={s.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={s.card}>
          {pendingTutors.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>✅</Text>
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptyTxt}>No pending tutor applications.</Text>
            </View>
          ) : (
            pendingTutors.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[s.listRow, i < pendingTutors.length - 1 && s.rowBorder]}
                onPress={() => router.push("/(drawer)/verification" as any)}
              >
                <View style={s.avatarCircle}>
                  <Text style={s.avatarTxt}>{(t.profile?.full_name || "T").charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{t.profile?.full_name || "Tutor"}</Text>
                  <Text style={s.rowSub}>{t.profile?.email || "—"}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: ORANGE_BG }]}>
                  <Text style={[s.badgeTxt, { color: ORANGE }]}>Pending</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Recent Sessions ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent Sessions</Text>
          <TouchableOpacity onPress={() => router.push("/(drawer)/sessions" as any)}>
            <Text style={s.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={s.card}>
          {recentSessions.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyTitle}>No sessions yet</Text>
            </View>
          ) : (
            recentSessions.map((sess, i) => {
              const isCompleted = sess.status === "completed";
              return (
                <View key={sess.id} style={[s.listRow, i < recentSessions.length - 1 && s.rowBorder]}>
                  <View style={[s.avatarCircle, { backgroundColor: isCompleted ? GREEN_BG : PRIMARY_BG }]}>
                    <Ionicons name="book-outline" size={16} color={isCompleted ? GREEN : PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{sess.booking?.student?.name || "Student"}</Text>
                    <Text style={s.rowSub}>
                      {sess.booking?.subject} · {sess.booking?.tutor?.full_name || "Tutor"}
                    </Text>
                    {sess.scheduled_date && <Text style={s.rowDate}>{fmtDate(sess.scheduled_date)}</Text>}
                  </View>
                  <View style={[s.badge, { backgroundColor: isCompleted ? GREEN_BG : PRIMARY_BG }]}>
                    <Text style={[s.badgeTxt, { color: isCompleted ? GREEN : PRIMARY }]}>
                      {isCompleted ? "Done" : "Active"}
                    </Text>
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

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  content:     { padding: 16, paddingBottom: 80 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  heading:     { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:         { fontSize: 13, color: MUTED, marginBottom: 20 },
  statsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:    { width: "47.5%", backgroundColor: CARD, borderRadius: 12, padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: BORDER },
  statIcon:    { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:   { fontSize: 10, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue:   { fontSize: 26, fontWeight: "800" },
  sectionHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:{ fontSize: 16, fontWeight: "700", color: DARK },
  seeAll:      { fontSize: 13, color: PRIMARY, fontWeight: "600" },
  quickRow:    { flexDirection: "row", gap: 12, marginBottom: 24 },
  quickBtn:    { flex: 1, backgroundColor: CARD, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: BORDER, position: "relative" },
  quickIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLabel:  { fontSize: 12, fontWeight: "600", color: DARK, textAlign: "center" },
  quickBadge:  { position: "absolute", top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: CORAL, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  quickBadgeTxt:{ fontSize: 10, color: "#fff", fontWeight: "800" },
  card:        { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 20, overflow: "hidden" },
  emptyBox:    { alignItems: "center", padding: 28 },
  emptyIcon:   { fontSize: 28, marginBottom: 8 },
  emptyTitle:  { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 4 },
  emptyTxt:    { fontSize: 12, color: MUTED },
  listRow:     { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: BORDER },
  avatarCircle:{ width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY_BG, justifyContent: "center", alignItems: "center" },
  avatarTxt:   { fontSize: 16, fontWeight: "700", color: PRIMARY },
  rowName:     { fontSize: 14, fontWeight: "700", color: DARK },
  rowSub:      { fontSize: 12, color: MUTED, marginTop: 1 },
  rowDate:     { fontSize: 11, color: MUTED, marginTop: 1 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:    { fontSize: 11, fontWeight: "700" },
});
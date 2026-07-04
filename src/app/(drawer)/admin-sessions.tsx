import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
const PURPLE     = "#7C3AED";
const PURPLE_BG  = "#EDE9FE";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:             { label: "Scheduled",       color: PRIMARY, bg: PRIMARY_BG },
  completed:             { label: "Completed",        color: GREEN,   bg: GREEN_BG   },
  missed:                { label: "Missed",           color: CORAL,   bg: CORAL_BG   },
  pending_parent_confirm:{ label: "Awaiting Parent",  color: PURPLE,  bg: PURPLE_BG  },
  pending_tutor_complete:{ label: "Awaiting Tutor",   color: ORANGE,  bg: ORANGE_BG  },
};

const PERF_CFG: Record<string, { label: string; color: string; bg: string }> = {
  good:             { label: "Good",             color: GREEN,  bg: GREEN_BG  },
  improving:        { label: "Improving",        color: ORANGE, bg: ORANGE_BG },
  needs_improvement:{ label: "Needs Improvement", color: CORAL,  bg: CORAL_BG  },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

export default function AdminSessionsScreen() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");

  // Stats
  const [totalCount,     setTotalCount]     = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, session_number, scheduled_date, scheduled_time,
          status, topic_covered, performance_indicator, tutor_comments, created_at,
          booking:booking_id (
            id, subject, session_mode,
            tutor:tutor_id    ( id, full_name ),
            parent:parent_id  ( id, full_name ),
            student:student_id( id, name, grade_level )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const all = data || [];
      setSessions(all);
      setTotalCount(all.length);
      setCompletedCount(all.filter(s => s.status === "completed").length);
      setScheduledCount(all.filter(s => s.status === "scheduled").length);
    } catch (e: any) {
      console.error("Admin sessions error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Filter + search
  const filtered = sessions.filter(s => {
    const matchFilter = filter === "all" || s.status === filter;
    const q           = search.toLowerCase();
    const matchSearch = !q ||
      s.booking?.student?.name?.toLowerCase().includes(q)   ||
      s.booking?.tutor?.full_name?.toLowerCase().includes(q)||
      s.booking?.parent?.full_name?.toLowerCase().includes(q)||
      s.booking?.subject?.toLowerCase().includes(q)         ||
      s.topic_covered?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="All Sessions" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="All Sessions" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSessions} tintColor={PRIMARY} />}
      >
        <Text style={s.heading}>All Sessions</Text>
        <Text style={s.sub}>Platform-wide session monitoring.</Text>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: PRIMARY }]}>{totalCount}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: GREEN }]}>{completedCount}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: ORANGE }]}>{scheduledCount}</Text>
            <Text style={s.statLabel}>Scheduled</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={MUTED} style={{ position: "absolute", left: 12, zIndex: 1 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by parent, child, tutor, subject..."
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity style={s.clearBtn} onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={s.filterRow}>
            {[
              { key: "all",                  label: "All"             },
              { key: "completed",            label: "Completed"       },
              { key: "scheduled",            label: "Scheduled"       },
              { key: "pending_parent_confirm",label: "Awaiting Parent"},
              { key: "missed",               label: "Missed"          },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.filterTxt, filter === f.key && s.filterTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Results count ── */}
        <Text style={s.resultCount}>{filtered.length} session{filtered.length !== 1 ? "s" : ""} found</Text>

        {/* ── Session list ── */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
            <Text style={s.emptyTitle}>No sessions found</Text>
            <Text style={s.emptyTxt}>Try adjusting your search or filter.</Text>
          </View>
        ) : (
          filtered.map(sess => {
            const sc   = STATUS_CFG[sess.status] || { label: cap(sess.status), color: MUTED, bg: "#F3F4F6" };
            const perf = sess.performance_indicator ? PERF_CFG[sess.performance_indicator] : null;

            return (
              <View key={sess.id} style={s.card}>

                {/* Card header */}
                <View style={s.cardTop}>
                  <View style={s.cardIcon}>
                    <Ionicons name="book-outline" size={18} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>
                      {sess.booking?.student?.name || "Student"}
                      {sess.booking?.student?.grade_level
                        ? ` · Grade ${sess.booking.student.grade_level}` : ""}
                    </Text>
                    <Text style={s.cardSub}>
                      {sess.booking?.subject
                        ? sess.booking.subject === "both" ? "English & Mathematics"
                          : cap(sess.booking.subject)
                        : "—"}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusTxt, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* People row */}
                <View style={s.peopleRow}>
                  <View style={s.personChip}>
                    <Ionicons name="person-outline" size={11} color={MUTED} />
                    <Text style={s.personTxt}>
                      Tutor: {sess.booking?.tutor?.full_name || "—"}
                    </Text>
                  </View>
                  <View style={s.personChip}>
                    <Ionicons name="people-outline" size={11} color={MUTED} />
                    <Text style={s.personTxt}>
                      Parent: {sess.booking?.parent?.full_name || "—"}
                    </Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={s.infoRow}>
                  {sess.session_number && (
                    <View style={s.infoChip}>
                      <Text style={s.infoChipTxt}>Session #{sess.session_number}</Text>
                    </View>
                  )}
                  {sess.scheduled_date && (
                    <View style={s.infoChip}>
                      <Ionicons name="calendar-outline" size={11} color={MUTED} />
                      <Text style={s.infoChipTxt}>{fmtDate(sess.scheduled_date)}</Text>
                    </View>
                  )}
                  {sess.booking?.session_mode && (
                    <View style={s.infoChip}>
                      <Text style={s.infoChipTxt}>
                        {sess.booking.session_mode === "face-to-face" ? "Face-to-Face" : "Online"}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Topic + Performance */}
                {(sess.topic_covered || perf) && (
                  <View style={s.feedbackBox}>
                    {sess.topic_covered && (
                      <View style={s.feedbackRow}>
                        <Text style={s.feedbackLabel}>Topic:</Text>
                        <Text style={s.feedbackVal}>{sess.topic_covered}</Text>
                      </View>
                    )}
                    {perf && (
                      <View style={s.feedbackRow}>
                        <Text style={s.feedbackLabel}>Performance:</Text>
                        <View style={[s.perfBadge, { backgroundColor: perf.bg }]}>
                          <Text style={[s.perfBadgeTxt, { color: perf.color }]}>{perf.label}</Text>
                        </View>
                      </View>
                    )}
                    {sess.tutor_comments && (
                      <View style={[s.feedbackRow, { alignItems: "flex-start" }]}>
                        <Text style={s.feedbackLabel}>Comment:</Text>
                        <Text style={[s.feedbackVal, { flex: 1 }]}>{sess.tutor_comments}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  content:     { padding: 16, paddingBottom: 80 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  heading:     { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:         { fontSize: 13, color: MUTED, marginBottom: 16 },

  // Stats
  statsRow:    { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard:    { flex: 1, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: "center" },
  statVal:     { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  statLabel:   { fontSize: 11, color: MUTED, fontWeight: "600" },

  // Search
  searchRow:   { flexDirection: "row", alignItems: "center", marginBottom: 12, position: "relative" },
  searchInput: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 38, paddingVertical: 11, fontSize: 13, color: DARK },
  clearBtn:    { position: "absolute", right: 12 },

  // Filter
  filterRow:   { flexDirection: "row", gap: 8, paddingRight: 8 },
  filterBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: CARD },
  filterBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  filterTxt:   { fontSize: 12, color: MUTED, fontWeight: "600" },
  filterTxtActive: { color: PRIMARY },

  resultCount: { fontSize: 12, color: MUTED, marginBottom: 12, fontWeight: "600" },

  // Empty
  empty:       { alignItems: "center", paddingVertical: 60 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 6 },
  emptyTxt:    { fontSize: 13, color: MUTED },

  // Card
  card:        { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 12, padding: 14 },
  cardTop:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardIcon:    { width: 38, height: 38, borderRadius: 10, backgroundColor: PRIMARY_BG, justifyContent: "center", alignItems: "center" },
  cardTitle:   { fontSize: 14, fontWeight: "700", color: DARK },
  cardSub:     { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:   { fontSize: 11, fontWeight: "700" },

  peopleRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  personChip:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  personTxt:   { fontSize: 11, color: MUTED },

  infoRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  infoChip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F9FAFB", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: BORDER },
  infoChipTxt: { fontSize: 11, color: MUTED },

  feedbackBox: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, gap: 6 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackLabel:{ fontSize: 11, fontWeight: "700", color: MUTED, width: 76 },
  feedbackVal: { fontSize: 12, color: DARK },
  perfBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  perfBadgeTxt:{ fontSize: 11, fontWeight: "700" },
});
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";
import SessionModules from "../../components/SessionModules";
import StudentProgress from "../../components/StudentProgress";
import ZoomMeeting from "../../components/ZoomMeeting";
import SessionAnnouncements from "../../components/SessionAnnouncements";

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
const TOTAL_SESSIONS = 8;

const PERF = [
  { v: "good",             l: "Good",             color: GREEN,  bg: GREEN_BG  },
  { v: "improving",        l: "Improving",         color: ORANGE, bg: ORANGE_BG },
  { v: "needs_improvement",l: "Needs Improvement", color: CORAL,  bg: CORAL_BG  },
];

// Website tabs: Sessions & Quizzes · Student Progress · Video Meeting (+ announcements); app keeps Session Logs
type TabKey = "modules" | "progress" | "video" | "announcements" | "logs";
const TABS: [TabKey, string][] = [
  ["modules",       "📚 Modules"],
  ["progress",      "📊 Progress"],
  ["video",         "🎥 Video"],
  ["announcements", "📢 Announcements"],
  ["logs",          "📝 Logs"],
];

function subjectLabel(s: string) {
  return s === "both" ? "English & Math" : s === "english" ? "English" : s === "mathematics" ? "Mathematics" : s;
}

export default function TutorSessionsScreen() {
  const { user } = useAuth() as any;

  const [bookings,     setBookings]     = useState<any[]>([]);
  const [sessionMaps,  setSessionMaps]  = useState<Record<string, Record<number, any>>>({});
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [forms,        setForms]        = useState<Record<string, Record<number, any>>>({});
  const [saving,       setSaving]       = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [tabs,         setTabs]         = useState<Record<string, TabKey>>({});

  // ── Fetch all confirmed bookings + their sessions ───────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: bks, error: bErr } = await supabase
        .from("bookings")
        .select(`id, subject, status, created_at,
          parent:parent_id  ( id, full_name ),
          student:student_id ( id, name, grade_level )`)
        .eq("tutor_id", user.id)
        .in("status", ["confirmed", "pending_parent_confirm", "completed"])
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;

      const bIds = (bks || []).map((b: any) => b.id);
      const maps: Record<string, Record<number, any>> = {};

      if (bIds.length > 0) {
        const { data: sess } = await supabase
          .from("sessions")
          .select("*")
          .in("booking_id", bIds);

        (sess || []).forEach((s: any) => {
          if (!maps[s.booking_id]) maps[s.booking_id] = {};
          maps[s.booking_id][s.session_number] = s;
        });
      }

      setBookings(bks || []);
      setSessionMaps(maps);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Get or init form ────────────────────────────────────────
  const getForm = (bookingId: string, num: number) => {
    const existing = sessionMaps[bookingId]?.[num];
    if (forms[bookingId]?.[num]) return forms[bookingId][num];
    return {
      topic:     existing?.topic_covered         || "",
      indicator: existing?.performance_indicator || "good",
      comments:  existing?.tutor_comments        || "",
    };
  };

  const setField = (bookingId: string, num: number, key: string, val: string) => {
    setForms(prev => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {}),
        [num]: { ...getForm(bookingId, num), [key]: val },
      },
    }));
  };

  // ── Save session feedback ───────────────────────────────────
  const handleSave = async (bookingId: string, num: number) => {
    const form = getForm(bookingId, num);
    if (!form.topic.trim()) { Alert.alert("Missing", "Please enter the topic covered."); return; }

    setSaving(`${bookingId}-${num}`);
    try {
      const existing = sessionMaps[bookingId]?.[num];
      if (existing) {
        await supabase.from("sessions").update({
          topic_covered:         form.topic,
          performance_indicator: form.indicator,
          tutor_comments:        form.comments,
        }).eq("id", existing.id);
      } else {
        await supabase.from("sessions").insert({
          booking_id:            bookingId,
          session_number:        num,
          scheduled_date:        new Date().toISOString().split("T")[0],
          status:                "completed",
          topic_covered:         form.topic,
          performance_indicator: form.indicator,
          tutor_comments:        form.comments,
        });
      }
      await fetchData();
      // Clear local form
      setForms(prev => {
        const n = { ...prev };
        if (n[bookingId]) delete n[bookingId][num];
        return n;
      });
    } catch (e: any) {
      Alert.alert("Error", "Failed to save: " + e.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Sessions" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Sessions" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={PRIMARY} />}
      >
        <Text style={s.heading}>Sessions</Text>
        <Text style={s.sub}>Log feedback for each of your 8 sessions per booking.</Text>

        {error && (
          <View style={s.errorBanner}>
            <Text style={s.errorTxt}>{error}</Text>
            <TouchableOpacity onPress={fetchData}><Text style={{ color: PRIMARY, fontWeight: "700" }}>Retry</Text></TouchableOpacity>
          </View>
        )}

        {bookings.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="book-outline" size={56} color="#D1D5DB" />
            <Text style={s.eTitle}>No active bookings</Text>
            <Text style={s.eTxt}>Session logs will appear once you have confirmed bookings.</Text>
          </View>
        ) : (
          bookings.map(b => {
            const isExpanded     = expandedId === b.id;
            const sessionMap     = sessionMaps[b.id] || {};
            const completedCount = Object.keys(sessionMap).length;

            return (
              <View key={b.id} style={s.card}>
                {/* Booking header */}
                <TouchableOpacity
                  style={s.bookingHeader}
                  onPress={() => setExpandedId(isExpanded ? null : b.id)}
                  activeOpacity={0.8}
                >
                  <View style={s.bookingAvatar}>
                    <Text style={s.bookingAvatarTxt}>{(b.student?.name || "?").charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bookingName}>{b.student?.name}</Text>
                    <Text style={s.bookingSub}>{b.parent?.full_name} · {subjectLabel(b.subject)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={s.progressPill}>
                      <Text style={s.progressTxt}>{completedCount}/{TOTAL_SESSIONS}</Text>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={MUTED} />
                  </View>
                </TouchableOpacity>

                {/* Progress bar */}
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${(completedCount / TOTAL_SESSIONS) * 100}%` as any }]} />
                </View>

                {/* Tabs: Modules (website parity) | Session Logs */}
                {isExpanded && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
                    {TABS.map(([key, label]) => {
                      const on = (tabs[b.id] || "modules") === key;
                      return (
                        <TouchableOpacity key={key} style={[s.tabBtn, on && s.tabBtnOn]} onPress={() => setTabs(t => ({ ...t, [b.id]: key }))}>
                          <Text style={[s.tabTxt, on && s.tabTxtOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {isExpanded && (tabs[b.id] || "modules") === "modules" && (
                  <View style={{ padding: 14 }}>
                    <SessionModules bookingId={b.id} mode="tutor" tutorId={user?.id} />
                  </View>
                )}
                {isExpanded && tabs[b.id] === "progress" && (
                  <View style={{ padding: 14 }}><StudentProgress bookingId={b.id} /></View>
                )}
                {isExpanded && tabs[b.id] === "video" && (
                  <View style={{ padding: 14 }}><ZoomMeeting booking={b} isTutor /></View>
                )}
                {isExpanded && tabs[b.id] === "announcements" && (
                  <View style={{ padding: 14 }}><SessionAnnouncements bookingId={b.id} mode="tutor" tutorId={user?.id} /></View>
                )}

                {/* Sessions list */}
                {isExpanded && tabs[b.id] === "logs" && (
                  <View style={s.sessionsList}>
                    {Array.from({ length: TOTAL_SESSIONS }, (_, i) => i + 1).map(num => {
                      const existing  = sessionMap[num];
                      const form      = getForm(b.id, num);
                      const isDone    = !!existing;
                      const isSaving  = saving === `${b.id}-${num}`;
                      const perfCfg   = PERF.find(p => p.v === (existing?.performance_indicator || form.indicator)) || PERF[0];

                      return (
                        <View key={num} style={s.sessionItem}>
                          {/* Session number + indicator */}
                          <View style={s.sessionNumRow}>
                            <View style={[s.sessionNumBadge, { backgroundColor: isDone ? PRIMARY_BG : "#F3F4F6" }]}>
                              <Text style={[s.sessionNumTxt, { color: isDone ? PRIMARY : MUTED }]}>
                                Session {num}
                              </Text>
                            </View>
                            {isDone && (
                              <View style={[s.perfBadge, { backgroundColor: perfCfg.bg }]}>
                                <Text style={[s.perfTxt, { color: perfCfg.color }]}>{perfCfg.l}</Text>
                              </View>
                            )}
                          </View>

                          {/* Topic */}
                          <Text style={s.fieldLabel}>Topic Covered *</Text>
                          <TextInput
                            style={s.input}
                            value={form.topic}
                            onChangeText={v => setField(b.id, num, "topic", v)}
                            placeholder="e.g. Fractions and Decimals"
                            placeholderTextColor={MUTED}
                          />

                          {/* Performance indicator */}
                          <Text style={s.fieldLabel}>Performance</Text>
                          <View style={s.perfRow}>
                            {PERF.map(p => (
                              <TouchableOpacity
                                key={p.v}
                                style={[s.perfBtn, form.indicator === p.v && { backgroundColor: p.bg, borderColor: p.color }]}
                                onPress={() => setField(b.id, num, "indicator", p.v)}
                              >
                                <Text style={[s.perfBtnTxt, form.indicator === p.v && { color: p.color, fontWeight: "700" }]}>
                                  {p.l}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {/* Comments */}
                          <Text style={s.fieldLabel}>Comments (optional)</Text>
                          <TextInput
                            style={[s.input, s.textArea]}
                            value={form.comments}
                            onChangeText={v => setField(b.id, num, "comments", v)}
                            placeholder="Notes visible to parent..."
                            placeholderTextColor={MUTED}
                            multiline
                          />

                          {/* Save button */}
                          <TouchableOpacity
                            style={[s.saveBtn, isSaving && { opacity: 0.6 }]}
                            onPress={() => handleSave(b.id, num)}
                            disabled={isSaving}
                          >
                            {isSaving
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <><Ionicons name="checkmark" size={14} color="#fff" /><Text style={s.saveBtnTxt}>{isDone ? "Update Session" : "Save Session"}</Text></>
                            }
                          </TouchableOpacity>
                        </View>
                      );
                    })}
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
  container:  { flex: 1, backgroundColor: "transparent" },
  content:    { padding: 16, paddingBottom: 80 },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center" },
  heading:    { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:        { fontSize: 13, color: MUTED, marginBottom: 20 },
  empty:      { alignItems: "center", paddingVertical: 60, gap: 12 },
  eTitle:     { fontSize: 16, fontWeight: "700", color: DARK },
  eTxt:       { fontSize: 13, color: MUTED, textAlign: "center" },
  errorBanner:{ flexDirection: "row", justifyContent: "space-between", backgroundColor: CORAL_BG, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorTxt:   { color: CORAL, fontSize: 13, flex: 1 },

  card:           { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 14, overflow: "hidden" },
  bookingHeader:  { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  bookingAvatar:  { width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  bookingAvatarTxt:{ color: "#fff", fontWeight: "800", fontSize: 18 },
  bookingName:    { fontSize: 15, fontWeight: "700", color: DARK },
  bookingSub:     { fontSize: 12, color: MUTED, marginTop: 2 },
  progressPill:   { backgroundColor: PRIMARY_BG, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  progressTxt:    { fontSize: 11, fontWeight: "700", color: PRIMARY },
  progressBar:    { height: 4, backgroundColor: "#E5E7EB", marginHorizontal: 14 },
  progressFill:   { height: 4, backgroundColor: PRIMARY, borderRadius: 2 },

  tabRow:         { flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingTop: 12 },
  tabBtn:         { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", backgroundColor: "#F3F4F6" },
  tabBtnOn:       { backgroundColor: PRIMARY_BG },
  tabTxt:         { fontSize: 12, color: MUTED, fontWeight: "600" },
  tabTxtOn:       { color: PRIMARY, fontWeight: "700" },

  sessionsList:   { padding: 14, gap: 4 },
  sessionItem:    { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 12 },
  sessionNumRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sessionNumBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sessionNumTxt:  { fontSize: 12, fontWeight: "700" },
  perfBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  perfTxt:        { fontSize: 10, fontWeight: "700" },

  fieldLabel:   { fontSize: 12, fontWeight: "600", color: DARK, marginBottom: 6 },
  input:        { borderWidth: 1.5, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: DARK, backgroundColor: CARD, marginBottom: 12 },
  textArea:     { height: 72, textAlignVertical: "top" },

  perfRow:      { flexDirection: "row", gap: 6, marginBottom: 12 },
  perfBtn:      { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB", alignItems: "center" },
  perfBtnTxt:   { fontSize: 11, color: MUTED, fontWeight: "500" },

  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: PRIMARY, paddingVertical: 12, borderRadius: 10 },
  saveBtnTxt:   { color: "#fff", fontSize: 13, fontWeight: "700" },
});
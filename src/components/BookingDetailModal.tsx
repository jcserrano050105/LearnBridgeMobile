import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

// Booking details — mirrors the website:
//  • parent: BookingsPage "📋 Booking Details" (tutor header + 8 fields)
//  • tutor:  TutorBookingsPage modal with "📋 Booking Details" / "👤 Tutee Profile" tabs

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const MID        = "#374151";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

type Props = {
  booking: any | null;
  isTutor: boolean;
  statusLabel: (status: string) => string;
  onClose: () => void;
};

export default function BookingDetailModal({ booking, isTutor, statusLabel, onClose }: Props) {
  const [tab,     setTab]     = useState<"booking" | "tutee">("booking");
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setTab("booking");
    setStudent(null);
    if (isTutor && booking.student_id) {
      setLoading(true);
      supabase.from("students").select("*").eq("id", booking.student_id).single()
        .then(({ data }) => { setStudent(data || null); setLoading(false); });
    }
  }, [booking?.id]);

  if (!booking) return null;

  const fields: [string, string][] = isTutor
    ? [
        ["Child",   booking.student?.name || "—"],
        ["Parent",  booking.parent?.full_name || "—"],
        ["Subject", booking.subject || "—"],
        ["Mode",    booking.session_mode || "—"],
        ["Payment", (booking.payment_method || "").replace("_", " ") || "—"],
        ["Total",   `₱${Number(booking.total_amount || 0).toLocaleString()}`],
      ]
    : [
        ["Child",     booking.student?.name || "—"],
        ["Tutor",     booking.tutor?.full_name || "—"],
        ["Subject",   booking.subject || "—"],
        ["Mode",      booking.session_mode || "—"],
        ["Payment",   (booking.payment_method || "").replace("_", " ") || "—"],
        ["Total",     `₱${Number(booking.total_amount || 0).toLocaleString()}`],
        ["Sessions",  "8 sessions"],
        ["Booked on", fmtDate(booking.created_at)],
      ];

  return (
    <Modal visible={!!booking} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.head}>
            <Text style={s.title}>📋 Booking Details</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
          </View>

          {isTutor && (
            <View style={s.tabs}>
              {([["booking", "📋 Booking Details"], ["tutee", "👤 Tutee Profile"]] as const).map(([k, l]) => (
                <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}>
                  <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {tab === "booking" && (
              <>
                {/* Parent view: tutor header like the website */}
                {!isTutor && (
                  <View style={s.header}>
                    <View style={s.headerAvatar}><Text style={s.headerAvatarTxt}>{(booking.tutor?.full_name || "T").charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.headerName}>{booking.tutor?.full_name || "—"}</Text>
                      <Text style={s.headerSub}>{cap(booking.subject)} · {booking.session_mode}</Text>
                    </View>
                    <View style={s.badge}><Text style={s.badgeTxt}>{statusLabel(booking.status)}</Text></View>
                  </View>
                )}

                <View style={s.grid}>
                  {fields.map(([k, v]) => (
                    <View key={k} style={s.cell}>
                      <Text style={s.key}>{k}</Text>
                      <Text style={s.val}>{v}</Text>
                    </View>
                  ))}
                </View>

                {isTutor && (
                  booking.status === "pending" ? (
                    <View style={s.note}><Text style={s.noteTxt}>⏳ Accept or reject this request from the booking card, or from <Text style={{ fontWeight: "800" }}>Calendar</Text> for each session date.</Text></View>
                  ) : !booking.scheduled_date ? (
                    <View style={s.dashed}>
                      <Text style={{ fontSize: 26, marginBottom: 6 }}>📅</Text>
                      <Text style={s.muted}>Schedule will appear here once the parent selects dates from the calendar.</Text>
                    </View>
                  ) : null
                )}
              </>
            )}

            {tab === "tutee" && (
              loading || !student ? (
                <View style={{ alignItems: "center", paddingVertical: 28 }}>
                  {loading ? <ActivityIndicator color={PRIMARY} /> : <Text style={{ fontSize: 36 }}>👤</Text>}
                  <Text style={[s.muted, { marginTop: 8 }]}>{loading ? "Loading student profile..." : "Student profile not found."}</Text>
                </View>
              ) : (
                <TuteeProfile student={student} subject={booking.subject} />
              )
            )}
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeTxt}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function TuteeProfile({ student, subject }: { student: any; subject: string }) {
  const res   = student.assessment_results;
  const inter = student.assessment_level === "intermediate";
  const color = inter ? "#2563EB" : "#059669";

  // Website shape: assessment_score + results.correct/total. App shape: { english:{score,correct,total}, mathematics:{...} }
  const appShape = res && (res.english || res.mathematics) && res.correct === undefined;
  const score    = student.assessment_score ?? (appShape
    ? Math.round((((res.english?.score ?? 0) + (res.mathematics?.score ?? 0)) / ((res.english ? 1 : 0) + (res.mathematics ? 1 : 0) || 1)))
    : res?.score);
  const correct  = appShape ? (res.english?.correct ?? 0) + (res.mathematics?.correct ?? 0) : res?.correct;
  const total    = appShape ? (res.english?.total ?? 0) + (res.mathematics?.total ?? 0) : res?.total;

  return (
    <View>
      <View style={s.header}>
        <View style={s.headerAvatar}><Text style={s.headerAvatarTxt}>{student.name?.charAt(0)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{student.name}</Text>
          <Text style={s.headerSub}>Grade {student.grade_level} · {subject}</Text>
        </View>
      </View>

      {res ? (
        <>
          <Text style={s.section}>Pre-Assessment Result</Text>
          <View style={[s.levelCard, { backgroundColor: inter ? "#DBEAFE" : "#D1FAE5", borderColor: color + "30" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 30 }}>{inter ? "🚀" : "🌱"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.levelTitle, { color }]}>
                  {student.assessment_level ? (inter ? "Intermediate Level (Grade 4–6)" : "Primary Level (Grade 1–3)") : "Pre-Assessment"}
                </Text>
                <Text style={[s.levelSub, { color }]}>
                  Score: {score ?? "—"}%{typeof res.passed === "boolean" ? ` · ${res.passed ? "✅ Passed" : "⚠️ Needs improvement"}` : ""}
                </Text>
              </View>
              <Text style={[s.levelScore, { color }]}>{score ?? "—"}%</Text>
            </View>
            <View style={s.bar}><View style={[s.barFill, { width: `${Math.min(100, Number(score) || 0)}%`, backgroundColor: color }]} /></View>
          </View>

          {/* Per-subject scores */}
          {(res.subject_scores || appShape) && (
            <View style={[s.grid, { marginBottom: 10 }]}>
              {Object.entries(res.subject_scores || { english: res.english?.score, mathematics: res.mathematics?.score })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]: any) => (
                  <View key={k} style={s.cell}>
                    <Text style={s.key}>{k}</Text>
                    <Text style={s.val}>{v}%</Text>
                  </View>
                ))}
            </View>
          )}

          {typeof correct === "number" && typeof total === "number" && total > 0 && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <View style={[s.stat, { backgroundColor: "#D1FAE5" }]}><Text style={[s.statNum, { color: "#065F46" }]}>{correct}</Text><Text style={[s.statLbl, { color: "#065F46" }]}>Correct</Text></View>
              <View style={[s.stat, { backgroundColor: "#FEE2E2" }]}><Text style={[s.statNum, { color: "#DC2626" }]}>{total - correct}</Text><Text style={[s.statLbl, { color: "#DC2626" }]}>Incorrect</Text></View>
            </View>
          )}
        </>
      ) : (
        <View style={s.noAssess}>
          <Text style={{ fontSize: 30, marginBottom: 6 }}>📋</Text>
          <Text style={s.noAssessTitle}>No Pre-Assessment Yet</Text>
          <Text style={s.noAssessTxt}>The parent hasn't completed a pre-assessment for this student yet.</Text>
        </View>
      )}

      {!!student.notes && (
        <>
          <Text style={s.section}>Notes from Parent</Text>
          <View style={s.notes}><Text style={s.notesTxt}>"{student.notes}"</Text></View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  box:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "88%" },
  head:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title:   { fontSize: 17, fontWeight: "800", color: DARK },

  tabs:     { flexDirection: "row", gap: 6, marginBottom: 14 },
  tab:      { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" },
  tabOn:    { backgroundColor: PRIMARY_BG },
  tabTxt:   { fontSize: 12, fontWeight: "600", color: MUTED },
  tabTxtOn: { color: PRIMARY, fontWeight: "700" },

  header:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: PRIMARY_BG, borderRadius: 12, marginBottom: 14 },
  headerAvatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  headerAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 20 },
  headerName:      { fontSize: 16, fontWeight: "800", color: DARK },
  headerSub:       { fontSize: 12, color: MID, marginTop: 2, textTransform: "capitalize" },
  badge:           { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:        { fontSize: 10, fontWeight: "800", color: PRIMARY },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  cell: { width: "48%", backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12 },
  key:  { fontSize: 10, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  val:  { fontSize: 13, fontWeight: "600", color: DARK, textTransform: "capitalize" },

  note:    { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12 },
  noteTxt: { fontSize: 13, color: "#92400E", lineHeight: 19 },
  dashed:  { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: BORDER, borderRadius: 12, padding: 18, backgroundColor: "#F9FAFB" },
  muted:   { fontSize: 12, color: MUTED, textAlign: "center" },

  section:    { fontSize: 11, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  levelCard:  { borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 10 },
  levelTitle: { fontSize: 14, fontWeight: "800" },
  levelSub:   { fontSize: 12, opacity: 0.85, marginTop: 2 },
  levelScore: { fontSize: 26, fontWeight: "900" },
  bar:        { height: 8, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 4, overflow: "hidden", marginTop: 10 },
  barFill:    { height: "100%", borderRadius: 4 },
  stat:       { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  statNum:    { fontSize: 22, fontWeight: "900" },
  statLbl:    { fontSize: 11 },
  noAssess:      { alignItems: "center", backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12, padding: 16, marginBottom: 14 },
  noAssessTitle: { fontSize: 14, fontWeight: "600", color: "#92400E" },
  noAssessTxt:   { fontSize: 12, color: "#92400E", opacity: 0.8, marginTop: 4, textAlign: "center" },
  notes:    { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 14, marginBottom: 10 },
  notesTxt: { fontSize: 13, color: MID, lineHeight: 20, fontStyle: "italic" },

  closeBtn: { marginTop: 10, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  closeTxt: { fontSize: 14, color: MUTED, fontWeight: "600" },
});

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import {
  MONTHS, DAYS_SHORT, HOURS, REQUIRED_SESSIONS,
  getDaysInMonth, getFirstDayOfMonth, toDateStr, todayStr,
  fmtHour, fmtDate, hourToTimeStr, prevMonth, nextMonth,
} from "../lib/calendar";

// Mirrors the booking modal in the website's FindTutorsPage.jsx:
// step 1 details → step 2 pick 8 dates (each with its own hour) → step 3 confirm.
// Creates the booking + 8 booking_slots (tutor calendar) + 8 booking_schedules (parent schedule).

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const MID        = "#374151";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";

type Step = "details" | "calendar" | "confirm";
type Picked = { date: string; time: number; timeStr: string };

type Props = {
  tutor: any | null;            // tutors row with profile:{full_name}
  students: any[];
  parentId: string;
  onClose: () => void;
  onBooked: (msg: string) => void;
};

const SUBJECTS = [
  { v: "english",     l: "English"               },
  { v: "mathematics", l: "Mathematics"           },
  { v: "both",        l: "Both (English & Math)" },
];

export default function BookTutorModal({ tutor, students, parentId, onClose, onBooked }: Props) {
  const now = new Date();
  const [step,  setStep]  = useState<Step>("details");
  const [form,  setForm]  = useState({ student_id: "", session_mode: "face-to-face", subject: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [slots,    setSlots]    = useState<any[]>([]);
  const [selected, setSelected] = useState<Picked[]>([]);
  const [picking,  setPicking]  = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const rate  = Number(tutor?.approved_rate || tutor?.rate_per_session || 0);
  const today = todayStr();

  // Reset each time a new tutor is opened
  useEffect(() => {
    if (!tutor) return;
    setStep("details");
    setForm({ student_id: "", session_mode: "face-to-face", subject: "" });
    setSelected([]); setPicking(null); setError("");
    setCalYear(now.getFullYear()); setCalMonth(now.getMonth());
  }, [tutor?.id]);

  // Tutor's existing slots — colour the calendar and block taken hours
  const fetchSlots = useCallback(async (tutorId: string) => {
    const { data } = await supabase
      .from("booking_slots")
      .select("slot_date,slot_time,status")
      .eq("tutor_id", tutorId);
    setSlots(data || []);
  }, []);

  useEffect(() => {
    if (tutor && step === "calendar") fetchSlots(tutor.id);
  }, [tutor, step, fetchSlots]);

  const getDateStatus = (dateStr: string) => {
    const day = slots.filter(s => s.slot_date === dateStr);
    if (day.some(s => s.status === "confirmed")) return "occupied";
    if (day.some(s => s.status === "pending"))   return "pending";
    return "available";
  };

  const isTimeOccupied = (dateStr: string, hour: number) =>
    slots.some(s => s.slot_date === dateStr && s.slot_time === hourToTimeStr(hour));

  // ── Step handlers (same rules as the website) ─────────────────────
  const handleOpenCalendar = () => {
    if (!form.student_id) { setError("Please select a child first."); return; }
    if (!form.subject)    { setError("Please select a subject first."); return; }
    setError(""); setSelected([]); setPicking(null); setStep("calendar");
  };

  const handleSelectDate = (dateStr: string) => {
    if (selected.find(s => s.date === dateStr)) {
      setSelected(prev => prev.filter(s => s.date !== dateStr));
      if (picking === dateStr) setPicking(null);
      return;
    }
    if (selected.length >= REQUIRED_SESSIONS) {
      setError(`You can only select ${REQUIRED_SESSIONS} dates.`); return;
    }
    setError("");
    setPicking(dateStr);
  };

  const handleSelectTime = (dateStr: string, hour: number) => {
    const timeStr = hourToTimeStr(hour);
    setSelected(prev => {
      const existing = prev.find(s => s.date === dateStr);
      if (existing) return prev.map(s => s.date === dateStr ? { ...s, time: hour, timeStr } : s);
      return [...prev, { date: dateStr, time: hour, timeStr }];
    });
    setPicking(null);
  };

  const handleConfirmSchedule = () => {
    if (selected.length < REQUIRED_SESSIONS) { setError(`Please select all ${REQUIRED_SESSIONS} session dates.`); return; }
    setError(""); setStep("confirm");
  };

  const handleBook = async () => {
    if (!tutor || !form.student_id || selected.length < REQUIRED_SESSIONS) return;
    setSaving(true); setError("");
    try {
      const first = selected[0];
      const { data, error: bErr } = await supabase
        .from("bookings")
        .insert({
          parent_id:       parentId,
          status:          "pending",
          tutor_id:        tutor.id,
          student_id:      form.student_id,
          subject:         form.subject === "both" ? "english & mathematics" : form.subject,
          session_mode:    form.session_mode,
          total_amount:    rate * REQUIRED_SESSIONS,
          scheduled_date:  first.date,
          scheduled_time:  first.timeStr,
          schedule_status: "pending",
        })
        .select()
        .single();
      if (bErr) throw bErr;

      if (data?.id) {
        // 8 slots → tutor calendar
        const { error: slotErr } = await supabase.from("booking_slots").insert(
          selected.map(s => ({ tutor_id: tutor.id, booking_id: data.id, slot_date: s.date, slot_time: s.timeStr, status: "pending" }))
        );
        if (slotErr) console.error("Slot insert error:", slotErr.message);

        // 8 schedule rows → parent's schedule view
        const { error: schedErr } = await supabase.from("booking_schedules").insert(
          selected.map((s, i) => ({ booking_id: data.id, session_num: i + 1, session_date: s.date, session_time: s.timeStr, status: "upcoming" }))
        );
        if (schedErr) console.error("Schedule insert error:", schedErr.message);
      }

      onBooked("Booking submitted with 8 sessions! Waiting for tutor confirmation.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Calendar grid data ────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDayOfMonth(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const allPicked = selected.length === REQUIRED_SESSIONS;
  const child     = students.find(s => s.id === form.student_id);

  const title =
    step === "details"  ? `Book ${tutor?.profile?.full_name || "Tutor"}` :
    step === "calendar" ? `📅 Select 8 Session Dates (${selected.length}/${REQUIRED_SESSIONS})` :
    "✅ Confirm Booking";

  return (
    <Modal visible={!!tutor} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── STEP 1: Details ── */}
            {step === "details" && (
              <View>
                <View style={s.infoBlue}>
                  <Text style={s.infoBlueTxt}>ℹ️ Select your child, subject, and session mode. Then choose your preferred schedule.</Text>
                </View>

                <Text style={s.label}>Which child is this for?</Text>
                <View style={s.optCol}>
                  {students.map(st => {
                    const on = form.student_id === st.id;
                    return (
                      <TouchableOpacity key={st.id} style={[s.opt, on && s.optOn]} onPress={() => set("student_id", st.id)}>
                        <Text style={[s.optTxt, on && s.optTxtOn]}>{st.name} (Grade {st.grade_level})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.label}>Subject</Text>
                <View style={s.optRow}>
                  {SUBJECTS.map(o => {
                    const on = form.subject === o.v;
                    return (
                      <TouchableOpacity key={o.v} style={[s.opt, s.optFlex, on && s.optOn]} onPress={() => set("subject", o.v)}>
                        <Text style={[s.optTxt, on && s.optTxtOn, { textAlign: "center" }]}>{o.l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.label}>Session Mode</Text>
                <View style={s.optRow}>
                  {[{ v: "face-to-face", l: "Face-to-Face" }, { v: "online", l: "Online" }].map(o => {
                    const on = form.session_mode === o.v;
                    return (
                      <TouchableOpacity key={o.v} style={[s.opt, s.optFlex, on && s.optOn]} onPress={() => set("session_mode", o.v)}>
                        <Text style={[s.optTxt, on && s.optTxtOn, { textAlign: "center" }]}>{o.l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── STEP 2: Calendar ── */}
            {step === "calendar" && (
              <View>
                <View style={[s.counter, allPicked ? s.counterDone : null]}>
                  <Text style={[s.counterTxt, allPicked && { color: "#065F46" }]}>
                    {allPicked ? "✅ All 8 sessions selected!" : `📅 Select ${REQUIRED_SESSIONS} session dates`}
                  </Text>
                  <Text style={[s.counterNum, allPicked && { color: "#065F46" }]}>{selected.length}/{REQUIRED_SESSIONS}</Text>
                </View>

                <View style={s.legend}>
                  {[["#22C55E","Available"],["#EF4444","Occupied"],["#F59E0B","Pending"],["#6366F1","Selected"]].map(([c, l]) => (
                    <View key={l} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: c }]} />
                      <Text style={s.legendTxt}>{l}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.monthNav}>
                  <TouchableOpacity style={s.navBtn} onPress={() => { const [y, m] = prevMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
                    <Ionicons name="chevron-back" size={18} color={MID} />
                  </TouchableOpacity>
                  <Text style={s.monthTxt}>{MONTHS[calMonth]} {calYear}</Text>
                  <TouchableOpacity style={s.navBtn} onPress={() => { const [y, m] = nextMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
                    <Ionicons name="chevron-forward" size={18} color={MID} />
                  </TouchableOpacity>
                </View>

                <View style={s.grid}>
                  {DAYS_SHORT.map(d => <Text key={d} style={s.dayHead}>{d}</Text>)}
                  {cells.map((day, idx) => {
                    if (day === null) return <View key={`e${idx}`} style={s.cell} />;
                    const dateStr = toDateStr(calYear, calMonth, day);
                    const isPast  = dateStr < today;
                    const status  = getDateStatus(dateStr);
                    const sel     = selected.find(x => x.date === dateStr);
                    const num     = sel ? selected.indexOf(sel) + 1 : null;
                    const isPick  = picking === dateStr;

                    let bg = "#F0FDF4", border = "#22C55E", color = "#15803D";
                    if (isPast)                    { bg = "#F9FAFB"; border = BORDER;    color = MUTED; }
                    else if (sel)                  { bg = "#EEF2FF"; border = "#6366F1"; color = "#4F46E5"; }
                    else if (isPick)               { bg = "#FDF4FF"; border = "#A855F7"; color = "#7C3AED"; }
                    else if (status === "occupied"){ bg = "#FEF2F2"; border = "#EF4444"; color = "#DC2626"; }
                    else if (status === "pending") { bg = "#FFFBEB"; border = "#F59E0B"; color = "#D97706"; }

                    return (
                      <View key={dateStr} style={s.cell}>
                        <TouchableOpacity
                          disabled={isPast}
                          onPress={() => handleSelectDate(dateStr)}
                          style={[s.dayBtn, { backgroundColor: bg, borderColor: border }]}
                        >
                          <Text style={[s.dayNum, { color, fontWeight: sel ? "800" : "600" }]}>{day}</Text>
                          {num && <Text style={s.dayTag}>#{num}</Text>}
                          {sel && <Text style={s.dayTime}>{fmtHour(sel.time).replace(":00", "")}</Text>}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Time picker */}
                {picking && (
                  <View style={s.timeBox}>
                    <Text style={s.timeTitle}>🕐 Select time for {fmtDate(picking)}</Text>
                    <View style={s.timeGrid}>
                      {HOURS.map(h => {
                        const occ = isTimeOccupied(picking, h);
                        return (
                          <View key={h} style={s.timeCell}>
                            <TouchableOpacity
                              disabled={occ}
                              onPress={() => handleSelectTime(picking, h)}
                              style={[s.timeBtn, occ && s.timeBtnOcc]}
                            >
                              <Text style={[s.timeTxt, occ && { color: "#DC2626" }]}>{fmtHour(h)}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                    <TouchableOpacity onPress={() => setPicking(null)} style={{ marginTop: 10 }}>
                      <Text style={s.linkTxt}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Selected list */}
                {selected.length > 0 && (
                  <View style={s.selBox}>
                    <Text style={s.selTitle}>Selected Sessions:</Text>
                    {selected.map((x, i) => (
                      <View key={x.date} style={s.selRow}>
                        <View style={s.selNum}><Text style={s.selNumTxt}>{i + 1}</Text></View>
                        <Text style={s.selTxt}>{fmtDate(x.date)} · {fmtHour(x.time)}</Text>
                        <TouchableOpacity onPress={() => setSelected(prev => prev.filter((_, pi) => pi !== i))}>
                          <Text style={{ color: "#DC2626", fontSize: 14, paddingHorizontal: 4 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === "confirm" && (
              <View>
                <View style={s.doneBox}>
                  <Text style={s.doneTitle}>✅ 8 Sessions Selected!</Text>
                  {selected.map((x, i) => (
                    <View key={x.date} style={s.doneRow}>
                      <View style={s.doneNum}><Text style={s.doneNumTxt}>{i + 1}</Text></View>
                      <Text style={s.doneTxt}>{fmtDate(x.date, { weekday: "short", month: "long", day: "numeric" })}</Text>
                      <Text style={[s.doneTxt, { marginLeft: "auto" }]}>{fmtHour(x.time)}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.sumGrid}>
                  {([
                    ["Tutor",   tutor?.profile?.full_name || "—"],
                    ["Child",   child?.name || "—"],
                    ["Subject", form.subject === "both" ? "English & Mathematics" : form.subject || "—"],
                    ["Mode",    form.session_mode],
                    ["Total",   `₱${(rate * REQUIRED_SESSIONS).toLocaleString()}`],
                  ] as [string, string][]).map(([k, v]) => (
                    <View key={k} style={s.sumCell}>
                      <Text style={s.sumKey}>{k}</Text>
                      <Text style={s.sumVal}>{v}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.infoYellow}>
                  <Text style={s.infoYellowTxt}>
                    ⏳ Your selected date will show as <Text style={{ fontWeight: "800" }}>Pending (yellow)</Text> on the tutor's calendar until they confirm.
                  </Text>
                </View>
              </View>
            )}

            {error !== "" && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            {step === "details" ? (
              <>
                <TouchableOpacity style={s.ghostBtn} onPress={onClose}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, !form.student_id && { opacity: 0.5 }]} onPress={handleOpenCalendar} disabled={!form.student_id}>
                  <Text style={s.primaryTxt}>📅 Select Schedule →</Text>
                </TouchableOpacity>
              </>
            ) : step === "calendar" ? (
              <>
                <TouchableOpacity style={s.ghostBtn} onPress={() => { setError(""); setStep("details"); }}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, !allPicked && { opacity: 0.5 }]} onPress={handleConfirmSchedule} disabled={!allPicked}>
                  <Text style={s.primaryTxt}>Confirm {selected.length}/{REQUIRED_SESSIONS} Sessions →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.ghostBtn} onPress={() => { setError(""); setStep("calendar"); }}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleBook} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryTxt}>✓ Confirm Booking</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  box:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  header:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 },
  title:   { flex: 1, fontSize: 16, fontWeight: "800", color: DARK },

  infoBlue:    { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, padding: 12, marginBottom: 16 },
  infoBlueTxt: { fontSize: 13, color: "#1D4ED8", lineHeight: 19 },
  label:       { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 8 },
  optCol:      { gap: 8, marginBottom: 16 },
  optRow:      { flexDirection: "row", gap: 8, marginBottom: 16 },
  opt:         { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: BORDER, backgroundColor: "#FAFAFA" },
  optFlex:     { flex: 1, justifyContent: "center" },
  optOn:       { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  optTxt:      { fontSize: 13, fontWeight: "600", color: MID },
  optTxtOn:    { color: PRIMARY, fontWeight: "700" },

  counter:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, padding: 12, marginBottom: 12 },
  counterDone: { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" },
  counterTxt:  { fontSize: 13, fontWeight: "600", color: "#1D4ED8", flex: 1 },
  counterNum:  { fontSize: 20, fontWeight: "900", color: "#1D4ED8" },
  legend:      { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 12, height: 12, borderRadius: 3 },
  legendTxt:   { fontSize: 11, color: MUTED },
  monthNav:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  navBtn:      { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  monthTxt:    { fontSize: 15, fontWeight: "700", color: DARK },

  grid:    { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  dayHead: { width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "700", color: MUTED, paddingVertical: 4 },
  cell:    { width: `${100 / 7}%`, padding: 2 },
  dayBtn:  { minHeight: 48, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  dayNum:  { fontSize: 12 },
  dayTag:  { fontSize: 8, fontWeight: "800", color: "#fff", backgroundColor: "#6366F1", borderRadius: 4, paddingHorizontal: 3, overflow: "hidden" },
  dayTime: { fontSize: 8, color: "#6366F1" },

  timeBox:    { backgroundColor: "#FDF4FF", borderWidth: 1, borderColor: "#E9D5FF", borderRadius: 12, padding: 12, marginBottom: 12 },
  timeTitle:  { fontSize: 13, fontWeight: "700", color: "#7C3AED", marginBottom: 10 },
  timeGrid:   { flexDirection: "row", flexWrap: "wrap" },
  timeCell:   { width: "25%", padding: 3 },
  timeBtn:    { paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", alignItems: "center" },
  timeBtnOcc: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  timeTxt:    { fontSize: 10, color: MID },
  linkTxt:    { fontSize: 13, color: MUTED, fontWeight: "600" },

  selBox:    { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8 },
  selTitle:  { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 8 },
  selRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  selNum:    { width: 20, height: 20, borderRadius: 10, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  selNumTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  selTxt:    { flex: 1, fontSize: 12, fontWeight: "500", color: DARK },

  doneBox:    { backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#6EE7B7", borderRadius: 12, padding: 14, marginBottom: 16 },
  doneTitle:  { fontSize: 15, fontWeight: "800", color: "#065F46", textAlign: "center", marginBottom: 10 },
  doneRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  doneNum:    { width: 22, height: 22, borderRadius: 11, backgroundColor: "#065F46", alignItems: "center", justifyContent: "center" },
  doneNumTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  doneTxt:    { fontSize: 13, fontWeight: "600", color: "#065F46" },
  sumGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sumCell:    { width: "48%", backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12 },
  sumKey:     { fontSize: 10, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  sumVal:     { fontSize: 13, fontWeight: "600", color: DARK, textTransform: "capitalize" },
  infoYellow:    { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginTop: 14 },
  infoYellowTxt: { fontSize: 13, color: "#92400E", lineHeight: 19 },

  error:      { fontSize: 12, color: "#DC2626", fontWeight: "600", marginTop: 10 },
  footer:     { flexDirection: "row", gap: 10, marginTop: 14 },
  ghostBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  ghostTxt:   { fontSize: 14, color: MUTED, fontWeight: "600" },
  primaryBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  primaryTxt: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

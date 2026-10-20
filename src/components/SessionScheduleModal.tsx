import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import {
  MONTHS, DAYS_SHORT, HOURS, getDaysInMonth, getFirstDayOfMonth,
  toDateStr, todayStr, fmtHour, fmtTime, fmtDate, hourToTimeStr, prevMonth, nextMonth,
} from "../lib/calendar";

// Mirrors the "📅 Session Schedule" modal on the website's parent BookingsPage.jsx:
// lists the booking's 8 booking_slots; a rejected slot can be rescheduled,
// which updates that slot in place (new date/time, status back to "pending").

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";

// readOnly: tutor view (website TutorBookingsPage) — no reschedule
type Props = { booking: any | null; onClose: () => void; readOnly?: boolean };

function slotStyle(status: string) {
  if (status === "rejected")  return { bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444", label: "❌ Rejected" };
  if (status === "confirmed") return { bg: "#F0FDF4", border: "#6EE7B7", dot: "#22C55E", label: "✅ Confirmed" };
  if (status === "completed") return { bg: "#F3F4F6", border: "#E5E7EB", dot: "#6B7280", label: "✓ Done" };
  return { bg: "#FFFBEB", border: "#FDE68A", dot: "#F97316", label: "⏳ Pending" };
}

export default function SessionScheduleModal({ booking, onClose, readOnly = false }: Props) {
  const now = new Date();
  const [slots,   setSlots]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [reschedId,   setReschedId]   = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedHour, setReschedHour] = useState<number | null>(null);
  const [calYear,     setCalYear]     = useState(now.getFullYear());
  const [calMonth,    setCalMonth]    = useState(now.getMonth());
  const [saving,      setSaving]      = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSlots = useCallback(async (bookingId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("booking_slots")
      .select("*")
      .eq("booking_id", bookingId)
      .order("slot_date")
      .order("slot_time");
    if (error) console.error("fetchBookingSlots error:", error.message);
    setSlots(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!booking) return;
    resetResched();
    setToast(null);
    fetchSlots(booking.id);
  }, [booking?.id]);

  const resetResched = () => {
    setReschedId(null); setReschedDate(""); setReschedHour(null);
    setCalYear(now.getFullYear()); setCalMonth(now.getMonth());
  };

  const toggleResched = (slot: any) => {
    if (reschedId === slot.id) { resetResched(); return; }
    resetResched();
    setReschedId(slot.id);
  };

  const submitNewDate = async (slot: any) => {
    if (!reschedDate || reschedHour === null) { showToast("Please select date and time.", "error"); return; }
    setSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from("booking_slots")
        .update({ slot_date: reschedDate, slot_time: hourToTimeStr(reschedHour), status: "pending" })
        .eq("id", slot.id)
        .select()
        .single();
      if (error) throw error;
      if (!updated) throw new Error("Slot not found or update failed.");
      showToast("New date submitted! Waiting for tutor confirmation.");
      resetResched();
      await fetchSlots(booking.id);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const rejectedCount = slots.filter(s => s.status === "rejected").length;
  const today = todayStr();
  const cells: (number | null)[] = [
    ...Array.from({ length: getFirstDayOfMonth(calYear, calMonth) }, () => null),
    ...Array.from({ length: getDaysInMonth(calYear, calMonth) }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={!!booking} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.header}>
            <Text style={s.title}>📅 Session Schedule</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {booking && (
              <Text style={s.sub}>
                {booking.student?.name} · {booking.tutor?.full_name} · <Text style={{ textTransform: "capitalize" }}>{booking.subject}</Text>
              </Text>
            )}

            {toast && (
              <View style={[s.toast, { backgroundColor: toast.type === "error" ? "#FEE2E2" : "#D1FAE5" }]}>
                <Text style={[s.toastTxt, { color: toast.type === "error" ? "#DC2626" : "#065F46" }]}>
                  {toast.type === "error" ? "❌ " : "✅ "}{toast.msg}
                </Text>
              </View>
            )}

            {/* Legend */}
            <View style={s.legend}>
              {[["#F97316","Pending"],["#22C55E","Confirmed"],["#EF4444","Rejected — needs reschedule"],["#6B7280","Completed"]].map(([c, l]) => (
                <View key={l} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: c }]} />
                  <Text style={s.legendTxt}>{l}</Text>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 24 }} />
            ) : slots.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
                <Text style={s.emptyTitle}>No schedule yet</Text>
                <Text style={s.emptyTxt}>Your tutor hasn't confirmed the schedule yet.</Text>
              </View>
            ) : (
              <View>
                <Text style={s.count}>{slots.length} of 8 Sessions</Text>

                {slots.map((slot, i) => {
                  const st         = slotStyle(slot.status);
                  const isRejected = slot.status === "rejected" && !readOnly;
                  const isOpen     = reschedId === slot.id;
                  const dateLabel  = slot.slot_date ? fmtDate(slot.slot_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—";

                  return (
                    <View key={slot.id}>
                      <TouchableOpacity
                        activeOpacity={isRejected ? 0.7 : 1}
                        disabled={!isRejected}
                        onPress={() => toggleResched(slot)}
                        style={[s.slotRow, { backgroundColor: st.bg, borderColor: st.border }]}
                      >
                        <View style={[s.dot, { backgroundColor: st.dot }]} />
                        <View style={[s.sTag, { backgroundColor: st.dot }]}><Text style={s.sTagTxt}>S{i + 1}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.slotDate}>{dateLabel}</Text>
                          <Text style={s.slotTime}>{fmtTime(slot.slot_time) || "—"}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.slotStatus, { color: st.dot }]}>{st.label}</Text>
                          {isRejected && <Text style={s.reschedLink}>{isOpen ? "Cancel" : "📅 Reschedule"}</Text>}
                        </View>
                      </TouchableOpacity>

                      {/* Reschedule form */}
                      {isOpen && (
                        <View style={s.reschedBox}>
                          <Text style={s.reschedTitle}>📅 Pick a new date for Session {i + 1}</Text>

                          <Text style={s.fieldLbl}>New Date</Text>
                          <View style={s.monthNav}>
                            <TouchableOpacity onPress={() => { const [y, m] = prevMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
                              <Ionicons name="chevron-back" size={18} color={DARK} />
                            </TouchableOpacity>
                            <Text style={s.monthTxt}>{MONTHS[calMonth]} {calYear}</Text>
                            <TouchableOpacity onPress={() => { const [y, m] = nextMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
                              <Ionicons name="chevron-forward" size={18} color={DARK} />
                            </TouchableOpacity>
                          </View>
                          <View style={s.grid}>
                            {DAYS_SHORT.map(d => <Text key={d} style={s.dayHead}>{d.charAt(0)}</Text>)}
                            {cells.map((day, idx) => {
                              if (day === null) return <View key={`e${idx}`} style={s.cell} />;
                              const ds   = toDateStr(calYear, calMonth, day);
                              const past = ds < today;
                              const on   = ds === reschedDate;
                              return (
                                <View key={ds} style={s.cell}>
                                  <TouchableOpacity
                                    disabled={past}
                                    onPress={() => setReschedDate(ds)}
                                    style={[s.dayBtn, past && { opacity: 0.35 }, on && s.dayBtnOn]}
                                  >
                                    <Text style={[s.dayTxt, on && { color: "#fff" }]}>{day}</Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>

                          <Text style={s.fieldLbl}>New Time</Text>
                          <View style={s.hourGrid}>
                            {HOURS.map(h => {
                              const on = reschedHour === h;
                              return (
                                <View key={h} style={s.hourCell}>
                                  <TouchableOpacity onPress={() => setReschedHour(h)} style={[s.hourBtn, on && s.dayBtnOn]}>
                                    <Text style={[s.hourTxt, on && { color: "#fff" }]}>{fmtHour(h)}</Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>

                          <TouchableOpacity
                            style={[s.submitBtn, (saving || !reschedDate || reschedHour === null) && { opacity: 0.5 }]}
                            onPress={() => submitNewDate(slot)}
                            disabled={saving || !reschedDate || reschedHour === null}
                          >
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.submitTxt}>✓ Submit New Date</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {rejectedCount > 0 && !readOnly && (
                  <View style={s.warn}>
                    <Text style={s.warnTxt}>
                      ⚠️ {rejectedCount} session(s) were rejected. Tap the red session to pick a new date.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  box:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  header:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title:   { fontSize: 17, fontWeight: "800", color: DARK },
  sub:     { fontSize: 13, color: MUTED, marginBottom: 12 },

  toast:    { borderRadius: 10, padding: 12, marginBottom: 12 },
  toastTxt: { fontSize: 13, fontWeight: "600" },

  legend:     { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:  { width: 12, height: 12, borderRadius: 3 },
  legendTxt:  { fontSize: 11, color: MUTED },

  empty:      { alignItems: "center", paddingVertical: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 4 },
  emptyTxt:   { fontSize: 13, color: MUTED, textAlign: "center" },
  count:      { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 8 },

  slotRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  dot:         { width: 12, height: 12, borderRadius: 6 },
  sTag:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sTagTxt:     { fontSize: 11, fontWeight: "800", color: "#fff" },
  slotDate:    { fontSize: 13, fontWeight: "600", color: DARK },
  slotTime:    { fontSize: 12, color: MUTED },
  slotStatus:  { fontSize: 11, fontWeight: "700" },
  reschedLink: { fontSize: 11, fontWeight: "600", color: "#DC2626", textDecorationLine: "underline", marginTop: 2 },

  reschedBox:   { marginTop: -4, marginBottom: 10, padding: 14, backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA", borderRadius: 10 },
  reschedTitle: { fontSize: 13, fontWeight: "700", color: "#DC2626", marginBottom: 10 },
  fieldLbl:     { fontSize: 12, color: MUTED, marginBottom: 6, fontWeight: "600" },
  monthNav:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  monthTxt:     { fontSize: 13, fontWeight: "700", color: DARK },
  grid:         { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  dayHead:      { width: `${100 / 7}%`, textAlign: "center", fontSize: 10, fontWeight: "700", color: MUTED, paddingVertical: 2 },
  cell:         { width: `${100 / 7}%`, padding: 2 },
  dayBtn:       { height: 32, borderRadius: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  dayBtnOn:     { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dayTxt:       { fontSize: 12, fontWeight: "600", color: DARK },
  hourGrid:     { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  hourCell:     { width: "25%", padding: 2 },
  hourBtn:      { paddingVertical: 7, borderRadius: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  hourTxt:      { fontSize: 10, color: DARK },
  submitBtn:    { backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitTxt:    { color: "#fff", fontSize: 13, fontWeight: "700" },

  warn:    { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginTop: 4 },
  warnTxt: { fontSize: 13, color: "#92400E", fontWeight: "600" },

  closeBtn: { marginTop: 10, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  closeTxt: { fontSize: 14, color: MUTED, fontWeight: "600" },
});

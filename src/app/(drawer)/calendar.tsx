import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";
import {
  MONTHS, DAYS_SHORT, getDaysInMonth, getFirstDayOfMonth,
  toDateStr, todayStr, fmtTime, fmtDate, prevMonth, nextMonth,
} from "../../lib/calendar";

// Mirrors the website's src/pages/tutor/TutorCalendarPage.jsx

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const MID     = "#374151";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";

const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };

export default function TutorCalendarScreen() {
  const { user } = useAuth() as any;
  const now = new Date();

  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [slots,    setSlots]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selDate,  setSelDate]  = useState<string | null>(null);
  const [dayModal, setDayModal] = useState<any[] | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [rejectSlot, setRejectSlot] = useState<any>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSlots = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("booking_slots")
      .select(`
        *,
        booking:booking_id (
          id, subject, session_mode, payment_method, total_amount, status,
          parent:parent_id (full_name, email),
          student:student_id (name, grade_level)
        )
      `)
      .eq("tutor_id", user.id)
      .order("slot_date")
      .order("slot_time");
    setSlots(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const onRefresh = async () => { setRefreshing(true); await fetchSlots(); setRefreshing(false); };

  // Active = not rejected and booking not completed
  const activeOn = (dateStr: string) =>
    slots.filter(s => s.slot_date === dateStr && s.status !== "rejected" && s.booking?.status !== "completed");

  const getDateStatus = (dateStr: string) => {
    const day = activeOn(dateStr);
    if (!day.length) return "available";
    if (day.some(s => s.status === "confirmed")) return "confirmed";
    if (day.some(s => s.status === "pending"))   return "pending";
    return "available";
  };

  const handleDayClick = (dateStr: string) => {
    setSelDate(dateStr);
    setDayModal(slots.filter(s => s.slot_date === dateStr));
  };

  const handleAccept = async (slot: any) => {
    setSaving(true);
    try {
      const { error: slotErr } = await supabase.from("booking_slots").update({ status: "confirmed" }).eq("id", slot.id);
      if (slotErr) throw slotErr;
      const { error: bookErr } = await supabase.from("bookings").update({
        schedule_status: "confirmed",
        status:          "confirmed",
        scheduled_date:  slot.slot_date,
        scheduled_time:  slot.slot_time,
      }).eq("id", slot.booking_id);
      if (bookErr) throw bookErr;
      showToast("Booking confirmed! The parent has been notified.");
      await fetchSlots();
      setDayModal(null);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const confirmReject = async () => {
    const slot = rejectSlot;
    setRejectSlot(null);
    setSaving(true);
    try {
      const { error: slotErr } = await supabase.from("booking_slots").update({ status: "rejected" }).eq("id", slot.id);
      if (slotErr) throw slotErr;
      // Keep booking active — only this slot is rejected
      await supabase.from("bookings").update({ schedule_status: "pending" }).eq("id", slot.booking_id);
      showToast("Session rejected. The parent will be notified to pick a new date.");
      await fetchSlots();
      setDayModal(null);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const daysInMonth  = getDaysInMonth(calYear, calMonth);
  const firstDay     = getFirstDayOfMonth(calYear, calMonth);
  const today        = todayStr();
  const pendingCount = slots.filter(s => s.status === "pending").length;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Calendar" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <Text style={s.pageTitle}>📅 My Calendar</Text>
        <Text style={s.pageSub}>View and manage your booking schedule.</Text>

        {pendingCount > 0 && (
          <View style={s.pendingBanner}>
            <Text style={s.pendingTxt}>⏳ {pendingCount} pending request{pendingCount !== 1 ? "s" : ""} to review</Text>
          </View>
        )}

        {toast && (
          <View style={[s.toast, { backgroundColor: toast.type === "error" ? "#FEE2E2" : "#D1FAE5" }]}>
            <Text style={[s.toastTxt, { color: toast.type === "error" ? "#DC2626" : "#065F46" }]}>
              {toast.type === "error" ? "❌ " : "✅ "}{toast.msg}
            </Text>
            <TouchableOpacity onPress={() => setToast(null)}>
              <Ionicons name="close" size={16} color={toast.type === "error" ? "#DC2626" : "#065F46"} />
            </TouchableOpacity>
          </View>
        )}

        {/* Legend */}
        <View style={s.legend}>
          {[["#22C55E","Available"],["#EF4444","Confirmed/Occupied"],["#F59E0B","Pending (awaiting confirmation)"]].map(([c, l]) => (
            <View key={l} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: c }]} />
              <Text style={s.legendTxt}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          {/* Month navigation */}
          <View style={s.monthNav}>
            <TouchableOpacity style={s.navBtn} onPress={() => { const [y, m] = prevMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
              <Text style={s.navTxt}>← Prev</Text>
            </TouchableOpacity>
            <Text style={s.monthTxt}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={() => { const [y, m] = nextMonth(calYear, calMonth); setCalYear(y); setCalMonth(m); }}>
              <Text style={s.navTxt}>Next →</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={s.grid}>
              {DAYS_SHORT.map(d => <Text key={d} style={s.dayHead}>{d}</Text>)}
              {cells.map((day, idx) => {
                if (day === null) return <View key={`e${idx}`} style={s.cell} />;
                const dateStr = toDateStr(calYear, calMonth, day);
                const isPast  = dateStr < today;
                const isToday = dateStr === today;
                const status  = getDateStatus(dateStr);
                const active  = activeOn(dateStr);

                let bg = "#22C55E", border = "#16A34A", txt = "#fff";
                if (isPast && active.length === 0) { bg = "#F3F4F6"; border = "#E5E7EB"; txt = "#9CA3AF"; }
                else if (status === "confirmed")   { bg = "#EF4444"; border = "#DC2626"; }
                else if (status === "pending")     { bg = "#F97316"; border = "#EA580C"; }
                if (isToday) { bg = PRIMARY; border = PRIMARY; txt = "#fff"; }

                return (
                  <View key={dateStr} style={s.cell}>
                    <TouchableOpacity
                      onPress={() => handleDayClick(dateStr)}
                      style={[s.dayBtn, { backgroundColor: bg, borderColor: border }]}
                    >
                      <Text style={[s.dayNum, { color: txt }]}>{day}</Text>
                      {active.length > 0 && (
                        <Text style={[s.daySlots, { color: txt }]}>{active.length} slot{active.length !== 1 ? "s" : ""}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Day detail modal ── */}
      <Modal visible={!!dayModal} transparent animationType="slide" onRequestClose={() => setDayModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>📅 {selDate ? fmtDate(selDate, LONG_DATE) : ""}</Text>
              <TouchableOpacity onPress={() => setDayModal(null)}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {dayModal && dayModal.length === 0 ? (
                <Text style={s.noBookings}>No bookings for this day.</Text>
              ) : (dayModal || []).map(slot => {
                const done = slot.booking?.status === "completed";
                const st   = done ? "completed" : slot.status;
                const cfg  = st === "completed" ? { border: "#E5E7EB", bg: "#F3F4F6", pillBg: "#E5E7EB", pillTxt: "#6B7280", label: "✓ Completed" }
                           : st === "confirmed" ? { border: "#6EE7B7", bg: "#F0FDF4", pillBg: "#D1FAE5", pillTxt: "#065F46", label: "✅ Confirmed" }
                           : st === "pending"   ? { border: "#FDE68A", bg: "#FFFBEB", pillBg: "#FEF9C3", pillTxt: "#92400E", label: "⏳ Pending" }
                           :                      { border: "#E5E7EB", bg: "#FAFAFA", pillBg: "#F3F4F6", pillTxt: "#6B7280", label: slot.status === "rejected" ? "✗ Rejected" : "—" };
                return (
                  <View key={slot.id} style={[s.slotCard, { borderColor: cfg.border, backgroundColor: cfg.bg, opacity: done ? 0.6 : 1 }]}>
                    <View style={s.slotTop}>
                      <View style={[s.pill, { backgroundColor: cfg.pillBg }]}>
                        <Text style={[s.pillTxt, { color: cfg.pillTxt }]}>{cfg.label}</Text>
                      </View>
                      <Text style={s.slotTime}>{fmtTime(slot.slot_time)}</Text>
                    </View>

                    <View style={s.detailGrid}>
                      {([
                        ["Parent",  slot.booking?.parent?.full_name || "—"],
                        ["Student", slot.booking?.student?.name || "—"],
                        ["Grade",   `Grade ${slot.booking?.student?.grade_level || "—"}`],
                        ["Subject", slot.booking?.subject || "—"],
                        ["Mode",    slot.booking?.session_mode || "—"],
                        ["Total",   `₱${Number(slot.booking?.total_amount || 0).toLocaleString()}`],
                      ] as [string, string][]).map(([k, v]) => (
                        <View key={k} style={s.detailCell}>
                          <Text style={s.detailKey}>{k}</Text>
                          <Text style={s.detailVal}>{v}</Text>
                        </View>
                      ))}
                    </View>

                    {slot.status === "pending" && !done && (
                      <View style={s.actions}>
                        <TouchableOpacity style={s.rejectBtn} onPress={() => setRejectSlot(slot)} disabled={saving}>
                          <Text style={s.rejectTxt}>✗ Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(slot)} disabled={saving}>
                          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.acceptTxt}>✓ Accept Booking</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={() => setDayModal(null)}>
              <Text style={s.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Reject confirm modal ── */}
      <Modal visible={!!rejectSlot} transparent animationType="fade" onRequestClose={() => setRejectSlot(null)}>
        <View style={[s.overlay, { justifyContent: "center", padding: 20 }]}>
          <View style={s.rejectBox}>
            <Text style={{ fontSize: 44, textAlign: "center", marginBottom: 12 }}>❌</Text>
            <Text style={s.rejectTitle}>Reject This Session?</Text>
            <Text style={s.rejectBody}>
              Only this specific session will be rejected. The booking stays active and the parent will be asked to pick a new date for this session only.
            </Text>
            {rejectSlot && (
              <View style={s.rejectWhen}>
                <Text style={s.rejectWhenTxt}>
                  📅 {rejectSlot.slot_date ? fmtDate(rejectSlot.slot_date, LONG_DATE) : "—"} · {fmtTime(rejectSlot.slot_time) || "—"}
                </Text>
              </View>
            )}
            <View style={s.actions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRejectSlot(null)}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rejectConfirmBtn} onPress={confirmReject} disabled={saving}>
                <Text style={s.acceptTxt}>{saving ? "Rejecting..." : "Yes, Reject"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content:   { padding: 16, paddingBottom: 80 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: DARK },
  pageSub:   { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 14 },

  pendingBanner: { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  pendingTxt:    { fontSize: 13, color: "#92400E", fontWeight: "600" },
  toast:    { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, marginBottom: 14 },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "600" },

  legend:     { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:  { width: 14, height: 14, borderRadius: 4 },
  legendTxt:  { fontSize: 12, color: MUTED },

  card:     { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 12 },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  navBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  navTxt:   { fontSize: 13, color: MID, fontWeight: "600" },
  monthTxt: { fontSize: 17, fontWeight: "800", color: DARK },

  grid:     { flexDirection: "row", flexWrap: "wrap" },
  dayHead:  { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "700", color: MUTED, paddingVertical: 6 },
  cell:     { width: `${100 / 7}%`, padding: 3 },
  dayBtn:   { minHeight: 54, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 2 },
  dayNum:   { fontSize: 14, fontWeight: "700" },
  daySlots: { fontSize: 9, fontWeight: "700", opacity: 0.9 },

  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 },
  modalTitle:  { flex: 1, fontSize: 15, fontWeight: "800", color: DARK },
  noBookings:  { textAlign: "center", paddingVertical: 24, color: MUTED },

  slotCard:   { borderWidth: 2, borderRadius: 12, padding: 14, marginBottom: 12 },
  slotTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pill:       { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20 },
  pillTxt:    { fontSize: 12, fontWeight: "800" },
  slotTime:   { fontSize: 13, fontWeight: "600", color: MID },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  detailCell: { width: "48%", backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 10 },
  detailKey:  { fontSize: 10, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  detailVal:  { fontSize: 13, fontWeight: "600", color: DARK, textTransform: "capitalize" },

  actions:   { flexDirection: "row", gap: 8, marginTop: 10 },
  rejectBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FCA5A5", alignItems: "center" },
  rejectTxt: { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  acceptBtn: { flex: 2, paddingVertical: 11, borderRadius: 10, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  acceptTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  closeBtn:  { marginTop: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  closeTxt:  { fontSize: 14, color: MUTED, fontWeight: "600" },

  rejectBox:        { backgroundColor: "#fff", borderRadius: 18, padding: 22 },
  rejectTitle:      { fontSize: 18, fontWeight: "800", color: DARK, textAlign: "center", marginBottom: 8 },
  rejectBody:       { fontSize: 13, color: MUTED, lineHeight: 20, textAlign: "center", marginBottom: 14 },
  rejectWhen:       { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 12 },
  rejectWhenTxt:    { fontSize: 13, fontWeight: "600", color: "#DC2626", textAlign: "center" },
  cancelBtn:        { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  cancelTxt:        { fontSize: 14, color: MUTED, fontWeight: "600" },
  rejectConfirmBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: "#EF4444", alignItems: "center" },
});

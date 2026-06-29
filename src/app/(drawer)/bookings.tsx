import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Modal, Alert, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY  = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED    = "#6B7280";
const DARK     = "#111827";
const BORDER   = "#E5E7EB";
const BG       = "#F5F7FB";
const GREEN    = "#10B981";
const ORANGE   = "#F59E0B";
const CORAL    = "#EF4444";
const PURPLE   = "#7C3AED";

const PARENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:                { label: "Pending",               color: ORANGE,    bg: "#FEF9C3" },
  confirmed:              { label: "On-going",              color: "#2563EB", bg: "#DBEAFE" },
  rejected:               { label: "Rejected",              color: CORAL,     bg: "#FEE2E2" },
  cancelled:              { label: "Cancelled",             color: CORAL,     bg: "#FEE2E2" },
  pending_parent_confirm: { label: "Awaiting Confirmation", color: PURPLE,    bg: "#EDE9FE" },
  completed:              { label: "Completed",             color: GREEN,     bg: "#D1FAE5" },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

export default function BookingsPage() {
  const { user } = useAuth() as any;

  const [bookings,     setBookings]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState<string | null>(null);
  const [selected,     setSelected]     = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    topic: "", indicator: "good", star_rating: 0, rating_comment: "",
  });

  const setF = (k: string, v: any) => setFeedbackForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id, subject, session_mode, payment_method, status,
        total_amount, commission_amount, session_count, created_at,
        tutor:tutor_id ( id, full_name ),
        student:student_id ( name, grade_level ),
        parent:parent_id ( full_name )
      `)
      .eq("parent_id", user.id)
      .order("created_at", { ascending: false });

    if (error) console.error("Bookings load error:", error.message);
    setBookings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (id: string) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel", style: "destructive", onPress: async () => {
          setUpdating(id);
          await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
          await load();
          setUpdating(null);
        },
      },
    ]);
  };

  const handleConfirmComplete = async () => {
    if (feedbackForm.star_rating === 0) {
      Alert.alert("Required", "Please select a star rating before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const b       = confirmModal;
      const tutorId = b.tutor?.id;

      const { data: tutorRow } = await supabase
        .from("tutors")
        .select("approved_rate, rate_per_session, wallet_balance")
        .eq("id", tutorId)
        .single();

      const rate  = tutorRow?.approved_rate || tutorRow?.rate_per_session || 0;
      const total = rate * 8;
      const comm  = total * 0.10;

      await supabase.from("sessions").insert({
        booking_id:            b.id,
        scheduled_date:        new Date().toISOString().split("T")[0],
        status:                "completed",
        topic_covered:         feedbackForm.topic || "",
        performance_indicator: feedbackForm.indicator || "good",
        tutor_comments:        "",
      });

      await supabase.from("tutor_ratings").upsert({
        tutor_id:    tutorId,
        parent_id:   user.id,
        booking_id:  b.id,
        star_rating: feedbackForm.star_rating,
        comment:     feedbackForm.rating_comment || "",
      }, { onConflict: "booking_id,parent_id" });

      await supabase.from("bookings").update({
        status:            "completed",
        total_amount:      total,
        commission_amount: comm,
      }).eq("id", b.id);

      const newBal = Number(tutorRow?.wallet_balance || 0) - comm;
      await supabase.from("tutors").update({ wallet_balance: newBal }).eq("id", tutorId);
      await supabase.from("wallet_transactions").insert({
        tutor_id:    tutorId,
        type:        "commission_deduction",
        amount:      -comm,
        description: "10% Commission - Booking #" + b.id.slice(0, 8),
      });

      setConfirmModal(null);
      setFeedbackForm({ topic: "", indicator: "good", star_rating: 0, rating_comment: "" });
      await load();
      Alert.alert("Done!", "Session confirmed and feedback submitted. Thank you!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const subjectLabel = (s: string) =>
    s === "both" ? "Both (English & Math)" :
    s === "english" ? "English" :
    s === "mathematics" ? "Mathematics" :
    capFirst(s || "");

  const modeLabel = (s: string) =>
    s === "face-to-face" ? "Face-to-Face" : capFirst(s || "");

  const paymentLabel = (s: string) =>
    s === "gcash" ? "GCash" :
    s === "bank_transfer" ? "Bank Transfer" :
    capFirst(s || "");

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Bookings" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Bookings</Text>
        <Text style={s.sub}>View and manage your tutoring session bookings.</Text>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : bookings.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={56} color="#D1D5DB" />
            <Text style={s.eTitle}>No bookings yet</Text>
            <Text style={s.eTxt}>Inquire a tutor and book a session to get started.</Text>
          </View>
        ) : (
          bookings.map((b, i) => {
            const sc            = PARENT_STATUS[b.status] || PARENT_STATUS.pending;
            const isU           = updating === b.id;
            const isPending     = b.status === "pending";
            const isPendingConf = b.status === "pending_parent_confirm";

            return (
              <View key={b.id} style={s.card}>

                {/* ── Card Top: Child + Tutor + Status badge ── */}
                <View style={s.cardTop}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{b.student?.name?.charAt(0) || "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.childName}>{b.student?.name || "--"}</Text>
                    <Text style={s.tutorName}>{b.tutor?.full_name || "--"}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    {b.status === "completed" && (
                      <Ionicons name="checkmark" size={11} color={sc.color} />
                    )}
                    <Text style={[s.statusTxt, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* ── Info Grid: 2x2 ── */}
                <View style={s.infoGrid}>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Subject</Text>
                    <Text style={[s.infoVal, { color: PRIMARY }]}>{subjectLabel(b.subject)}</Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Mode</Text>
                    <Text style={s.infoVal}>{modeLabel(b.session_mode)}</Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Amount</Text>
                    <Text style={[s.infoVal, { fontWeight: "700" }]}>
                      {b.total_amount ? "P" + Number(b.total_amount).toLocaleString() : "--"}
                    </Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Payment</Text>
                    <Text style={s.infoVal}>{paymentLabel(b.payment_method)}</Text>
                  </View>
                </View>

                {/* ── Date ── */}
                <View style={s.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={MUTED} />
                  <Text style={s.dateTxt}>
                    Booked: {b.created_at ? fmtDate(b.created_at) : "--"}
                  </Text>
                </View>

                {/* ── Awaiting confirmation banner ── */}
                {isPendingConf && (
                  <View style={s.alertBanner}>
                    <Ionicons name="alert-circle-outline" size={14} color={PURPLE} />
                    <Text style={s.alertBannerTxt}>
                      Tutor marked this session complete. Please confirm and rate!
                    </Text>
                  </View>
                )}

                {/* ── Action Buttons ── */}
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.viewBtn} onPress={() => setSelected(b)}>
                    <Ionicons name="eye-outline" size={14} color={MUTED} />
                    <Text style={s.viewBtnTxt}>View Details</Text>
                  </TouchableOpacity>

                  {isPending && (
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => handleCancel(b.id)}
                      disabled={isU}
                    >
                      {isU
                        ? <ActivityIndicator size="small" color={CORAL} />
                        : <Text style={s.cancelBtnTxt}>Cancel</Text>}
                    </TouchableOpacity>
                  )}

                  {isPendingConf && (
                    <TouchableOpacity
                      style={s.confirmBtn}
                      onPress={() => {
                        setConfirmModal(b);
                        setFeedbackForm({ topic: "", indicator: "good", star_rating: 0, rating_comment: "" });
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={s.confirmBtnTxt}>Confirm Session</Text>
                    </TouchableOpacity>
                  )}

                  {b.status === "completed" && (
                    <View style={s.completedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                      <Text style={s.completedBadgeTxt}>Completed</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── View Detail Modal ── */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Booking Details</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.detailGrid}>
                  {([
                    ["CHILD",      (selected.student?.name || "--") + " (Grade " + selected.student?.grade_level + ")"],
                    ["PARENT",     selected.parent?.full_name || "--"],
                    ["TUTOR",      selected.tutor?.full_name  || "--"],
                    ["SUBJECT",    subjectLabel(selected.subject)],
                    ["MODE",       modeLabel(selected.session_mode)],
                    ["PAYMENT",    paymentLabel(selected.payment_method)],
                    ["AMOUNT",     selected.total_amount      ? "P" + Number(selected.total_amount).toLocaleString()      : "--"],
                    ["COMMISSION", selected.commission_amount ? "P" + Number(selected.commission_amount).toLocaleString() : "--"],
                    ["STATUS",     PARENT_STATUS[selected.status]?.label || selected.status],
                    ["BOOKED",     selected.created_at ? fmtDate(selected.created_at) : "--"],
                  ] as [string, string][]).map(([k, v]) => (
                    <View key={k} style={s.detailCell}>
                      <Text style={s.detailKey}>{k}</Text>
                      <Text style={s.detailVal}>{v}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={s.closeBtnTxt}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Confirm Session + Feedback Modal ── */}
      <Modal visible={!!confirmModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Confirm Session & Feedback</Text>
              <TouchableOpacity onPress={() => !submitting && setConfirmModal(null)}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            {confirmModal && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.infoBanner}>
                  <Text style={s.infoBannerTxt}>
                    {"Session with: "}
                    <Text style={{ fontWeight: "800" }}>{confirmModal.tutor?.full_name}</Text>
                    {"\nChild: " + confirmModal.student?.name + "  |  Subject: " + subjectLabel(confirmModal.subject)}
                  </Text>
                </View>
                <View style={s.warningBanner}>
                  <Text style={s.warningBannerTxt}>
                    Confirming means this session was conducted. Please rate the tutor.
                  </Text>
                </View>

                <Text style={s.label}>Topic Covered</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Fractions - Introduction"
                  placeholderTextColor={MUTED}
                  value={feedbackForm.topic}
                  onChangeText={v => setF("topic", v)}
                />

                <Text style={s.label}>Performance</Text>
                <View style={s.indRow}>
                  {[
                    { v: "good",              l: "Good",             c: GREEN  },
                    { v: "improving",         l: "Improving",        c: ORANGE },
                    { v: "needs_improvement", l: "Needs Improvement",c: CORAL  },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.v}
                      style={[
                        s.indBtn,
                        feedbackForm.indicator === opt.v && { borderColor: opt.c, backgroundColor: opt.c + "15" },
                      ]}
                      onPress={() => setF("indicator", opt.v)}
                    >
                      <Text style={[
                        s.indBtnTxt,
                        feedbackForm.indicator === opt.v && { color: opt.c, fontWeight: "700" },
                      ]}>
                        {opt.l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>
                  Rate the Tutor <Text style={{ color: CORAL }}>*</Text>
                </Text>
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setF("star_rating", star)}>
                      <Text style={[s.star, { color: star <= feedbackForm.star_rating ? ORANGE : "#D1D5DB" }]}>
                        {star <= feedbackForm.star_rating ? "★" : "☆"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[s.ratingLbl, { color: feedbackForm.star_rating === 0 ? CORAL : MUTED }]}>
                  {feedbackForm.star_rating === 0 ? "Please select a rating" :
                   feedbackForm.star_rating === 5 ? "Excellent!" :
                   feedbackForm.star_rating === 4 ? "Good" :
                   feedbackForm.star_rating === 3 ? "Average" :
                   feedbackForm.star_rating === 2 ? "Below Average" : "Poor"}
                </Text>

                <Text style={s.label}>Your Feedback (optional)</Text>
                <TextInput
                  style={[s.input, { height: 80, textAlignVertical: "top" }]}
                  placeholder="Share your experience with this tutor..."
                  placeholderTextColor={MUTED}
                  value={feedbackForm.rating_comment}
                  onChangeText={v => setF("rating_comment", v)}
                  multiline
                />

                <View style={s.mFooter}>
                  <TouchableOpacity style={s.ghostBtn} onPress={() => setConfirmModal(null)} disabled={submitting}>
                    <Text style={s.ghostTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.primaryBtn, { opacity: feedbackForm.star_rating === 0 ? 0.5 : 1 }]}
                    onPress={handleConfirmComplete}
                    disabled={submitting || feedbackForm.star_rating === 0}
                  >
                    {submitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.primaryBtnTxt}>Confirm and Submit</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BG },
  content:         { padding: 16, paddingBottom: 40 },
  heading:         { fontSize: 20, fontWeight: "800", color: DARK },
  sub:             { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 20 },

  // Empty state
  empty:           { alignItems: "center", marginTop: 60 },
  eTitle:          { fontSize: 16, fontWeight: "700", color: DARK, marginTop: 12 },
  eTxt:            { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 8 },

  // Card
  card:            { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 14 },
  cardTop:         { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar:          { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_BG, alignItems: "center", justifyContent: "center" },
  avatarTxt:       { fontSize: 18, fontWeight: "800", color: PRIMARY },
  childName:       { fontSize: 15, fontWeight: "700", color: DARK },
  tutorName:       { fontSize: 12, color: MUTED, marginTop: 2 },

  // Status badge
  statusBadge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusTxt:       { fontSize: 11, fontWeight: "700" },

  // Info grid 2x2
  infoGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  infoCell:        { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 8, padding: 10 },
  infoLabel:       { fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4, marginBottom: 4 },
  infoVal:         { fontSize: 13, fontWeight: "600", color: DARK },

  // Date row
  dateRow:         { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  dateTxt:         { fontSize: 12, color: MUTED },

  // Alert banner
  alertBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EDE9FE", borderRadius: 8, padding: 10, marginBottom: 10 },
  alertBannerTxt:  { fontSize: 12, color: PURPLE, flex: 1, fontWeight: "600" },

  // Action buttons
  actionRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  viewBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  viewBtnTxt:      { fontSize: 13, color: MUTED, fontWeight: "600" },
  cancelBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEE2E2" },
  cancelBtnTxt:    { fontSize: 13, color: CORAL, fontWeight: "700" },
  confirmBtn:      { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, backgroundColor: PURPLE, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" },
  confirmBtnTxt:   { fontSize: 13, color: "#fff", fontWeight: "700" },
  completedBadge:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  completedBadgeTxt:{ fontSize: 13, color: GREEN, fontWeight: "700" },

  // Modals
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox:        { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxHeight: "85%" },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:      { fontSize: 16, fontWeight: "800", color: DARK },
  detailGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  detailCell:      { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12 },
  detailKey:       { fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  detailVal:       { fontSize: 13, fontWeight: "600", color: DARK },
  closeBtn:        { paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: BORDER },
  closeBtnTxt:     { fontSize: 14, color: MUTED, fontWeight: "600" },
  infoBanner:      { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14, marginBottom: 12 },
  infoBannerTxt:   { fontSize: 13, color: "#1D4ED8", lineHeight: 20 },
  warningBanner:   { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 14, marginBottom: 16 },
  warningBannerTxt:{ fontSize: 13, color: "#92400E" },
  label:           { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 8, marginTop: 12 },
  input:           { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, fontSize: 13, color: DARK, backgroundColor: "#FAFAFA" },
  indRow:          { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  indBtn:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#FAFAFA" },
  indBtnTxt:       { fontSize: 12, color: MUTED },
  starsRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  star:            { fontSize: 36 },
  ratingLbl:       { fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 8 },
  mFooter:         { flexDirection: "row", gap: 10, marginTop: 16 },
  ghostBtn:        { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  ghostTxt:        { fontSize: 14, color: MUTED, fontWeight: "600" },
  primaryBtn:      { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: PRIMARY, alignItems: "center" },
  primaryBtnTxt:   { fontSize: 14, color: "#fff", fontWeight: "700" },
});
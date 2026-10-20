import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";
import SessionScheduleModal from "../../components/SessionScheduleModal";
import BookingDetailModal from "../../components/BookingDetailModal";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const GREEN      = "#10B981";
const GREEN_BG   = "#D1FAE5";
const TEAL       = "#0D9488";
const TEAL_BG    = "#CCFBF1";
const PURPLE     = "#7C3AED";
const PURPLE_BG  = "#EDE9FE";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const TUTOR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:                { label: "Pending",        color: ORANGE,  bg: ORANGE_BG },
  confirmed:              { label: "Confirmed",       color: GREEN,   bg: GREEN_BG  },
  rejected:               { label: "Rejected",        color: CORAL,   bg: CORAL_BG  },
  cancelled:              { label: "Cancelled",       color: MUTED,   bg: "#F3F4F6" },
  pending_parent_confirm: { label: "Awaiting Parent", color: PURPLE,  bg: PURPLE_BG },
  completed:              { label: "Completed",       color: TEAL,    bg: TEAL_BG   },
};

const PARENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:                { label: "Pending",                    color: ORANGE,  bg: ORANGE_BG },
  confirmed:              { label: "On-going",                   color: PRIMARY, bg: PRIMARY_BG },
  rejected:               { label: "Rejected",                   color: CORAL,   bg: CORAL_BG  },
  cancelled:              { label: "Cancelled",                  color: MUTED,   bg: "#F3F4F6" },
  pending_parent_confirm: { label: "Needs Confirmation",         color: PURPLE,  bg: PURPLE_BG },
  completed:              { label: "Completed",                  color: GREEN,   bg: GREEN_BG  },
};

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function subjectLabel(s: string) {
  return s === "both" ? "English & Mathematics"
       : s === "english" ? "English"
       : s === "mathematics" ? "Mathematics"
       : cap(s);
}
function modeLabel(s: string) { return s === "face-to-face" ? "Face-to-Face" : cap(s || ""); }
function paymentLabel(s: string) {
  return s === "gcash" ? "GCash" : s === "bank_transfer" ? "Bank Transfer" : cap(s || "");
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 8 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: 34, color: star <= value ? "#F59E0B" : "#D1D5DB" }}>★</Text>
        </TouchableOpacity>
      ))}
      {value > 0 && (
        <Text style={{ fontSize: 12, color: MUTED, marginLeft: 4 }}>
          {value === 5 ? "Excellent!" : value === 4 ? "Good" : value === 3 ? "Average" : value === 2 ? "Below Average" : "Poor"}
        </Text>
      )}
    </View>
  );
}

export default function BookingsScreen() {
  const { user, profile } = useAuth() as any;
  const router   = useRouter();
  const isTutor  = profile?.role === "tutor";
  const isParent = profile?.role === "parent";

  const [bookings,     setBookings]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState<string | null>(null);
  const [selected,     setSelected]     = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ star_rating: 0, rating_comment: "" });
  const setF = (k: string, v: any) => setFeedbackForm(f => ({ ...f, [k]: v }));
  const [scheduleFor,   setScheduleFor]   = useState<any>(null);
  const [parentBalance, setParentBalance] = useState<number | null>(null);
  const [payError,      setPayError]      = useState("");
  const [toast,         setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── KEY FIX: Query separately by role to respect RLS ───────────────────────
  const fetchBookings = useCallback(async () => {
    if (!user || (!isTutor && !isParent)) return;
    setLoading(true);
    try {
      let query;

      if (isTutor) {
        // Tutor: fetch where tutor_id = user.id
        query = supabase
          .from("bookings")
          .select(`
            *,
            parent:parent_id   ( id, full_name ),
            student:student_id ( id, name, grade_level ),
            tutor:tutor_id     ( id, full_name )          `)
          .eq("tutor_id", user.id)
          .order("created_at", { ascending: false });
      } else {
        // Parent: fetch where parent_id = user.id
        query = supabase
          .from("bookings")
          .select(`
            *,
            tutor:tutor_id     ( id, full_name ),
            parent:parent_id   ( id, full_name ),
            student:student_id ( id, name, grade_level )
          `)
          .eq("parent_id", user.id)
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [user, isTutor, isParent]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ── TUTOR: Accept ───────────────────────────────────────────────────────────
  // Same as the website: accepting only confirms the booking. Money moves later,
  // when the parent pays (the parent pays; the tutor receives 90%).
  const handleAccept = async (booking: any) => {
    setUpdating(booking.id);
    try {
      const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", booking.id);
      if (error) throw error;
      await fetchBookings();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setUpdating(null);
    }
  };

  // ── TUTOR: Reject ───────────────────────────────────────────────────────────
  const handleReject = (id: string) => {
    Alert.alert("Reject Booking", "Are you sure you want to reject this booking?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          setUpdating(id);
          try {
            const { error } = await supabase.from("bookings").update({ status: "rejected" }).eq("id", id);
            if (error) throw error;
            await fetchBookings();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setUpdating(null);
          }
        },
      },
    ]);
  };

  // ── TUTOR: Mark complete ────────────────────────────────────────────────────
  const handleMarkComplete = (id: string) => {
    Alert.alert(
      "Mark Session Complete",
      "Mark this booking as complete?\nThe parent will be asked to confirm and rate the session.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Mark Complete",
          onPress: async () => {
            setUpdating(id);
            try {
              const { error } = await supabase.from("bookings")
                .update({ status: "pending_parent_confirm" }).eq("id", id);
              if (error) throw error;
              await fetchBookings();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  };

  // ── PARENT: Cancel ──────────────────────────────────────────────────────────
  const handleParentCancel = (id: string) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Booking", style: "destructive",
        onPress: async () => {
          setUpdating(id);
          try {
            const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
            if (error) throw error;
            await fetchBookings();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setUpdating(null);
          }
        },
      },
    ]);
  };

  // ── PARENT: Confirm & Pay + Rate ────────────────────────────────────────────
  // Payment logic mirrors handleConfirmAndPay in the website's BookingsPage.jsx:
  // parent wallet pays the full amount, tutor receives 90%, LearnBridge keeps 10%.
  const SESSIONS = 8;
  const priceOf = (b: any) => Number(b?.total_amount || 0) || SESSIONS;

  const openConfirmPay = async (b: any) => {
    setFeedbackForm({ star_rating: 0, rating_comment: "" });
    setPayError("");
    setConfirmModal(b);
    const { data } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single();
    setParentBalance(Number(data?.wallet_balance || 0));
  };

  const handleConfirmAndPay = async () => {
    if (!confirmModal) return;
    if (feedbackForm.star_rating === 0) { setPayError("Please select a star rating."); return; }
    const b = confirmModal;
    setSubmitting(true);
    setPayError("");
    try {
      // Prevent double payment — check current payment status first
      const { data: fresh } = await supabase
        .from("bookings").select("payment_status").eq("id", b.id).single();
      if (fresh?.payment_status === "paid") {
        setConfirmModal(null);
        await fetchBookings();
        showToast("This booking has already been paid.", "error");
        return;
      }

      const totalAmount = priceOf(b);
      const { data: prof } = await supabase
        .from("profiles").select("wallet_balance").eq("id", user.id).single();
      const balance = Number(prof?.wallet_balance || 0);
      if (balance < totalAmount) {
        setParentBalance(balance);
        setPayError(`Insufficient wallet balance. You need ₱${totalAmount.toFixed(2)} but have ₱${balance.toFixed(2)}. Please top up first.`);
        return;
      }

      const fee      = Math.round(totalAmount * 0.10 * 100) / 100;
      const earnings = Math.round(totalAmount * 0.90 * 100) / 100;
      const subject  = subjectLabel(b.subject);

      // 1. Deduct from parent wallet
      const { error: deductErr } = await supabase.rpc("decrement_wallet", { user_id: user.id, amount: totalAmount });
      if (deductErr) throw new Error("Failed to deduct from wallet: " + deductErr.message);

      // 2. Record parent payment
      await supabase.from("wallet_transactions").insert({
        user_id:     user.id,
        type:        "deduction",
        amount:      totalAmount,
        description: `Payment for ${b.subject} sessions with ${b.tutor?.full_name || "Tutor"}`,
        booking_id:  b.id,
        status:      "completed",
      });

      // 3. Add 90% to tutor wallet + record earning and 10% fee
      await supabase.rpc("increment_tutor_wallet", { tutor_id: b.tutor_id, amount: earnings });
      await supabase.from("wallet_transactions").insert({
        user_id:     b.tutor_id,
        type:        "earning",
        amount:      earnings,
        description: `Earnings (90%) — ${b.subject} session with ${b.student?.name || "Student"}`,
        booking_id:  b.id,
        status:      "completed",
      });
      await supabase.from("wallet_transactions").insert({
        user_id:     b.tutor_id,
        type:        "deduction",
        amount:      fee,
        description: `LearnBridge platform fee (10%) — ${b.subject} session`,
        booking_id:  b.id,
        status:      "completed",
      });

      // 4. Platform commission record
      const { error: commErr } = await supabase.from("platform_earnings").insert({
        booking_id: b.id, gross_amount: totalAmount, commission: fee,
      });
      if (commErr) console.error("Platform earnings insert error:", commErr.message);

      // 5. Mark booking as paid AND completed
      await supabase.from("bookings").update({
        payment_status: "paid",
        paid_at:        new Date().toISOString(),
        platform_fee:   fee,
        tutor_earnings: earnings,
        status:         "completed",
      }).eq("id", b.id);

      // 6. Save the parent's rating (app extra — kept from the old Confirm & Rate)
      await supabase.from("tutor_ratings").upsert({
        booking_id:  b.id,
        tutor_id:    b.tutor_id,
        parent_id:   user.id,
        star_rating: feedbackForm.star_rating,
        comment:     feedbackForm.rating_comment || "",
      });

      setConfirmModal(null);
      setFeedbackForm({ star_rating: 0, rating_comment: "" });
      await fetchBookings();
      showToast(`Payment confirmed! ₱${earnings.toFixed(2)} sent to tutor (${subject}).`);
    } catch (e: any) {
      setPayError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Bookings" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  // Tutor sections (website TutorBookingsPage)
  const pendingList = bookings.filter(b => b.status === "pending");
  const activeList  = bookings.filter(b => ["confirmed", "pending_parent_confirm"].includes(b.status));
  const pastList    = bookings.filter(b => ["completed", "rejected", "cancelled"].includes(b.status));

  // ── One booking card ──────────────────────────────────────────────────────
  const renderCard = (b: any) => {
    const STATUS = isTutor ? TUTOR_STATUS : PARENT_STATUS;
    const sc     = STATUS[b.status] || { label: b.status, color: MUTED, bg: "#F3F4F6" };
    const isU    = updating === b.id;

    return (
      <TouchableOpacity key={b.id} style={s.card} onPress={() => setSelected(b)} activeOpacity={0.85}>
        {/* Header */}
        <View style={s.cardTop}>
          <View style={[s.cardAvatar, { backgroundColor: sc.bg }]}>
            <Text style={[s.cardAvatarTxt, { color: sc.color }]}>{(b.student?.name || "?").charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardName}>{b.student?.name || "Student"}</Text>
            <Text style={s.cardSub}>
              {isTutor ? `Parent: ${b.parent?.full_name || "—"}` : `Tutor: ${b.tutor?.full_name || "—"}`}
            </Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusTxt, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Chips */}
        <View style={s.chipRow}>
          <View style={s.chip}><Ionicons name="book-outline" size={11} color={MUTED} /><Text style={s.chipTxt}>{subjectLabel(b.subject)}</Text></View>
          <View style={s.chip}><Ionicons name="people-outline" size={11} color={MUTED} /><Text style={s.chipTxt}>{modeLabel(b.session_mode)}</Text></View>
          <View style={s.chip}><Ionicons name="cash-outline" size={11} color={MUTED} /><Text style={s.chipTxt}>₱{Number(b.total_amount || 0).toLocaleString()}</Text></View>
          {!!b.payment_method && (
            <View style={s.chip}><Ionicons name="card-outline" size={11} color={MUTED} /><Text style={s.chipTxt}>{paymentLabel(b.payment_method)}</Text></View>
          )}
        </View>

        <Text style={s.dateText}>Booked {fmtDate(b.created_at)}</Text>

        {/* View Schedule — both roles once the booking has dates (read-only for tutors, as on the website) */}
        {b.scheduled_date ? (
          <TouchableOpacity style={s.schedBtn} onPress={() => setScheduleFor(b)}>
            <Text style={s.schedBtnTxt}>📅 View Schedule</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.schedPending}>⏳ Schedule pending</Text>
        )}

        {/* TUTOR actions */}
        {isTutor && b.status === "pending" && (
          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, s.acceptBtn]} onPress={() => handleAccept(b)} disabled={isU}>
              {isU ? <ActivityIndicator size="small" color="#fff" />
                   : <><Ionicons name="checkmark" size={14} color="#fff" /><Text style={s.acceptTxt}>Accept</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={() => handleReject(b.id)} disabled={isU}>
              <Text style={s.rejectTxt}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {isTutor && b.status === "confirmed" && (
          <TouchableOpacity style={s.completeBtn} onPress={() => handleMarkComplete(b.id)} disabled={isU}>
            {isU ? <ActivityIndicator size="small" color={GREEN} />
                 : <><Ionicons name="checkmark-circle-outline" size={14} color={GREEN} /><Text style={s.completeTxt}>Mark Session Complete</Text></>}
          </TouchableOpacity>
        )}

        {/* PARENT actions */}
        {isParent && b.status === "pending" && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleParentCancel(b.id)} disabled={isU}>
            {isU ? <ActivityIndicator size="small" color={CORAL} /> : <Text style={s.cancelTxt}>Cancel Booking</Text>}
          </TouchableOpacity>
        )}

        {/* Confirm & Pay — only after tutor marks complete, and only if unpaid (same as website) */}
        {isParent && b.status === "pending_parent_confirm" && b.payment_status !== "paid" && (
          <TouchableOpacity style={[s.confirmBtn, { backgroundColor: "#22C55E" }]} onPress={() => openConfirmPay(b)} disabled={isU}>
            <Ionicons name="card" size={14} color="#fff" />
            <Text style={s.confirmTxt}>Confirm &amp; Pay</Text>
          </TouchableOpacity>
        )}

        {b.payment_status === "paid" && (
          <View style={s.paidBadge}><Text style={s.paidTxt}>Paid</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Bookings" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBookings} tintColor={PRIMARY} />}
      >
        <Text style={s.heading}>Bookings</Text>
        <Text style={s.sub}>
          {isTutor ? "Manage booking requests from parents." : "View and manage your tutoring session bookings."}
        </Text>

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

        {bookings.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={56} color="#D1D5DB" />
            <Text style={s.eTitle}>No bookings yet</Text>
            <Text style={s.eTxt}>
              {isTutor ? "Booking requests from parents will appear here." : "Inquire a tutor and book a session to get started."}
            </Text>
          </View>
        ) : isTutor ? (
          // Website TutorBookingsPage: pending banner + Pending / Active / Past sections
          <>
            {pendingList.length > 0 && (
              <View style={s.pendingBanner}>
                <Text style={s.pendingBannerTxt}>
                  ⏳ You have <Text style={{ fontWeight: "800" }}>{pendingList.length}</Text> pending booking request{pendingList.length !== 1 ? "s" : ""} — review and accept or reject below.
                </Text>
              </View>
            )}
            {([
              ["⏳ Pending Requests", pendingList],
              ["✅ Active Bookings",  activeList],
              ["📋 Past Bookings",    pastList],
            ] as [string, any[]][]).map(([title, items]) => items.length === 0 ? null : (
              <View key={title} style={{ marginBottom: 8 }}>
                <Text style={s.sectionTitle}>{title} ({items.length})</Text>
                {items.map(renderCard)}
              </View>
            ))}
          </>
        ) : (
          bookings.map(renderCard)
        )}
      </ScrollView>

      <SessionScheduleModal booking={scheduleFor} onClose={() => setScheduleFor(null)} readOnly={isTutor} />

      {/* Detail Modal */}
      <BookingDetailModal booking={selected} isTutor={isTutor} statusLabel={(st: string) => ((isTutor ? TUTOR_STATUS : PARENT_STATUS)[st]?.label || st)} onClose={() => setSelected(null)} />


      {/* Parent Confirm + Rate Modal */}
      <Modal visible={!!confirmModal} transparent animationType="slide" onRequestClose={() => !submitting && setConfirmModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Confirm &amp; Pay</Text>
              <TouchableOpacity onPress={() => !submitting && setConfirmModal(null)}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>
            {confirmModal && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.infoBanner}>
                  <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
                  <Text style={s.infoBannerTxt}>
                    Session with <Text style={{ fontWeight: "700" }}>{confirmModal.tutor?.full_name}</Text>
                    {" · "}Child: <Text style={{ fontWeight: "700" }}>{confirmModal.student?.name}</Text>
                    {" · "}<Text style={{ fontWeight: "700" }}>{subjectLabel(confirmModal.subject)}</Text>
                  </Text>
                </View>
                {/* Payment summary */}
                <View style={s.payBox}>
                  {([
                    ["Amount to pay", `₱${priceOf(confirmModal).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                    ["Tutor receives (90%)", `₱${(Math.round(priceOf(confirmModal) * 0.9 * 100) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                    ["Platform fee (10%)", `₱${(Math.round(priceOf(confirmModal) * 0.1 * 100) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                    ["Your wallet balance", parentBalance === null ? "…" : `₱${parentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                  ] as [string, string][]).map(([k, v], i) => (
                    <View key={k} style={[s.payRow, i === 0 && { borderTopWidth: 0 }]}>
                      <Text style={s.payKey}>{k}</Text>
                      <Text style={[s.payVal, i === 0 && { color: PRIMARY, fontSize: 16 }]}>{v}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.warningBanner}>
                  <Ionicons name="warning-outline" size={16} color={ORANGE} />
                  <Text style={s.warningTxt}>
                    Confirming means this session was conducted. The amount above will be paid from your wallet. Please rate the tutor honestly.
                  </Text>
                </View>
                <Text style={s.fieldLabel}>Rate the Tutor <Text style={{ color: CORAL }}>*</Text></Text>
                <StarRating value={feedbackForm.star_rating} onChange={v => setF("star_rating", v)} />
                {feedbackForm.star_rating === 0 && (
                  <Text style={{ fontSize: 11, color: CORAL, marginBottom: 8 }}>Please select a rating</Text>
                )}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>Your Feedback / Comment</Text>
                <Text style={s.fieldHint}>Visible to other parents in Find Tutors.</Text>
                <TextInput
                  style={[s.input, { height: 90, textAlignVertical: "top" }]}
                  placeholder="Share your experience..."
                  placeholderTextColor={MUTED}
                  value={feedbackForm.rating_comment}
                  onChangeText={v => setF("rating_comment", v)}
                  multiline
                  editable={!submitting}
                />
                {payError !== "" && (
                  <View style={s.payErrBox}>
                    <Text style={s.payErrTxt}>{payError}</Text>
                    {payError.startsWith("Insufficient") && (
                      <TouchableOpacity
                        style={s.goWalletBtn}
                        onPress={() => { setConfirmModal(null); router.push("/(drawer)/wallet" as any); }}
                      >
                        <Text style={s.goWalletTxt}>Go to Wallet →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={s.modalFooterRow}>
                  <TouchableOpacity style={s.modalCancelBtn} onPress={() => setConfirmModal(null)} disabled={submitting}>
                    <Text style={s.modalCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalConfirmBtn, { backgroundColor: "#22C55E" }, (submitting || feedbackForm.star_rating === 0) && { opacity: 0.5 }]}
                    onPress={handleConfirmAndPay}
                    disabled={submitting || feedbackForm.star_rating === 0}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Ionicons name="card" size={16} color="#fff" /><Text style={s.modalConfirmTxt}>Confirm &amp; Pay</Text></>
                    }
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
  container:    { flex: 1, backgroundColor: "transparent" },
  content:      { padding: 16, paddingBottom: 80 },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },
  heading:      { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:          { fontSize: 13, color: MUTED, marginBottom: 20 },
  empty:        { alignItems: "center", paddingVertical: 60, gap: 12 },
  eTitle:       { fontSize: 16, fontWeight: "700", color: DARK },
  eTxt:         { fontSize: 13, color: MUTED, textAlign: "center" },

  card:         { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 14, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  cardAvatar:   { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  cardAvatarTxt:{ fontSize: 18, fontWeight: "800" },
  cardName:     { fontSize: 15, fontWeight: "700", color: DARK },
  cardSub:      { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:    { fontSize: 11, fontWeight: "700" },
  chipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  chipTxt:      { fontSize: 11, color: MUTED },
  dateText:     { fontSize: 11, color: "#9CA3AF", marginBottom: 8 },

  actionRow:   { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  acceptBtn:   { backgroundColor: PRIMARY },
  acceptTxt:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  rejectBtn:   { backgroundColor: CORAL_BG, borderWidth: 1, borderColor: CORAL },
  rejectTxt:   { color: CORAL, fontSize: 13, fontWeight: "700" },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, paddingVertical: 11, borderRadius: 10, backgroundColor: GREEN_BG, borderWidth: 1, borderColor: GREEN },
  completeTxt: { color: GREEN, fontSize: 13, fontWeight: "700" },
  cancelBtn:   { alignItems: "center", marginTop: 4, paddingVertical: 11, borderRadius: 10, backgroundColor: CORAL_BG, borderWidth: 1, borderColor: CORAL },
  cancelTxt:   { color: CORAL, fontSize: 13, fontWeight: "700" },
  confirmBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, paddingVertical: 12, borderRadius: 10, backgroundColor: PRIMARY },
  confirmTxt:  { color: "#fff", fontSize: 13, fontWeight: "700" },

  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:       { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:     { fontSize: 17, fontWeight: "800", color: DARK },
  detailGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  detailCell:     { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12 },
  detailKey:      { fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  detailVal:      { fontSize: 13, fontWeight: "700", color: DARK },
  closeModalBtn:  { paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", marginTop: 4, marginBottom: 8 },
  closeModalTxt:  { color: "#fff", fontWeight: "700", fontSize: 14 },

  infoBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: PRIMARY_BG, borderRadius: 10, padding: 12, marginBottom: 12 },
  infoBannerTxt:  { flex: 1, fontSize: 12, color: PRIMARY, lineHeight: 17 },
  warningBanner:  { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: ORANGE_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  warningTxt:     { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17 },
  fieldLabel:     { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 4 },
  fieldHint:      { fontSize: 11, color: MUTED, marginBottom: 8 },
  input:          { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 12 },
  modalFooterRow: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  modalCancelTxt: { fontSize: 14, color: MUTED, fontWeight: "600" },
  modalConfirmBtn:{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY },
  modalConfirmTxt:{ color: "#fff", fontSize: 14, fontWeight: "700" },

  // Tutor sections
  pendingBanner:    { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12, padding: 12, marginBottom: 16 },
  pendingBannerTxt: { fontSize: 13, color: "#92400E", lineHeight: 19 },
  sectionTitle:     { fontSize: 15, fontWeight: "800", color: DARK, marginBottom: 10 },

  // View Schedule
  schedBtn:    { alignSelf: "flex-start", marginTop: 10, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: PRIMARY + "30", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  schedBtnTxt:  { fontSize: 12, fontWeight: "700", color: PRIMARY },
  schedPending: { marginTop: 8, fontSize: 11, fontWeight: "700", color: "#F59E0B" },

  // Confirm & Pay
  toast:      { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, marginBottom: 16 },
  toastTxt:    { flex: 1, fontSize: 13, fontWeight: "600" },
  paidBadge:   { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 20, paddingVertical: 5, borderRadius: 20, backgroundColor: "#D1FAE5" },
  paidTxt:     { fontSize: 13, fontWeight: "700", color: "#065F46" },
  payBox:      { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, marginBottom: 12 },
  payRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  payKey:      { fontSize: 12, color: MUTED, fontWeight: "600" },
  payVal:      { fontSize: 13, fontWeight: "800", color: DARK },
  payErrBox:   { backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginTop: 8 },
  payErrTxt:   { fontSize: 12, color: "#DC2626", fontWeight: "600" },
  goWalletBtn: { marginTop: 8, alignSelf: "flex-start", backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  goWalletTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

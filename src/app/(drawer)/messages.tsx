import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";
import Avatar from "../../components/Avatar";

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

export default function MessagesScreen() {
  const { user, profile } = useAuth() as any;
  const role = profile?.role || "parent";

  // ── Thread state ────────────────────────────────────────────
  const [threads,      setThreads]      = useState<any[]>([]);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [messages,     setMessages]     = useState<any[]>([]);
  const [text,         setText]         = useState("");
  const [loading,      setLoading]      = useState(true);
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [sending,      setSending]      = useState(false);

  // ── Booking state (parent only) ─────────────────────────────
  const [inquiryMap,   setInquiryMap]   = useState<Record<string, any>>({});
  const [bookings,     setBookings]     = useState<any[]>([]);
  const [students,     setStudents]     = useState<any[]>([]);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [bookModal,    setBookModal]    = useState(false);
  const [booking,      setBooking]      = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [bookForm,     setBookForm]     = useState({
    student_id: "", subject: "", session_mode: "face-to-face", payment_method: "cash",
  });

  const flatRef = useRef<FlatList>(null);

  // ── Helpers ─────────────────────────────────────────────────
  const isParent      = role === "parent";
  const isAdminThread = activeThread?.id === adminProfile?.id;
  const isInquiryThread = activeThread && !isAdminThread;
  const inquiry       = activeThread ? inquiryMap[activeThread.id] : null;

  const hasActiveBooking = isInquiryThread && bookings.some(b =>
    b.tutor_id === activeThread?.id &&
    !["cancelled", "rejected", "completed"].includes(b.status)
  );

  const showBookCancel = isParent && isInquiryThread && !hasActiveBooking && !cancelledIds.has(activeThread?.id);
  const isBooked       = inquiry?.status === "booked";

  // ── Fetch admin ─────────────────────────────────────────────
  useEffect(() => {
    supabase.from("profiles").select("id,full_name,role,avatar_url")
      .eq("role", "admin").limit(1).single()
      .then(({ data }) => { if (data) setAdminProfile(data); });
  }, []);

  // ── Fetch threads ───────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select(`sender_id, receiver_id,
        sender:sender_id(id,full_name,role,avatar_url),
        receiver:receiver_id(id,full_name,role,avatar_url)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const seen = new Set<string>();
    const users: any[] = [];
    (data || []).forEach((m: any) => {
      const other = m.sender_id === user.id ? m.receiver : m.sender;
      if (other && !seen.has(other.id) && other.id !== user.id) {
        seen.add(other.id);
        users.push(other);
      }
    });
    setThreads(users);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // ── Fetch inquiries (parent) ────────────────────────────────
  const loadInquiries = useCallback(async () => {
    if (!user || !isParent) return;
    const { data } = await supabase
      .from("inquiries")
      .select("*, tutor:tutor_id ( id, full_name, approved_rate, rate_per_session )")
      .eq("parent_id", user.id)
      .in("status", ["open", "booked"]);
    const map: Record<string, any> = {};
    (data || []).forEach((inq: any) => { map[inq.tutor_id] = inq; });
    setInquiryMap(map);
  }, [user, isParent]);

  // ── Fetch bookings (parent) ─────────────────────────────────
  const loadBookings = useCallback(async () => {
    if (!user || !isParent) return;
    const { data } = await supabase
      .from("bookings")
      .select("id, tutor_id, status")
      .eq("parent_id", user.id);
    setBookings(data || []);
  }, [user, isParent]);

  // ── Fetch students (parent) ─────────────────────────────────
  const loadStudents = useCallback(async () => {
    if (!user || !isParent) return;
    const { data } = await supabase
      .from("students")
      .select("id, name, grade_level")
      .eq("parent_id", user.id);
    setStudents(data || []);
  }, [user, isParent]);

  useEffect(() => {
    loadInquiries();
    loadBookings();
    loadStudents();
  }, [loadInquiries, loadBookings, loadStudents]);

  // ── Load messages ───────────────────────────────────────────
  const loadMessages = useCallback(async (otherId: string, initial = false) => {
    if (!user || !otherId) return;
    if (initial) setMsgLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("id, content, created_at, sender_id, sender:sender_id(id,full_name,role,avatar_url)")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    if (initial) setMsgLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }, [user]);

  const selectThread = (t: any) => {
    setActiveThread(t);
    loadMessages(t.id, true);
  };

  // Auto-select admin on load
  useEffect(() => {
    if (adminProfile && !activeThread) {
      setActiveThread(adminProfile);
      loadMessages(adminProfile.id, true);
    }
  }, [adminProfile]);

  // ── Poll messages every 5s ──────────────────────────────────
  useEffect(() => {
    if (!activeThread) return;
    const id = setInterval(() => loadMessages(activeThread.id), 5000);
    return () => clearInterval(id);
  }, [activeThread, loadMessages]);

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending || !activeThread) return;
    setSending(true);
    try {
      await supabase.from("direct_messages").insert({
        sender_id: user.id, receiver_id: activeThread.id, content,
      });
      setText("");
      await loadMessages(activeThread.id);
      await loadThreads();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Cancel inquiry ──────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      "Cancel Inquiry",
      "Cancel this inquiry? The conversation will be removed.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Inquiry", style: "destructive",
          onPress: async () => {
            if (!activeThread) return;
            setCancelling(true);
            const tutorId = activeThread.id;
            try {
              setCancelledIds(prev => new Set([...prev, tutorId]));
              setActiveThread(adminProfile);
              if (adminProfile?.id) loadMessages(adminProfile.id, true);

              await supabase.from("direct_messages").delete()
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${tutorId}),and(sender_id.eq.${tutorId},receiver_id.eq.${user.id})`);

              const inq = inquiryMap[tutorId];
              if (inq?.id) {
                await supabase.from("inquiries").update({ status: "cancelled" }).eq("id", inq.id);
              }

              await loadThreads();
              await loadInquiries();
            } catch (e: any) {
              setCancelledIds(prev => { const n = new Set(prev); n.delete(tutorId); return n; });
              Alert.alert("Error", e.message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Book Now confirm ────────────────────────────────────────
  const handleConfirmBook = async () => {
    if (!bookForm.student_id) { Alert.alert("Missing", "Please select a child."); return; }
    if (!bookForm.subject)    { Alert.alert("Missing", "Please select a subject."); return; }
    if (!activeThread) return;

    const inq  = inquiryMap[activeThread.id];
    const rate = inq?.tutor?.approved_rate || inq?.tutor?.rate_per_session || 0;
    setBooking(true);
    try {
      // Create booking
      const { error: bErr } = await supabase.from("bookings").insert({
        tutor_id:          activeThread.id,
        parent_id:         user.id,
        student_id:        bookForm.student_id,
        subject:           bookForm.subject,
        session_mode:      bookForm.session_mode,
        payment_method:    bookForm.payment_method,
        status:            "pending",
        total_amount:      rate * 8,
        commission_amount: rate * 8 * 0.10,
      });
      if (bErr) throw bErr;

      // Update inquiry to booked
      if (inq?.id) {
        await supabase.from("inquiries")
          .update({ status: "booked", student_id: bookForm.student_id })
          .eq("id", inq.id);
      }

      // Send booking message
      const subjectLabel = bookForm.subject === "both"
        ? "English & Mathematics"
        : bookForm.subject.charAt(0).toUpperCase() + bookForm.subject.slice(1);

      await supabase.from("direct_messages").insert({
        sender_id:   user.id,
        receiver_id: activeThread.id,
        content: `I've submitted a booking request for ${subjectLabel}! Please confirm the schedule. Looking forward to working with you! 📚`,
      });

      setBookModal(false);
      setBookForm({ student_id: "", subject: "", session_mode: "face-to-face", payment_method: "cash" });
      await loadMessages(activeThread.id);
      await loadInquiries();
      await loadBookings();
      Alert.alert("Booking Submitted! 🎉", "The tutor will confirm shortly.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBooking(false);
    }
  };

  const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });

  const tutorThreads = threads.filter(t => t.role !== "admin" && !cancelledIds.has(t.id));

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Messages" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Messages" />

      <View style={s.body}>

        {/* ── LEFT: Thread list ── */}
        <View style={s.threadPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Admin thread */}
            {adminProfile && (
              <>
                <Text style={s.threadSection}>Support</Text>
                <TouchableOpacity
                  style={[s.thread, activeThread?.id === adminProfile.id && s.threadActive]}
                  onPress={() => selectThread(adminProfile)}
                >
                  <Avatar name="Admin" role="admin" size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.threadName, activeThread?.id === adminProfile.id && { color: PRIMARY }]}>
                      LearnBridge Admin
                    </Text>
                    <Text style={s.threadSub}>Official support</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* Tutor threads */}
            {tutorThreads.length > 0 && (
              <Text style={s.threadSection}>Tutors</Text>
            )}
            {tutorThreads.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[s.thread, activeThread?.id === t.id && s.threadActive]}
                onPress={() => selectThread(t)}
              >
                <Avatar name={t.full_name || "T"} src={t.avatar_url} colorIndex={i + 1} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.threadName, activeThread?.id === t.id && { color: PRIMARY }]}>
                    {t.full_name}
                  </Text>
                  <Text style={s.threadSub}>
                    {inquiryMap[t.id]?.status === "booked" ? "✓ Booked" : "Inquiring"}
                  </Text>
                </View>
                {inquiryMap[t.id]?.status === "booked" && (
                  <View style={s.bookedDot} />
                )}
              </TouchableOpacity>
            ))}

            {tutorThreads.length === 0 && (
              <View style={s.noThreads}>
                <Text style={s.noThreadsTxt}>No tutor chats yet.{"\n"}Find a tutor to start.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ── RIGHT: Chat panel ── */}
        <View style={s.chatPanel}>
          {!activeThread ? (
            <View style={s.centered}>
              <Text style={{ color: MUTED }}>Select a conversation</Text>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={90}
            >
              {/* Chat header */}
              <View style={s.chatHeader}>
                <Avatar
                  name={isAdminThread ? "Admin" : activeThread.full_name}
                  src={isAdminThread ? null : activeThread.avatar_url}
                  role={isAdminThread ? "admin" : activeThread.role}
                  colorIndex={Math.max(0, tutorThreads.findIndex(t => t.id === activeThread.id)) + 1}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.chatName} numberOfLines={1}>
                    {isAdminThread ? "LearnBridge Admin" : activeThread.full_name}
                  </Text>
                  <Text style={s.chatSub}>
                    {isAdminThread
                      ? "Official support channel"
                      : hasActiveBooking ? "Booking submitted"
                      : "Inquiry"}
                  </Text>
                </View>

                {/* ── Book Now + Cancel buttons (parent + tutor thread only) ── */}
                {isParent && isInquiryThread && (
                  <View style={s.actionBtns}>
                    {!hasActiveBooking && !isBooked ? (
                      <>
                        <TouchableOpacity
                          style={s.bookNowBtn}
                          onPress={() => setBookModal(true)}
                        >
                          <Ionicons name="calendar" size={13} color="#fff" />
                          <Text style={s.bookNowTxt}>Book Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.cancelInqBtn}
                          onPress={handleCancel}
                          disabled={cancelling}
                        >
                          {cancelling
                            ? <ActivityIndicator size="small" color={CORAL} />
                            : <Text style={s.cancelInqTxt}>Cancel</Text>
                          }
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={s.bookedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                        <Text style={s.bookedBadgeTxt}>Booked</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Messages list */}
              {msgLoading ? (
                <View style={s.centered}>
                  <ActivityIndicator color={PRIMARY} />
                </View>
              ) : (
                <FlatList
                  ref={flatRef}
                  data={messages}
                  keyExtractor={m => m.id}
                  contentContainerStyle={s.msgList}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                  ListEmptyComponent={
                    <View style={s.centered}>
                      <Text style={{ color: MUTED, fontSize: 13 }}>No messages yet. Say hello! 👋</Text>
                    </View>
                  }
                  renderItem={({ item: m }) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                      <View style={[s.msgRow, isMine ? s.msgRowMe : s.msgRowOther]}>
                        {!isMine && (
                          <Avatar
                            name={m.sender?.full_name || "?"}
                            src={m.sender?.avatar_url}
                            role={m.sender?.role}
                            colorIndex={Math.max(0, tutorThreads.findIndex(t => t.id === activeThread.id)) + 1}
                            size={26}
                          />
                        )}
                        <View style={[s.bubble, isMine ? s.bubbleMe : s.bubbleOther]}>
                          <Text style={[s.bubbleTxt, isMine && { color: "#fff" }]}>{m.content}</Text>
                          <Text style={[s.bubbleTime, isMine && { color: "rgba(255,255,255,.65)" }]}>
                            {fmtTime(m.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
              )}

              {/* Input row */}
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  placeholder={isAdminThread ? "Message the admin..." : "Type a message..."}
                  placeholderTextColor={MUTED}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  multiline
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnOff]}
                  onPress={handleSend}
                  disabled={!text.trim() || sending}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={16} color={!text.trim() ? MUTED : "#fff"} />
                  }
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════
          BOOK NOW MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal visible={bookModal} transparent animationType="slide" onRequestClose={() => setBookModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                Book {activeThread?.full_name || "Tutor"}
              </Text>
              <TouchableOpacity onPress={() => setBookModal(false)}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Info banner */}
              <View style={s.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
                <Text style={s.infoBannerTxt}>
                  This sends a booking request to the tutor. They will confirm the details with you.
                </Text>
              </View>

              {/* Subject */}
              <Text style={s.label}>
                Subject to Tutor <Text style={{ color: CORAL }}>*</Text>
              </Text>
              <View style={s.optGrid}>
                {[
                  { v: "english",     l: "📖 English",               color: "#1D4ED8", bg: "#EFF6FF" },
                  { v: "mathematics", l: "🔢 Mathematics",            color: TEAL,      bg: TEAL_BG   },
                  { v: "both",        l: "📚 Both (English & Math)",  color: PRIMARY,   bg: PRIMARY_BG },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[s.optBtn, bookForm.subject === opt.v && { borderColor: opt.color, backgroundColor: opt.bg }]}
                    onPress={() => setBookForm(f => ({ ...f, subject: opt.v }))}
                  >
                    <Text style={[s.optTxt, bookForm.subject === opt.v && { color: opt.color, fontWeight: "700" }]}>
                      {opt.l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Child */}
              <Text style={s.label}>
                Select Child <Text style={{ color: CORAL }}>*</Text>
              </Text>
              {students.length === 0 ? (
                <View style={s.infoBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={ORANGE} />
                  <Text style={[s.infoBannerTxt, { color: ORANGE }]}>
                    No children found. Add a child profile first.
                  </Text>
                </View>
              ) : (
                <View style={s.childGrid}>
                  {students.map(st => (
                    <TouchableOpacity
                      key={st.id}
                      style={[s.childBtn, bookForm.student_id === st.id && s.childBtnActive]}
                      onPress={() => setBookForm(f => ({ ...f, student_id: st.id }))}
                    >
                      <Text style={[s.childBtnTxt, bookForm.student_id === st.id && { color: PRIMARY, fontWeight: "700" }]}>
                        {st.name} · Grade {st.grade_level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Session mode */}
              <Text style={s.label}>Session Mode</Text>
              <View style={s.optRow}>
                {[{ v: "face-to-face", l: "Face-to-Face" }, { v: "online", l: "Online" }].map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[s.optBtn, s.optBtnHalf, bookForm.session_mode === opt.v && s.optBtnActive]}
                    onPress={() => setBookForm(f => ({ ...f, session_mode: opt.v }))}
                  >
                    <Text style={[s.optTxt, bookForm.session_mode === opt.v && s.optTxtActive]}>{opt.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Payment method */}
              <Text style={s.label}>Payment Method</Text>
              <View style={s.optRow}>
                {[{ v: "cash", l: "Cash" }, { v: "gcash", l: "GCash" }, { v: "bank_transfer", l: "Bank Transfer" }].map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[s.optBtn, s.optBtnThird, bookForm.payment_method === opt.v && s.optBtnActive]}
                    onPress={() => setBookForm(f => ({ ...f, payment_method: opt.v }))}
                  >
                    <Text style={[s.optTxt, bookForm.payment_method === opt.v && s.optTxtActive]}>{opt.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Modal footer */}
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setBookModal(false)}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, (booking || !bookForm.student_id || !bookForm.subject) && s.modalConfirmBtnOff]}
                onPress={handleConfirmBook}
                disabled={booking || !bookForm.student_id || !bookForm.subject}
              >
                {booking
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={s.modalConfirmTxt}>Confirm Booking</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "transparent" },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  body:       { flex: 1, flexDirection: "row" },

  // Thread panel
  threadPanel:   { width: 110, borderRightWidth: 1, borderRightColor: BORDER, backgroundColor: "#fff" },
  threadSection: { fontSize: 9, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4 },
  thread:        { padding: 10, alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER, gap: 4 },
  threadActive:  { backgroundColor: PRIMARY_BG },
  threadAvatar:  { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  threadAvatarTxt:{ color: "#fff", fontWeight: "800", fontSize: 15 },
  threadName:    { fontSize: 11, fontWeight: "600", color: DARK, textAlign: "center" },
  threadSub:     { fontSize: 9, color: MUTED, textAlign: "center" },
  bookedDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, position: "absolute", top: 8, right: 8 },
  noThreads:     { padding: 16, alignItems: "center" },
  noThreadsTxt:  { fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 16 },

  // Chat panel
  chatPanel:  { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: "#fff", gap: 8 },
  chatName:   { fontSize: 14, fontWeight: "700", color: DARK },
  chatSub:    { fontSize: 11, color: MUTED, marginTop: 1 },

  // Action buttons in chat header
  actionBtns:    { flexDirection: "column", gap: 5, alignItems: "flex-end" },
  bookNowBtn:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bookNowTxt:    { color: "#fff", fontSize: 11, fontWeight: "700" },
  cancelInqBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: CORAL, backgroundColor: CORAL_BG },
  cancelInqTxt:  { color: CORAL, fontSize: 11, fontWeight: "700" },
  bookedBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GREEN_BG, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bookedBadgeTxt:{ color: GREEN, fontSize: 11, fontWeight: "700" },

  // Messages
  msgList:    { padding: 14, gap: 8 },
  msgRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 6 },
  msgRowMe:   { justifyContent: "flex-end" },
  msgRowOther:{ justifyContent: "flex-start" },
  msgAvatar:  { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  msgAvatarTxt:{ color: "#fff", fontSize: 11, fontWeight: "700" },
  bubble:     { maxWidth: "72%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe:   { backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  bubbleOther:{ backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER },
  bubbleTxt:  { fontSize: 13, color: DARK, lineHeight: 18 },
  bubbleTime: { fontSize: 10, color: MUTED, marginTop: 3, textAlign: "right" },

  // Input
  inputRow:   { flexDirection: "row", alignItems: "center", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: "#fff" },
  input:      { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, borderColor: BORDER, fontSize: 13, color: DARK, backgroundColor: BG, maxHeight: 80 },
  sendBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  sendBtnOff: { backgroundColor: "#E5E7EB" },

  // Book Now Modal
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:      { fontSize: 17, fontWeight: "800", color: DARK },
  infoBanner:      { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: PRIMARY_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoBannerTxt:   { flex: 1, fontSize: 12, color: PRIMARY, lineHeight: 17 },
  label:           { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 8 },
  optGrid:         { gap: 8, marginBottom: 16 },
  optRow:          { flexDirection: "row", gap: 8, marginBottom: 16 },
  optBtn:          { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB" },
  optBtnHalf:      { flex: 1 },
  optBtnThird:     { flex: 1 },
  optBtnActive:    { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  optTxt:          { fontSize: 13, color: MUTED, fontWeight: "500", textAlign: "center" },
  optTxtActive:    { color: PRIMARY, fontWeight: "700" },
  childGrid:       { gap: 8, marginBottom: 16 },
  childBtn:        { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB" },
  childBtnActive:  { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  childBtnTxt:     { fontSize: 13, color: MUTED, fontWeight: "500" },
  modalFooter:     { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  modalCancelTxt:  { fontSize: 14, color: MUTED, fontWeight: "600" },
  modalConfirmBtn: { flex: 2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: PRIMARY },
  modalConfirmBtnOff:{ backgroundColor: "#D1D5DB" },
  modalConfirmTxt: { fontSize: 14, color: "#fff", fontWeight: "700" },
});
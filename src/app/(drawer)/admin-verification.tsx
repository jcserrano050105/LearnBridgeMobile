import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
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
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const GREEN      = "#10B981";
const GREEN_BG   = "#D1FAE5";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: ORANGE, bg: ORANGE_BG },
  approved: { label: "Approved", color: GREEN,  bg: GREEN_BG  },
  rejected: { label: "Rejected", color: CORAL,  bg: CORAL_BG  },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminVerificationScreen() {
  const { user } = useAuth() as any;

  const [tutors,   setTutors]   = useState<any[]>([]);
  const [filter,   setFilter]   = useState("pending");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [rate,     setRate]     = useState("");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const fetchTutors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tutors")
        .select(`
          id, status, rate_per_session, approved_rate, years_experience,
          specialization, certification_scores, admin_notes, created_at,
          nbi_clearance_url, prc_license_url, medical_cert_url,
          profile:id ( full_name, email, gender, location, bio, avatar_url )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTutors(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTutors(); }, [fetchTutors]);

  const openReview = (t: any) => {
    setSelected(t);
    setRate(String(t.approved_rate || t.rate_per_session || ""));
    setNotes(t.admin_notes || "");
  };

  const handleApprove = async () => {
    if (!rate) { Alert.alert("Required", "Please enter an approved session rate."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("tutors").update({
        status:        "approved",
        approved_rate: Number(rate),
        admin_notes:   notes || null,
      }).eq("id", selected.id);
      if (error) throw error;
      setSelected(null);
      await fetchTutors();
      Alert.alert("✅ Approved!", `${selected.profile?.full_name} has been approved as a tutor.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      "Reject Application",
      `Reject ${selected.profile?.full_name}'s application?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject", style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase.from("tutors").update({
                status:      "rejected",
                admin_notes: notes || null,
              }).eq("id", selected.id);
              if (error) throw error;
              setSelected(null);
              await fetchTutors();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const counts = {
    all:      tutors.length,
    pending:  tutors.filter(t => t.status === "pending").length,
    approved: tutors.filter(t => t.status === "approved").length,
    rejected: tutors.filter(t => t.status === "rejected").length,
  };

  const filtered = filter === "all" ? tutors : tutors.filter(t => t.status === filter);

  if (loading) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Verification" />
        <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Tutor Verification" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTutors} tintColor={PRIMARY} />}
      >
        <Text style={s.heading}>Tutor Verification</Text>
        <Text style={s.sub}>Review submitted credentials and approve or reject tutor applications.</Text>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={s.filterRow}>
            {(["all", "pending", "approved", "rejected"] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.filterBtn, filter === f && s.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
            <Text style={s.emptyTitle}>No {filter === "all" ? "" : filter} applications</Text>
            <Text style={s.emptyTxt}>Tutor applications will appear here.</Text>
          </View>
        ) : (
          filtered.map((t, i) => {
            const sc = STATUS_CFG[t.status] || STATUS_CFG.pending;
            return (
              <View key={t.id} style={s.card}>
                <View style={s.cardTop}>
                  <Avatar name={t.profile?.full_name || "T"} src={t.profile?.avatar_url} colorIndex={i} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{t.profile?.full_name || "Tutor"}</Text>
                    <Text style={s.cardEmail}>{t.profile?.email || "—"}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.badgeTxt, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                <View style={s.infoGrid}>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Specialization</Text>
                    <Text style={s.infoVal}>{(t.specialization || []).join(", ") || "—"}</Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Experience</Text>
                    <Text style={s.infoVal}>{t.years_experience ? `${t.years_experience} yr(s)` : "—"}</Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Proposed Rate</Text>
                    <Text style={s.infoVal}>{t.rate_per_session ? `₱${t.rate_per_session}` : "—"}</Text>
                  </View>
                  <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Applied</Text>
                    <Text style={s.infoVal}>{fmtDate(t.created_at)}</Text>
                  </View>
                </View>

                {/* Docs */}
                <View style={s.docsRow}>
                  {[
                    { label: "NBI", has: !!t.nbi_clearance_url },
                    { label: "PRC", has: !!t.prc_license_url   },
                    { label: "Med", has: !!t.medical_cert_url  },
                  ].map(d => (
                    <View key={d.label} style={[s.docChip, { backgroundColor: d.has ? GREEN_BG : CORAL_BG }]}>
                      <Ionicons name={d.has ? "checkmark-circle" : "close-circle"} size={12} color={d.has ? GREEN : CORAL} />
                      <Text style={[s.docChipTxt, { color: d.has ? GREEN : CORAL }]}>{d.label}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={s.reviewBtn} onPress={() => openReview(t)}>
                  <Ionicons name="eye-outline" size={14} color={PRIMARY} />
                  <Text style={s.reviewBtnTxt}>{t.status === "pending" ? "Review" : "View Details"}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Review Modal ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {selected?.status === "pending" ? "Review Application" : "Tutor Details"}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Info grid */}
                <View style={s.detailGrid}>
                  {([
                    ["Full Name",       selected.profile?.full_name || "—"],
                    ["Email",           selected.profile?.email     || "—"],
                    ["Gender",          selected.profile?.gender    || "—"],
                    ["Location",        selected.profile?.location  || "—"],
                    ["Experience",      selected.years_experience != null ? `${selected.years_experience} yr(s)` : "—"],
                    ["Specialization",  (selected.specialization || []).join(", ") || "—"],
                    ["Proposed Rate",   selected.rate_per_session ? `₱${selected.rate_per_session}` : "—"],
                    ["Applied",         fmtDate(selected.created_at)],
                  ] as [string, string][]).map(([k, v]) => (
                    <View key={k} style={s.detailCell}>
                      <Text style={s.detailKey}>{k}</Text>
                      <Text style={s.detailVal}>{v}</Text>
                    </View>
                  ))}
                </View>

                {/* Bio */}
                {selected.profile?.bio && (
                  <View style={s.bioBox}>
                    <Text style={s.bioLabel}>Bio</Text>
                    <Text style={s.bioTxt}>{selected.profile.bio}</Text>
                  </View>
                )}

                {/* Documents */}
                <Text style={s.sectionLabel}>Documents</Text>
                {[
                  { label: "NBI Clearance",    has: !!selected.nbi_clearance_url },
                  { label: "PRC License",       has: !!selected.prc_license_url   },
                  { label: "Medical Certificate",has: !!selected.medical_cert_url },
                ].map(d => (
                  <View key={d.label} style={s.docRow}>
                    <View style={[s.docIcon, { backgroundColor: d.has ? GREEN_BG : CORAL_BG }]}>
                      <Ionicons name={d.has ? "checkmark" : "close"} size={14} color={d.has ? GREEN : CORAL} />
                    </View>
                    <Text style={s.docLabel}>{d.label}</Text>
                    <Text style={[s.docStatus, { color: d.has ? GREEN : CORAL }]}>{d.has ? "Submitted" : "Missing"}</Text>
                  </View>
                ))}

                {/* Certification scores */}
                {selected.certification_scores && Object.keys(selected.certification_scores).length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { marginTop: 16 }]}>Certification Scores</Text>
                    <View style={s.scoresRow}>
                      {Object.entries(selected.certification_scores).map(([subj, data]: [string, any]) => (
                        <View key={subj} style={[s.scorePill, { backgroundColor: (data?.score || data) >= 75 ? GREEN_BG : ORANGE_BG }]}>
                          <Text style={[s.scorePillTxt, { color: (data?.score || data) >= 75 ? GREEN : ORANGE }]}>
                            {subj}: {data?.score || data}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Pending actions */}
                {selected.status === "pending" && (
                  <>
                    <View style={s.warningBox}>
                      <Ionicons name="warning-outline" size={16} color={ORANGE} />
                      <Text style={s.warningTxt}>Review all documents carefully before approving.</Text>
                    </View>

                    <Text style={s.fieldLabel}>Approved Session Rate (₱) *</Text>
                    <TextInput
                      style={s.input}
                      placeholder="e.g. 350"
                      placeholderTextColor={MUTED}
                      keyboardType="numeric"
                      value={rate}
                      onChangeText={setRate}
                    />

                    <Text style={s.fieldLabel}>Admin Notes (optional)</Text>
                    <TextInput
                      style={[s.input, { height: 80, textAlignVertical: "top" }]}
                      placeholder="Feedback or reasons for approval/rejection..."
                      placeholderTextColor={MUTED}
                      multiline
                      value={notes}
                      onChangeText={setNotes}
                    />

                    <View style={s.modalFooter}>
                      <TouchableOpacity
                        style={[s.rejectBtn, saving && { opacity: 0.5 }]}
                        onPress={handleReject}
                        disabled={saving}
                      >
                        {saving ? <ActivityIndicator size="small" color={CORAL} /> : <><Ionicons name="close" size={14} color={CORAL} /><Text style={s.rejectBtnTxt}>Reject</Text></>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.approveBtn, saving && { opacity: 0.5 }]}
                        onPress={handleApprove}
                        disabled={saving}
                      >
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark" size={14} color="#fff" /><Text style={s.approveBtnTxt}>Approve</Text></>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selected.status !== "pending" && (
                  <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                    <Text style={s.closeBtnTxt}>Close</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BG },
  content:    { padding: 16, paddingBottom: 80 },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center" },
  heading:    { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:        { fontSize: 13, color: MUTED, marginBottom: 16 },
  filterRow:  { flexDirection: "row", gap: 8 },
  filterBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: CARD },
  filterBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  filterTxt:  { fontSize: 12, color: MUTED, fontWeight: "600" },
  filterTxtActive: { color: PRIMARY },
  empty:      { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 6 },
  emptyTxt:   { fontSize: 13, color: MUTED },
  card:       { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 14, padding: 16 },
  cardTop:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatarCircle:{ width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY_BG, justifyContent: "center", alignItems: "center" },
  avatarTxt:  { fontSize: 18, fontWeight: "800", color: PRIMARY },
  cardName:   { fontSize: 15, fontWeight: "700", color: DARK },
  cardEmail:  { fontSize: 12, color: MUTED, marginTop: 2 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt:   { fontSize: 11, fontWeight: "700" },
  infoGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  infoCell:   { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 8, padding: 10 },
  infoLabel:  { fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4, marginBottom: 3 },
  infoVal:    { fontSize: 13, fontWeight: "600", color: DARK },
  docsRow:    { flexDirection: "row", gap: 8, marginBottom: 12 },
  docChip:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  docChipTxt: { fontSize: 11, fontWeight: "700" },
  reviewBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  reviewBtnTxt:{ fontSize: 13, fontWeight: "700", color: PRIMARY },
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:   { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "92%" },
  modalHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: DARK },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  detailCell: { width: "47%", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12 },
  detailKey:  { fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  detailVal:  { fontSize: 13, fontWeight: "700", color: DARK },
  bioBox:     { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 16 },
  bioLabel:   { fontSize: 11, color: MUTED, fontWeight: "700", marginBottom: 4 },
  bioTxt:     { fontSize: 13, color: DARK, lineHeight: 18 },
  sectionLabel:{ fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 10 },
  docRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  docIcon:    { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  docLabel:   { flex: 1, fontSize: 13, color: DARK, fontWeight: "500" },
  docStatus:  { fontSize: 12, fontWeight: "700" },
  scoresRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  scorePill:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scorePillTxt:{ fontSize: 12, fontWeight: "700" },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: ORANGE_BG, borderRadius: 10, padding: 12, marginBottom: 16, marginTop: 8 },
  warningTxt: { flex: 1, fontSize: 12, color: "#92400E" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 6 },
  input:      { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 14 },
  modalFooter:{ flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 8 },
  rejectBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: CORAL_BG, borderWidth: 1, borderColor: CORAL },
  rejectBtnTxt:{ fontSize: 14, fontWeight: "700", color: CORAL },
  approveBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN },
  approveBtnTxt:{ fontSize: 14, fontWeight: "700", color: "#fff" },
  closeBtn:   { paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", marginTop: 8, marginBottom: 8 },
  closeBtnTxt:{ color: "#fff", fontWeight: "700", fontSize: 14 },
});
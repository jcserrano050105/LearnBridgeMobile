import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PickedDoc, pickPDF, validatePDF } from "../lib/pdf";
import { useAuth } from "../context/AuthContext";
import PasswordStrength, { PasswordMatch, PASSWORD_MIN_LENGTH } from "../components/PasswordStrength";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CORAL      = "#EF4444";
const GREEN      = "#10B981";
const BG         = "#F8FAFC";

const SPECIALIZATIONS = ["English", "Mathematics"];

// ── Required documents — same 4 PDFs and rules as the website's RegisterPage ──
type DocKey = "nbi" | "prc" | "medical" | "applicationForm";

const DOCS: { key: DocKey; label: string; icon: string; hint: string }[] = [
  { key: "nbi",             label: "NBI Clearance",       icon: "🪪", hint: "Valid within last 6 months"         },
  { key: "prc",             label: "PRC License",         icon: "📄", hint: "Professional Regulation Commission" },
  { key: "medical",         label: "Medical Certificate", icon: "🏥", hint: "Issued by licensed physician"       },
  { key: "applicationForm", label: "Application Form",    icon: "📋", hint: "Your completed application form"   },
];

export default function RegisterTutorPage() {
  const { signUp } = useAuth() as any;
  const router     = useRouter();

  const [form, setForm] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    location: "", gender: "", bio: "",
    yearsExperience: "", ratePerSession: "",
    specialization: [] as string[],
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const [docs,      setDocs]      = useState<Record<DocKey, PickedDoc | null>>({ nbi: null, prc: null, medical: null, applicationForm: null });
  const [docErrors, setDocErrors] = useState<Record<DocKey, string>>({ nbi: "", prc: "", medical: "", applicationForm: "" });
  const uploadedCount = Object.values(docs).filter(Boolean).length;

  const pickDoc = async (key: DocKey) => {
    const file = await pickPDF();
    if (!file) return;
    const err = validatePDF(file);
    setDocErrors(prev => ({ ...prev, [key]: err || "" }));
    setDocs(prev => ({ ...prev, [key]: err ? null : file }));
  };

  const toggleSpec = (s: string) => {
    set("specialization",
      form.specialization.includes(s)
        ? form.specialization.filter(x => x !== s)
        : [...form.specialization, s]
    );
  };

  const handleRegister = async () => {
    if (!form.fullName.trim())           { setError("Full name is required."); return; }
    if (!form.email.trim())              { setError("Email is required."); return; }
    if (form.password.length < PASSWORD_MIN_LENGTH) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.specialization.length === 0){ setError("Select at least one specialization."); return; }

    // All 4 PDFs are required (website: "Please upload all 4 required PDF documents.")
    const errs: Record<DocKey, string> = {
      nbi:             validatePDF(docs.nbi)             || "",
      prc:             validatePDF(docs.prc)             || "",
      medical:         validatePDF(docs.medical)         || "",
      applicationForm: validatePDF(docs.applicationForm) || "",
    };
    setDocErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      setError("Please upload all 4 required PDF documents.");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setError("");
    setAccountExists(false);
    setLoading(true);
    try {
      await signUp({
        email:           form.email.trim(),
        password:        form.password,
        fullName:        form.fullName.trim(),
        role:            "tutor",
        location:        form.location        || null,
        gender:          form.gender          || null,
        bio:             form.bio             || null,
        yearsExperience: Number(form.yearsExperience) || 0,
        ratePerSession:  Number(form.ratePerSession)  || 0,
        specialization:  form.specialization,
        nbiFile:             docs.nbi,
        prcFile:             docs.prc,
        medicalFile:         docs.medical,
        applicationFormFile: docs.applicationForm,
      });
      Alert.alert(
        "Application Submitted! 🎓",
        "Your tutor account is pending admin approval. You will be notified once reviewed (1–3 business days).",
        [{ text: "OK", onPress: () => router.replace("/login" as any) }]
      );
    } catch (e: any) {
      setAccountExists(e.code === "account_exists");
      setError(e.message || "Registration failed. Please try again.");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={DARK} />
          <Text style={s.backTxt}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={s.headerBox}>
          <Text style={s.emoji}>👩‍🏫</Text>
          <Text style={s.heading}>Create Tutor Account</Text>
          <Text style={s.subheading}>Join LearnBridge as a verified tutor for Grade 2–6 learners.</Text>
        </View>

        {/* Pending notice */}
        <View style={s.noticeBanner}>
          <Ionicons name="information-circle-outline" size={16} color={ORANGE} />
          <Text style={s.noticeTxt}>
            Tutor accounts require admin approval. After submitting, your application will be reviewed within 1–3 business days.
          </Text>
        </View>

        {/* Error */}
        {error !== "" && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={CORAL} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}
        {accountExists && (
          <TouchableOpacity style={s.signInBtn} onPress={() => router.replace("/login" as any)}>
            <Text style={s.signInBtnTxt}>Go to Sign In</Text>
          </TouchableOpacity>
        )}

        {/* ── Personal Info ── */}
        <Text style={s.sectionTitle}>Personal Information</Text>

        <Text style={s.label}>Full Name *</Text>
        <TextInput style={s.input} placeholder="e.g. Juan dela Cruz" placeholderTextColor={MUTED}
          value={form.fullName} onChangeText={v => set("fullName", v)} />

        <Text style={s.label}>Email Address *</Text>
        <TextInput style={s.input} placeholder="you@email.com" placeholderTextColor={MUTED}
          keyboardType="email-address" autoCapitalize="none"
          value={form.email} onChangeText={v => set("email", v)} />

        <Text style={s.label}>Location</Text>
        <TextInput style={s.input} placeholder="e.g. Quezon City" placeholderTextColor={MUTED}
          value={form.location} onChangeText={v => set("location", v)} />

        <Text style={s.label}>Gender</Text>
        <View style={s.genderRow}>
          {["Male", "Female", "Other"].map(g => (
            <TouchableOpacity
              key={g}
              style={[s.genderBtn, form.gender === g && s.genderBtnActive]}
              onPress={() => set("gender", g)}
            >
              <Text style={[s.genderTxt, form.gender === g && { color: PRIMARY, fontWeight: "700" }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Short Bio</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]}
          placeholder="Tell parents about your teaching style and experience..."
          placeholderTextColor={MUTED} multiline
          value={form.bio} onChangeText={v => set("bio", v)} />

        {/* ── Professional Info ── */}
        <Text style={s.sectionTitle}>Professional Information</Text>

        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Years of Experience</Text>
            <TextInput style={s.input} placeholder="e.g. 3" placeholderTextColor={MUTED}
              keyboardType="numeric" value={form.yearsExperience}
              onChangeText={v => set("yearsExperience", v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Proposed Rate (₱/session)</Text>
            <TextInput style={s.input} placeholder="e.g. 350" placeholderTextColor={MUTED}
              keyboardType="numeric" value={form.ratePerSession}
              onChangeText={v => set("ratePerSession", v)} />
          </View>
        </View>

        <Text style={s.label}>Specialization *</Text>
        <Text style={s.hint}>Select subjects you want to teach.</Text>
        <View style={s.specRow}>
          {SPECIALIZATIONS.map(sp => (
            <TouchableOpacity
              key={sp}
              style={[s.specBtn, form.specialization.includes(sp) && s.specBtnActive]}
              onPress={() => toggleSpec(sp)}
            >
              <Text style={[s.specTxt, form.specialization.includes(sp) && { color: PRIMARY, fontWeight: "700" }]}>
                {sp === "English" ? "📖 English" : "🔢 Mathematics"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Password ── */}
        <Text style={s.sectionTitle}>Account Security</Text>

        <Text style={s.label}>Password *</Text>
        <View style={s.passRow}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Min. 8 characters" placeholderTextColor={MUTED}
            secureTextEntry={!showPass} value={form.password}
            onChangeText={v => set("password", v)} />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
            <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <PasswordStrength password={form.password} />

        <Text style={[s.label, { marginTop: 8 }]}>Confirm Password *</Text>
        <TextInput style={s.input} placeholder="Repeat password" placeholderTextColor={MUTED}
          secureTextEntry value={form.confirmPassword}
          onChangeText={v => set("confirmPassword", v)} />
        <PasswordMatch password={form.password} confirm={form.confirmPassword} />

        {/* ── Documents (same 4 PDFs as the website) ── */}
        <Text style={s.sectionTitle}>📁 Upload Documents</Text>
        <Text style={s.docIntro}>All 4 documents are required. PDF only, max 20MB each.</Text>
        <View style={s.docWarn}>
          <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
          <Text style={s.docWarnTxt}>
            <Text style={{ fontWeight: "800" }}>PDF files only.</Text> Each must not exceed <Text style={{ fontWeight: "800" }}>20MB</Text>.
          </Text>
        </View>

        {DOCS.map(doc => {
          const file = docs[doc.key];
          const err  = docErrors[doc.key];
          return (
            <View key={doc.key} style={[s.docCard, file ? s.docCardOk : err ? s.docCardErr : null]}>
              <Text style={{ fontSize: 22 }}>{doc.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.docLabel}>{doc.label} <Text style={{ color: "#DC2626" }}>*</Text></Text>
                <Text style={s.docHint}>{doc.hint} · PDF only, max 20MB</Text>
                {file && (
                  <Text style={s.docFile} numberOfLines={1}>
                    ✓ {file.name} ({((file.size || 0) / 1024 / 1024).toFixed(1)}MB)
                  </Text>
                )}
                {!!err && <Text style={s.docErr}>⚠ {err}</Text>}
              </View>
              <TouchableOpacity
                style={[s.docBtn, file && s.docBtnOk]}
                onPress={() => pickDoc(doc.key)}
                disabled={loading}
              >
                <Text style={[s.docBtnTxt, file && { color: "#065F46" }]}>
                  {file ? "✓ Uploaded" : "⬆ Upload PDF"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={s.progressHead}>
          <Text style={s.progressLbl}>Documents uploaded</Text>
          <Text style={s.progressCount}>{uploadedCount} / 4</Text>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(uploadedCount / 4) * 100}%` }]} />
        </View>

        {/* Register button */}
        <TouchableOpacity
          style={[s.button, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.buttonTxt}>Submit Application</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.loginLink} onPress={() => router.replace("/login" as any)}>
          <Text style={s.loginLinkTxt}>Already have an account? <Text style={{ color: PRIMARY, fontWeight: "700" }}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  scroll:         { padding: 24, paddingTop: 56, paddingBottom: 60 },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
  backTxt:        { fontSize: 15, fontWeight: "600", color: DARK },
  headerBox:      { alignItems: "center", marginBottom: 20 },
  emoji:          { fontSize: 48, marginBottom: 10 },
  heading:        { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6, textAlign: "center" },
  subheading:     { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 },
  noticeBanner:   { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: ORANGE_BG, borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: "#FCD34D" },
  noticeTxt:      { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17 },
  errorBox:       { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:       { flex: 1, color: CORAL, fontSize: 13, fontWeight: "600" },
  signInBtn:      { backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: -6, marginBottom: 16 },
  signInBtnTxt:   { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionTitle:   { fontSize: 15, fontWeight: "800", color: DARK, marginBottom: 14, marginTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  label:          { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 6 },
  hint:           { fontSize: 11, color: MUTED, marginBottom: 8, marginTop: -4 },
  input:          { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#fff", marginBottom: 14 },
  twoCol:         { flexDirection: "row", gap: 12 },
  passRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  eyeBtn:         { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  genderRow:      { flexDirection: "row", gap: 10, marginBottom: 14 },
  genderBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", alignItems: "center" },
  genderBtnActive:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  genderTxt:      { fontSize: 13, color: MUTED, fontWeight: "500" },
  specRow:        { flexDirection: "row", gap: 10, marginBottom: 14 },
  specBtn:        { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", alignItems: "center" },
  specBtnActive:  { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  specTxt:        { fontSize: 14, color: MUTED, fontWeight: "500" },
  strengthBox:    { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8, gap: 6 },
  strengthRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  strengthTxt:    { fontSize: 12, color: MUTED },
  docIntro:       { fontSize: 12, color: MUTED, marginBottom: 10 },
  docWarn:        { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 10, marginBottom: 14 },
  docWarnTxt:     { flex: 1, fontSize: 12, color: "#92400E" },
  docCard:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: "#FAFAFA" },
  docCardOk:      { borderColor: GREEN, backgroundColor: "#F0FDF4" },
  docCardErr:     { borderColor: "#FCA5A5" },
  docLabel:       { fontSize: 13, fontWeight: "600", color: DARK },
  docHint:        { fontSize: 11, color: MUTED, marginTop: 1 },
  docFile:        { fontSize: 11, color: "#16A34A", fontWeight: "600", marginTop: 4 },
  docErr:         { fontSize: 11, color: "#DC2626", marginTop: 4 },
  docBtn:         { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY_BG, borderWidth: 1, borderColor: PRIMARY + "40" },
  docBtnOk:       { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" },
  docBtnTxt:      { fontSize: 11, fontWeight: "700", color: PRIMARY },
  progressHead:   { flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginBottom: 4 },
  progressLbl:    { fontSize: 11, color: MUTED },
  progressCount:  { fontSize: 11, fontWeight: "600", color: DARK },
  progressTrack:  { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: "hidden", marginBottom: 20 },
  progressFill:   { height: "100%", borderRadius: 3, backgroundColor: GREEN },
  button:         { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center" },
  buttonTxt:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginLink:      { alignItems: "center", marginTop: 16 },
  loginLinkTxt:   { fontSize: 13, color: MUTED },
});

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

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

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleSpec = (s: string) => {
    set("specialization",
      form.specialization.includes(s)
        ? form.specialization.filter(x => x !== s)
        : [...form.specialization, s]
    );
  };

  // Password strength
  const pwLen    = form.password.length >= 8;
  const pwUpper  = /[A-Z]/.test(form.password);
  const pwNumber = /[0-9]/.test(form.password);
  const pwStrong = pwLen && pwUpper && pwNumber;

  const handleRegister = async () => {
    if (!form.fullName.trim())           { setError("Full name is required."); return; }
    if (!form.email.trim())              { setError("Email is required."); return; }
    if (!pwStrong)                       { setError("Password must be 8+ chars with uppercase and number."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.specialization.length === 0){ setError("Select at least one specialization."); return; }

    setError("");
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
        // No document files on mobile — admin will verify separately
        nbiFile:     null,
        prcFile:     null,
        medicalFile: null,
      });
      Alert.alert(
        "Application Submitted! 🎓",
        "Your tutor account is pending admin approval. You will be notified once reviewed (1–3 business days).",
        [{ text: "OK", onPress: () => router.replace("/login" as any) }]
      );
    } catch (e: any) {
      setError(e.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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
            placeholder="Min 8 chars" placeholderTextColor={MUTED}
            secureTextEntry={!showPass} value={form.password}
            onChangeText={v => set("password", v)} />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
            <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {form.password.length > 0 && (
          <View style={s.strengthBox}>
            {[
              { ok: pwLen,    label: "At least 8 characters" },
              { ok: pwUpper,  label: "One uppercase letter"  },
              { ok: pwNumber, label: "One number"            },
            ].map(r => (
              <View key={r.label} style={s.strengthRow}>
                <Ionicons name={r.ok ? "checkmark-circle" : "ellipse-outline"} size={14} color={r.ok ? GREEN : MUTED} />
                <Text style={[s.strengthTxt, r.ok && { color: GREEN }]}>{r.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[s.label, { marginTop: 8 }]}>Confirm Password *</Text>
        <TextInput style={s.input} placeholder="Re-enter password" placeholderTextColor={MUTED}
          secureTextEntry value={form.confirmPassword}
          onChangeText={v => set("confirmPassword", v)} />

        {/* Document notice */}
        <View style={s.docNotice}>
          <Ionicons name="document-text-outline" size={18} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={s.docNoticeTitle}>Document Submission</Text>
            <Text style={s.docNoticeTxt}>
              NBI Clearance, PRC License, and Medical Certificate are required for approval. Please submit them to the admin team directly after registration.
            </Text>
          </View>
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
  docNotice:      { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: PRIMARY_BG, borderRadius: 12, padding: 14, marginBottom: 20, marginTop: 8 },
  docNoticeTitle: { fontSize: 13, fontWeight: "700", color: PRIMARY, marginBottom: 4 },
  docNoticeTxt:   { fontSize: 12, color: "#1e40af", lineHeight: 17 },
  button:         { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center" },
  buttonTxt:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginLink:      { alignItems: "center", marginTop: 16 },
  loginLinkTxt:   { fontSize: 13, color: MUTED },
});

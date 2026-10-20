import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import PasswordStrength, { PasswordMatch, PASSWORD_MIN_LENGTH } from "../components/PasswordStrength";
import { PickedDoc, pickPDF, validatePDF } from "../lib/pdf";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CORAL      = "#EF4444";
const GREEN      = "#10B981";
const BG         = "#F8FAFC";

export default function RegisterParentPage() {
  const { signUp, signOut } = useAuth() as any;
  const router     = useRouter();

  const [form, setForm] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    location: "", gender: "",
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const [validId1,    setValidId1]    = useState<PickedDoc | null>(null);
  const [validId2,    setValidId2]    = useState<PickedDoc | null>(null);
  const [showMoreIds, setShowMoreIds] = useState(false);
  const [done,        setDone]        = useState(false);

  const pickId = async (key: "id1" | "id2") => {
    const file = await pickPDF();
    if (!file) return;
    const err = validatePDF(file);
    if (err) {
      setError(err === "File must be under 20MB." ? "File too large. Maximum size is 20MB." : "Please upload a PDF file only.");
      return;
    }
    setError("");
    (key === "id1" ? setValidId1 : setValidId2)(file);
  };

  if (done) {
    return (
      <View style={[s.container, { justifyContent: "center", padding: 24 }]}>
        <View style={s.doneCard}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
          <Text style={s.doneTitle}>Account Created!</Text>
          <Text style={s.doneTxt}>
            📧 Please check your email and click the confirmation link before signing in.
          </Text>
          <Text style={s.doneTxt}>
            ⏳ Your submitted ID will be reviewed by the admin team (1–3 business days). You can sign in meanwhile, but booking tutors and wallet top-up unlock once you're approved.
          </Text>
          <TouchableOpacity style={[s.button, { alignSelf: "stretch" }]} onPress={() => router.replace("/login" as any)}>
            <Text style={s.buttonTxt}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleRegister = async () => {
    if (!form.fullName.trim())        { setError("Full name is required."); return; }
    if (!form.email.trim())           { setError("Email is required."); return; }
    if (form.password.length < PASSWORD_MIN_LENGTH) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (!validId1) {
      setError("Please upload at least one valid government ID (PDF only, max 20MB).");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setError("");
    setAccountExists(false);
    setLoading(true);
    try {
      await signUp({
        email:    form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role:     "parent",
        location: form.location || null,
        gender:   form.gender   || null,
        validId1File: validId1,
        validId2File: validId2,
      });
      // Same as the website: sign out and send the parent to sign in
      await signOut();
      setDone(true);
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
          <Text style={s.emoji}>👨‍👩‍👧</Text>
          <Text style={s.heading}>Create Parent Account</Text>
          <Text style={s.subheading}>Find verified tutors for your Grade 2–6 child.</Text>
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

        {/* Full Name */}
        <Text style={s.label}>Full Name *</Text>
        <TextInput style={s.input} placeholder="e.g. Maria Santos" placeholderTextColor={MUTED}
          value={form.fullName} onChangeText={v => set("fullName", v)} />

        {/* Email */}
        <Text style={s.label}>Email Address *</Text>
        <TextInput style={s.input} placeholder="you@email.com" placeholderTextColor={MUTED}
          keyboardType="email-address" autoCapitalize="none"
          value={form.email} onChangeText={v => set("email", v)} />

        {/* Location */}
        <Text style={s.label}>Location</Text>
        <TextInput style={s.input} placeholder="e.g. Quezon City" placeholderTextColor={MUTED}
          value={form.location} onChangeText={v => set("location", v)} />

        {/* Gender */}
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

        {/* Password */}
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

        {/* Password strength */}
        <PasswordStrength password={form.password} />

        {/* Confirm Password */}
        <Text style={[s.label, { marginTop: 8 }]}>Confirm Password *</Text>
        <TextInput style={s.input} placeholder="Repeat password" placeholderTextColor={MUTED}
          secureTextEntry value={form.confirmPassword}
          onChangeText={v => set("confirmPassword", v)} />
        <PasswordMatch password={form.password} confirm={form.confirmPassword} />

        {/* ── Valid ID verification (same as the website's Verification step) ── */}
        <Text style={s.sectionTitle}>🪪 Identity Verification</Text>
        <View style={s.idInfo}>
          <Text style={s.idInfoTitle}>📋 Accepted IDs — Primary</Text>
          <Text style={s.idInfoTxt}>
            PhilSys ID · Philippine Passport · Driver's License · SSS/UMID Card · GSIS ID · PRC ID · Voter's ID · Postal ID
          </Text>
          {showMoreIds && (
            <>
              <Text style={[s.idInfoTitle, { marginTop: 10 }]}>📋 Secondary IDs</Text>
              <Text style={s.idInfoTxt}>
                Barangay ID · TIN ID · PhilHealth ID · NBI Clearance · School ID · Company ID · Senior Citizen ID · PWD ID · Police Clearance · OWWA ID
              </Text>
            </>
          )}
          <TouchableOpacity onPress={() => setShowMoreIds(v => !v)}>
            <Text style={s.idMore}>{showMoreIds ? "Show less ▲" : "See more valid IDs ▼"}</Text>
          </TouchableOpacity>
        </View>

        {([
          { key: "id1", label: "1st Valid ID", file: validId1, required: true  },
          { key: "id2", label: "2nd Valid ID", file: validId2, required: false },
        ] as const).map(({ key, label, file, required }) => (
          <View key={key} style={{ marginBottom: 14 }}>
            <Text style={s.label}>
              {label} {required ? <Text style={{ color: "#DC2626" }}>*</Text> : <Text style={s.optional}>(optional)</Text>}
            </Text>
            <TouchableOpacity
              style={[s.idDrop, file && s.idDropOk]}
              onPress={() => pickId(key)}
              disabled={loading}
            >
              <Text style={{ fontSize: 24 }}>{file ? "✅" : "📄"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.idDropTxt, file && { color: "#065F46" }]} numberOfLines={1}>
                  {file ? file.name : `Tap to upload ${label}`}
                </Text>
                <Text style={s.idDropHint}>PDF only · Max 20MB</Text>
              </View>
              {file && (
                <TouchableOpacity
                  style={s.idRemove}
                  onPress={() => (key === "id1" ? setValidId1(null) : setValidId2(null))}
                >
                  <Text style={s.idRemoveTxt}>Remove</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <View style={s.idPrivacy}>
          <Text style={s.idPrivacyTxt}>
            ⚠️ Your ID will be used for identity verification purposes only and will not be shared with third parties.
          </Text>
        </View>

        {/* Register button */}
        <TouchableOpacity
          style={[s.button, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.buttonTxt}>Create Parent Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.loginLink} onPress={() => router.back()}>
          <Text style={s.loginLinkTxt}>Already have an account? <Text style={{ color: PRIMARY, fontWeight: "700" }}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  scroll:         { padding: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
  backTxt:        { fontSize: 15, fontWeight: "600", color: DARK },
  headerBox:      { alignItems: "center", marginBottom: 28 },
  emoji:          { fontSize: 48, marginBottom: 10 },
  heading:        { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6, textAlign: "center" },
  subheading:     { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 },
  errorBox:       { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:       { flex: 1, color: CORAL, fontSize: 13, fontWeight: "600" },
  signInBtn:      { backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: -6, marginBottom: 16 },
  signInBtnTxt:   { color: "#fff", fontSize: 14, fontWeight: "700" },
  label:          { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 6 },
  input:          { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#fff", marginBottom: 14 },
  passRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  eyeBtn:         { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  genderRow:      { flexDirection: "row", gap: 10, marginBottom: 14 },
  genderBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", alignItems: "center" },
  genderBtnActive:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  genderTxt:      { fontSize: 13, color: MUTED, fontWeight: "500" },
  strengthBox:    { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8, gap: 6 },
  strengthRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  strengthTxt:    { fontSize: 12, color: MUTED },
  sectionTitle:   { fontSize: 15, fontWeight: "800", color: DARK, marginTop: 12, marginBottom: 10 },
  idInfo:         { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, padding: 12, marginBottom: 16 },
  idInfoTitle:    { fontSize: 13, fontWeight: "700", color: "#1D4ED8", marginBottom: 4 },
  idInfoTxt:      { fontSize: 12, color: "#1D4ED8", lineHeight: 20 },
  idMore:         { marginTop: 6, fontSize: 12, color: PRIMARY, fontWeight: "600", textDecorationLine: "underline" },
  optional:       { fontSize: 11, color: MUTED, fontWeight: "400" },
  idDrop:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", borderColor: BORDER, backgroundColor: "#FAFAFA" },
  idDropOk:       { borderColor: GREEN, backgroundColor: "#F0FDF4" },
  idDropTxt:      { fontSize: 13, fontWeight: "600", color: "#374151" },
  idDropHint:     { fontSize: 11, color: MUTED, marginTop: 2 },
  idRemove:       { backgroundColor: "#FEE2E2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  idRemoveTxt:    { color: "#DC2626", fontSize: 12 },
  idPrivacy:      { backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12, marginBottom: 8 },
  idPrivacyTxt:   { fontSize: 12, color: "#92400E", lineHeight: 18 },
  doneCard:       { backgroundColor: "#fff", borderRadius: 20, padding: 28, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  doneTitle:      { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 12 },
  doneTxt:        { fontSize: 13, color: "#374151", lineHeight: 20, textAlign: "center", marginBottom: 12 },
  button:         { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonTxt:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginLink:      { alignItems: "center", marginTop: 16 },
  loginLinkTxt:   { fontSize: 13, color: MUTED },
});
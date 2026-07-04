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
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CORAL      = "#EF4444";
const GREEN      = "#10B981";
const BG         = "#F8FAFC";

export default function RegisterParentPage() {
  const { signUp } = useAuth() as any;
  const router     = useRouter();

  const [form, setForm] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    location: "", gender: "",
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Password strength
  const pwLen    = form.password.length >= 8;
  const pwUpper  = /[A-Z]/.test(form.password);
  const pwNumber = /[0-9]/.test(form.password);
  const pwStrong = pwLen && pwUpper && pwNumber;

  const handleRegister = async () => {
    if (!form.fullName.trim())        { setError("Full name is required."); return; }
    if (!form.email.trim())           { setError("Email is required."); return; }
    if (!pwStrong)                    { setError("Password must be 8+ chars with uppercase and number."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    setError("");
    setLoading(true);
    try {
      await signUp({
        email:    form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role:     "parent",
        location: form.location || null,
        gender:   form.gender   || null,
      });
      Alert.alert(
        "Account Created! 🎉",
        "Welcome to LearnBridge! You can now find tutors for your child.",
        [{ text: "Get Started", onPress: () => router.replace("/(drawer)/dashboard" as any) }]
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
            placeholder="Min 8 chars" placeholderTextColor={MUTED}
            secureTextEntry={!showPass} value={form.password}
            onChangeText={v => set("password", v)} />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
            <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Password strength */}
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

        {/* Confirm Password */}
        <Text style={[s.label, { marginTop: 8 }]}>Confirm Password *</Text>
        <TextInput style={s.input} placeholder="Re-enter password" placeholderTextColor={MUTED}
          secureTextEntry value={form.confirmPassword}
          onChangeText={v => set("confirmPassword", v)} />

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
  button:         { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonTxt:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginLink:      { alignItems: "center", marginTop: 16 },
  loginLinkTxt:   { fontSize: 13, color: MUTED },
});
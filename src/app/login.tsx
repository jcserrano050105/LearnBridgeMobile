import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CORAL      = "#EF4444";
const BG         = "#F8FAFC";

export default function LoginPage() {
  const { signIn }  = useAuth() as any;
  const router      = useRouter();
  const [email,     setEmail]    = useState("");
  const [password,  setPassword] = useState("");
  const [loading,   setLoading]  = useState(false);
  const [showPass,  setShowPass] = useState(false);
  const [error,     setError]    = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      router.replace("/(drawer)/dashboard" as any);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Text style={s.logoTxt}>LB</Text>
          </View>
          <View>
            <Text style={s.logoName}>LearnBridge</Text>
            <Text style={s.logoSub}>Academic Support Platform</Text>
          </View>
        </View>

        {/* Heading */}
        <Text style={s.heading}>Welcome Back</Text>
        <Text style={s.subheading}>Sign in to continue to your dashboard.</Text>

        {/* Error */}
        {error !== "" && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Email */}
        <Text style={s.label}>Email Address</Text>
        <TextInput
          style={s.input}
          placeholder="you@email.com"
          placeholderTextColor={MUTED}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {/* Password */}
        <Text style={s.label}>Password</Text>
        <View style={s.passRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="••••••••"
            placeholderTextColor={MUTED}
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowPass(p => !p)}
          >
            <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In button */}
        <TouchableOpacity
          style={[s.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.buttonTxt}>Sign In</Text>
          }
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerTxt}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Sign Up */}
        <Text style={s.signUpPrompt}>Don't have an account?</Text>
        <Text style={s.signUpSub}>Create one — choose your role below.</Text>

        <View style={s.roleRow}>
          <TouchableOpacity
            style={s.roleBtn}
            onPress={() => router.push("/register-parent" as any)}
          >
            <Text style={s.roleEmoji}>👨‍👩‍👧</Text>
            <Text style={s.roleBtnTitle}>I'm a Parent</Text>
            <Text style={s.roleBtnSub}>Find tutors for my child</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.roleBtn, s.roleBtnTutor]}
            onPress={() => router.push("/register-tutor" as any)}
          >
            <Text style={s.roleEmoji}>👩‍🏫</Text>
            <Text style={[s.roleBtnTitle, { color: PRIMARY }]}>I'm a Tutor</Text>
            <Text style={s.roleBtnSub}>Offer my tutoring services</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  scroll:      { padding: 24, paddingTop: 60, paddingBottom: 40 },
  logoRow:     { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 40 },
  logoBox:     { width: 46, height: 46, borderRadius: 12, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  logoTxt:     { color: "#fff", fontWeight: "800", fontSize: 17 },
  logoName:    { fontSize: 18, fontWeight: "800", color: DARK },
  logoSub:     { fontSize: 12, color: MUTED, marginTop: 2 },
  heading:     { fontSize: 26, fontWeight: "800", color: DARK, marginBottom: 6 },
  subheading:  { fontSize: 14, color: MUTED, marginBottom: 24 },
  errorBox:    { backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:    { color: CORAL, fontSize: 13, fontWeight: "600" },
  label:       { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#fff", marginBottom: 16 },
  passRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  eyeBtn:      { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  button:      { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 4 },
  buttonTxt:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  divider:     { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerTxt:  { fontSize: 13, color: MUTED },
  signUpPrompt:{ fontSize: 16, fontWeight: "700", color: DARK, textAlign: "center" },
  signUpSub:   { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 20, marginTop: 4 },
  roleRow:     { flexDirection: "row", gap: 12 },
  roleBtn:     { flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, padding: 18, alignItems: "center", gap: 6 },
  roleBtnTutor:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  roleEmoji:   { fontSize: 28, marginBottom: 4 },
  roleBtnTitle:{ fontSize: 14, fontWeight: "800", color: DARK },
  roleBtnSub:  { fontSize: 11, color: MUTED, textAlign: "center" },
});
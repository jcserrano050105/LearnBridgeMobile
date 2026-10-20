import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const CORAL      = "#EF4444";
const GREEN      = "#10B981";
const BG         = "#F8FAFC";

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step,        setStep]        = useState<Step>(1);
  const [email,       setEmail]       = useState("");
  const [code,        setCode]        = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [info,        setInfo]        = useState("");

  // ── Step 1: send a recovery code to the email ──
  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) throw error;
      setEmail(trimmed);
      setStep(2);
      setInfo(`We sent a 6-digit code to ${trimmed}.`);
    } catch (err: any) {
      setError(err.message || "Could not send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: confirm the email by verifying the code ──
  const verifyCode = async () => {
    if (code.trim().length < 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type:  "recovery",
      });
      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: set the new password ──
  const savePassword = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // verifyOtp signed the user in — sign out so they log in with the new password
      await supabase.auth.signOut();
      Alert.alert("Password Updated", "You can now sign in with your new password.");
      router.replace("/login" as any);
    } catch (err: any) {
      setError(err.message || "Could not update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = async () => {
    if (step === 3) await supabase.auth.signOut();
    router.replace("/login" as any);
  };

  const headings: Record<Step, [string, string]> = {
    1: ["Forgot Password?", "Enter your account email and we'll send you a verification code."],
    2: ["Confirm Your Email", "Enter the 6-digit code we sent to your email."],
    3: ["Set New Password", "Choose a new password for your account."],
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
        {/* Back */}
        <TouchableOpacity onPress={goBack} style={s.backBtn}>
          <Text style={s.backTxt}>← Back to Sign In</Text>
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={s.stepRow}>
          {[1, 2, 3].map(n => (
            <React.Fragment key={n}>
              <View style={[s.stepDot, n <= step && s.stepDotActive]}>
                <Text style={[s.stepNum, n <= step && { color: "#fff" }]}>
                  {n < step ? "✓" : n}
                </Text>
              </View>
              {n < 3 && <View style={[s.stepLine, n < step && { backgroundColor: PRIMARY }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Heading */}
        <Text style={s.heading}>{headings[step][0]}</Text>
        <Text style={s.subheading}>{headings[step][1]}</Text>

        {/* Messages */}
        {error !== "" && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}
        {info !== "" && (
          <View style={s.infoBox}>
            <Text style={s.infoTxt}>{info}</Text>
          </View>
        )}

        {step === 1 && (
          <>
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
            <PrimaryButton label="Send Code" loading={loading} onPress={sendCode} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.label}>Verification Code</Text>
            <TextInput
              style={[s.input, s.codeInput]}
              placeholder="123456"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, ""))}
            />
            <PrimaryButton label="Confirm Email" loading={loading} onPress={verifyCode} />

            <View style={s.linkRow}>
              <TouchableOpacity onPress={sendCode} disabled={loading}>
                <Text style={s.link}>Resend code</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep(1); setCode(""); setError(""); setInfo(""); }}>
                <Text style={s.link}>Change email</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.label}>New Password</Text>
            <View style={s.passRow}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={MUTED}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
                <Text style={{ fontSize: 16 }}>{showPass ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Confirm Password</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              secureTextEntry={!showPass}
              value={confirm}
              onChangeText={setConfirm}
            />
            {confirm !== "" && (
              <Text style={[s.matchTxt, { color: password === confirm ? GREEN : CORAL }]}>
                {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
              </Text>
            )}

            <PrimaryButton label="Reset Password" loading={loading} onPress={savePassword} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.button, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={s.buttonTxt}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  scroll:      { padding: 24, paddingTop: 60, paddingBottom: 40 },
  backBtn:     { marginBottom: 28 },
  backTxt:     { color: PRIMARY, fontSize: 14, fontWeight: "700" },
  stepRow:     { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  stepDot:     { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  stepDotActive:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
  stepNum:     { fontSize: 13, fontWeight: "700", color: MUTED },
  stepLine:    { flex: 1, height: 2, backgroundColor: BORDER, marginHorizontal: 6 },
  heading:     { fontSize: 26, fontWeight: "800", color: DARK, marginBottom: 6 },
  subheading:  { fontSize: 14, color: MUTED, marginBottom: 24 },
  errorBox:    { backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:    { color: CORAL, fontSize: 13, fontWeight: "600" },
  infoBox:     { backgroundColor: PRIMARY_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoTxt:     { color: PRIMARY, fontSize: 13, fontWeight: "600" },
  label:       { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK, backgroundColor: "#fff", marginBottom: 16 },
  codeInput:   { fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "700" },
  passRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  eyeBtn:      { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  matchTxt:    { fontSize: 12, fontWeight: "600", marginTop: -8, marginBottom: 16 },
  button:      { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 4 },
  buttonTxt:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  linkRow:     { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  link:        { color: PRIMARY, fontSize: 13, fontWeight: "700" },
});

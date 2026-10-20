import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Mirrors getPasswordStrength() in the website's src/pages/auth/RegisterPage.jsx
export function getPasswordStrength(pw: string) {
  if (!pw) return null;
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const passed  = Object.values(checks).filter(Boolean).length;
  const missing: string[] = [];
  if (!checks.length)    missing.push("at least 8 characters");
  if (!checks.uppercase) missing.push("uppercase letter");
  if (!checks.number)    missing.push("number");
  if (!checks.special)   missing.push("special character");
  const strength = passed <= 1 ? "Weak" : passed === 2 ? "Fair" : passed === 3 ? "Good" : "Strong";
  const color    = passed <= 1 ? "#DC2626" : passed === 2 ? "#F59E0B" : passed === 3 ? "#2563EB" : "#16A34A";
  return { checks, missing, strength, color, passed };
}

// The website only blocks sign-up on length; the other checks are guidance
export const PASSWORD_MIN_LENGTH = 8;

const CHECK_LABELS: { key: "length" | "uppercase" | "number" | "special"; label: string }[] = [
  { key: "length",    label: "At least 8 characters" },
  { key: "uppercase", label: "Uppercase letter (A-Z)" },
  { key: "number",    label: "Number (0-9)" },
  { key: "special",   label: "Special character (!@#$...)" },
];

export default function PasswordStrength({ password }: { password: string }) {
  const pw = getPasswordStrength(password);
  if (!pw) return null;

  return (
    <View style={s.box}>
      {/* 4-segment meter */}
      <View style={s.bars}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[s.bar, { backgroundColor: i <= pw.passed ? pw.color : "#E5E7EB" }]} />
        ))}
      </View>

      <View style={s.summary}>
        {pw.missing.length > 0 && (
          <Text style={s.missing}>Missing: {pw.missing.join(", ")}</Text>
        )}
        <Text style={[s.strength, { color: pw.color }]}>{pw.strength}</Text>
      </View>

      {/* Checklist */}
      <View style={s.grid}>
        {CHECK_LABELS.map(({ key, label }) => {
          const ok = pw.checks[key];
          return (
            <View key={key} style={s.item}>
              <View style={[s.dot, { backgroundColor: ok ? "#D1FAE5" : "#F3F4F6" }]}>
                <Text style={[s.dotTxt, { color: ok ? "#16A34A" : "#9CA3AF" }]}>{ok ? "✓" : "✕"}</Text>
              </View>
              <Text style={[s.itemTxt, { color: ok ? "#16A34A" : "#6B7280" }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function PasswordMatch({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const ok = password === confirm;
  return (
    <Text style={[s.match, { color: ok ? "#16A34A" : "#DC2626" }]}>
      {ok ? "✓ Passwords match" : "✕ Passwords do not match"}
    </Text>
  );
}

const s = StyleSheet.create({
  box:      { marginTop: 8, marginBottom: 8 },
  bars:     { flexDirection: "row", gap: 4 },
  bar:      { flex: 1, height: 4, borderRadius: 2 },
  summary:  { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  missing:  { flex: 1, fontSize: 11, color: "#6B7280" },
  strength: { marginLeft: "auto", fontSize: 11, fontWeight: "700" },
  grid:     { flexDirection: "row", flexWrap: "wrap", marginTop: 8, rowGap: 6 },
  item:     { width: "50%", flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 6 },
  dot:      { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  dotTxt:   { fontSize: 9, fontWeight: "700" },
  itemTxt:  { flex: 1, fontSize: 11 },
  match:    { marginTop: -10, marginBottom: 16, fontSize: 11, fontWeight: "600" },
});

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// Mirrors the website's src/pages/tutor/PendingApprovalPage.jsx

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MID        = "#374151";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const DANGER     = "#EF4444";
const SUPPORT    = "support@learnbridge.edu.ph";

const NEXT_STEPS: [string, keyof typeof Ionicons.glyphMap][] = [
  ["Admin reviews your NBI, PRC License & Medical Certificate", "shield-checkmark-outline"],
  ["Admin sets your approved session rate",                      "wallet-outline"],
  ["You receive approval notification",                           "checkmark"],
  ["You take the AI Certification Exam per subject topic",        "ribbon-outline"],
  ["Your profile becomes visible to parents",                     "people-outline"],
];

export default function PendingApprovalPage() {
  const { user, profile, signOut, loading: authLoading } = useAuth() as any;
  const router = useRouter();

  const [tutorStatus, setTutorStatus] = useState("pending");
  const [adminNotes,  setAdminNotes]  = useState("");
  const [loading,     setLoading]     = useState(true);

  // Not signed in → back to login
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login" as any);
  }, [authLoading, user]);

  // Fallback: stop spinning after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Check status now and every 30 seconds
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from("tutors")
          .select("status, admin_notes")
          .eq("id", profile.id)
          .single();
        const status = data?.status || "pending";
        setTutorStatus(status);
        setAdminNotes(data?.admin_notes || "");
        // App extra: once approved, continue straight into the app
        if (status === "approved") router.replace("/(drawer)/dashboard" as any);
      } catch (e) {
        console.error("Status fetch error:", e);
        setTutorStatus("pending");
      }
      setLoading(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login" as any);
  };

  if (loading) {
    return (
      <View style={[s.page, s.center]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={s.loadingTxt}>Checking your application status...</Text>
      </View>
    );
  }

  const isPending = tutorStatus === "pending";

  return (
    <ScrollView style={s.page} contentContainerStyle={s.scroll}>
      {/* Brand */}
      <View style={s.brand}>
        <Image source={require("../../assets/images/learnbridge-logo.png")} style={s.logo} resizeMode="contain" />
        <Text style={s.brandTxt}>LearnBridge</Text>
      </View>

      <View style={s.card}>
        {isPending ? (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEF9C3" }]}>
              <Ionicons name="time-outline" size={36} color="#CA8A04" />
            </View>

            <Text style={s.title}>Pending Admin Approval</Text>
            <Text style={s.body}>
              Your requirements have been submitted successfully! Our admin team is currently
              reviewing your credentials. You will receive an email notification once your
              account has been approved.
            </Text>

            <View style={s.infoBox}>
              <Text style={s.infoTxt}>
                This review process typically takes 1–3 business days. Thank you for your patience!
              </Text>
            </View>

            <View style={s.stepsBox}>
              <Text style={s.stepsTitle}>What happens next?</Text>
              {NEXT_STEPS.map(([text, icon]) => (
                <View key={text} style={s.stepRow}>
                  <View style={s.stepIcon}>
                    <Ionicons name={icon} size={12} color={PRIMARY} />
                  </View>
                  <Text style={s.stepTxt}>{text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="close" size={36} color={DANGER} />
            </View>

            <Text style={s.title}>Application Not Approved</Text>
            <Text style={s.body}>
              Unfortunately, your tutor application was not approved at this time.
              Please review the notes below and contact our support team for more information.
            </Text>

            {!!adminNotes && (
              <View style={s.notesBox}>
                <Text style={s.notesTitle}>Admin Notes:</Text>
                <Text style={s.notesTxt}>{adminNotes}</Text>
              </View>
            )}

            <View style={s.supportBox}>
              <Text style={s.supportTxt}>
                If you believe this is an error or would like to reapply, please contact us at{" "}
                <Text style={s.supportLink} onPress={() => Linking.openURL(`mailto:${SUPPORT}`)}>
                  {SUPPORT}
                </Text>
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>

        {isPending && (
          <Text style={s.autoTxt}>This page checks your status automatically every 30 seconds.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:       { flex: 1, backgroundColor: "#F8FAFC" },
  center:     { alignItems: "center", justifyContent: "center" },
  scroll:     { padding: 24, paddingTop: 64, paddingBottom: 48, alignItems: "center" },
  loadingTxt: { marginTop: 16, fontSize: 13, color: MUTED },

  brand:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
  logo:     { width: 52, height: 52 },
  brandTxt: { fontSize: 20, fontWeight: "800", color: DARK },

  card:       { backgroundColor: "#fff", borderRadius: 20, paddingVertical: 36, paddingHorizontal: 24, width: "100%", maxWidth: 480, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: "800", color: DARK, textAlign: "center", marginBottom: 12 },
  body:       { fontSize: 13, color: MID, lineHeight: 22, textAlign: "center", marginBottom: 24 },

  infoBox: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, padding: 14, marginBottom: 24, width: "100%" },
  infoTxt: { fontSize: 13, color: "#1D4ED8", lineHeight: 20, textAlign: "center" },

  stepsBox:   { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, marginBottom: 24, width: "100%" },
  stepsTitle: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 12 },
  stepRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  stepIcon:   { width: 24, height: 24, borderRadius: 6, backgroundColor: PRIMARY_BG, alignItems: "center", justifyContent: "center" },
  stepTxt:    { flex: 1, fontSize: 13, color: MID, lineHeight: 20 },

  notesBox:   { backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 14, marginBottom: 24, width: "100%" },
  notesTitle: { fontSize: 13, fontWeight: "700", color: DANGER, marginBottom: 6 },
  notesTxt:   { fontSize: 13, color: MID, lineHeight: 20 },

  supportBox:  { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 24, width: "100%" },
  supportTxt:  { fontSize: 13, color: MID, lineHeight: 20 },
  supportLink: { color: PRIMARY, fontWeight: "600" },

  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, width: "100%" },
  signOutTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  autoTxt:    { fontSize: 11, color: MUTED, marginTop: 12, textAlign: "center" },
});

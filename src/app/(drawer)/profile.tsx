import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const TEAL       = "#0D9488";
const TEAL_BG    = "#CCFBF1";
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const SPECIALIZATIONS = ["English", "Mathematics", "Science", "Filipino", "Reading"];

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth() as any;
  const role = profile?.role || "parent";

  // ── State ──
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [tutorData,  setTutorData]  = useState<any>(null);
  const [success,    setSuccess]    = useState("");
  const [error,      setError]      = useState("");

  const [form, setForm] = useState({
    full_name:        profile?.full_name        || "",
    contact:          profile?.contact          || "",
    address:          profile?.address          || "",
    bio:              profile?.bio              || "",
    location:         profile?.location         || "",
    gender:           profile?.gender           || "",
    years_experience: "",
    rate_per_session: "",
    specialization:   [] as string[],
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── Fetch profile data ──
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (role === "tutor") {
        const { data } = await supabase
          .from("tutors")
          .select("*, profile:id ( full_name, email, bio, location, gender, contact, address )")
          .eq("id", user.id)
          .single();
        setTutorData(data);
        setForm({
          full_name:        data?.profile?.full_name        || profile?.full_name || "",
          contact:          data?.profile?.contact          || profile?.contact   || "",
          address:          data?.profile?.address          || profile?.address   || "",
          bio:              data?.profile?.bio              || profile?.bio       || "",
          location:         data?.profile?.location         || profile?.location  || "",
          gender:           data?.profile?.gender           || profile?.gender    || "",
          years_experience: String(data?.years_experience   || ""),
          rate_per_session: String(data?.rate_per_session   || ""),
          specialization:   data?.specialization            || [],
        });
      } else {
        setForm(f => ({
          ...f,
          full_name: profile?.full_name || "",
          contact:   profile?.contact   || "",
          address:   profile?.address   || "",
          bio:       profile?.bio       || "",
          location:  profile?.location  || "",
          gender:    profile?.gender    || "",
        }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await supabase.from("profiles").update({
        full_name: form.full_name,
        contact:   form.contact   || null,
        address:   form.address   || null,
        bio:       form.bio       || null,
        location:  form.location  || null,
        gender:    form.gender    || null,
      }).eq("id", user.id);

      if (role === "tutor") {
        await supabase.from("tutors").update({
          years_experience: Number(form.years_experience) || 0,
          rate_per_session: Number(form.rate_per_session) || null,
          specialization:   form.specialization,
        }).eq("id", user.id);
      }

      setSuccess("Profile updated successfully!");
      setEditing(false);
      setTimeout(() => setSuccess(""), 3000);
      fetchProfile();
    } catch (err: any) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError("");
    fetchProfile();
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await signOut(); } },
    ]);
  };

  const toggleSpec = (s: string) => {
    set("specialization",
      form.specialization.includes(s)
        ? form.specialization.filter((x: string) => x !== s)
        : [...form.specialization, s]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="LearnBridge" subtitle="My Profile" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const initials = (form.full_name || profile?.full_name || "U").charAt(0).toUpperCase();
  const approvedRate = tutorData?.approved_rate || tutorData?.rate_per_session;

  return (
    <View style={styles.container}>
      <Header title="LearnBridge" subtitle="My Profile" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchProfile} tintColor={PRIMARY} />}
      >

        {/* ── Avatar card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{form.full_name || "User"}</Text>
          <Text style={styles.profileEmail}>{profile?.email || ""}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillTxt}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
          </View>
          {role === "tutor" && approvedRate && (
            <Text style={styles.rateTag}>₱{Number(approvedRate).toLocaleString()} / session</Text>
          )}
        </View>

        {/* ── Success / Error banners ── */}
        {success !== "" && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#065F46" />
            <Text style={styles.successTxt}>{success}</Text>
          </View>
        )}
        {error !== "" && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={CORAL} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* ── Edit / Save / Cancel buttons ── */}
        <View style={styles.editRow}>
          {editing ? (
            <>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.saveBtnTxt}>Save Changes</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={16} color={PRIMARY} />
              <Text style={styles.editBtnTxt}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Personal Info card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <Field label="Full Name" icon="person-outline">
            {editing
              ? <TextInput style={styles.input} value={form.full_name} onChangeText={v => set("full_name", v)} placeholder="Full name" />
              : <Text style={styles.fieldVal}>{form.full_name || "—"}</Text>
            }
          </Field>

          <Field label="Email" icon="mail-outline">
            <Text style={[styles.fieldVal, { color: MUTED }]}>{profile?.email || "—"}</Text>
          </Field>

          <Field label="Contact" icon="call-outline">
            {editing
              ? <TextInput style={styles.input} value={form.contact} onChangeText={v => set("contact", v)} placeholder="Phone number" keyboardType="phone-pad" />
              : <Text style={styles.fieldVal}>{form.contact || "—"}</Text>
            }
          </Field>

          <Field label="Address" icon="location-outline">
            {editing
              ? <TextInput style={styles.input} value={form.address} onChangeText={v => set("address", v)} placeholder="Your address" />
              : <Text style={styles.fieldVal}>{form.address || "—"}</Text>
            }
          </Field>

          <Field label="Location" icon="map-outline">
            {editing
              ? <TextInput style={styles.input} value={form.location} onChangeText={v => set("location", v)} placeholder="City / Region" />
              : <Text style={styles.fieldVal}>{form.location || "—"}</Text>
            }
          </Field>

          <Field label="Gender" icon="person-circle-outline" last>
            {editing ? (
              <View style={styles.genderRow}>
                {["Male", "Female", "Other"].map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                    onPress={() => set("gender", g)}
                  >
                    <Text style={[styles.genderTxt, form.gender === g && styles.genderTxtActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldVal}>{form.gender || "—"}</Text>
            )}
          </Field>
        </View>

        {/* ── Bio card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Field label="Bio" icon="document-text-outline" last>
            {editing
              ? <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                  value={form.bio}
                  onChangeText={v => set("bio", v)}
                  placeholder="Write a short bio..."
                  multiline
                />
              : <Text style={styles.fieldVal}>{form.bio || "—"}</Text>
            }
          </Field>
        </View>

        {/* ── Tutor-only fields ── */}
        {role === "tutor" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tutor Information</Text>

            <Field label="Years of Experience" icon="ribbon-outline">
              {editing
                ? <TextInput style={styles.input} value={form.years_experience} onChangeText={v => set("years_experience", v)} placeholder="e.g. 3" keyboardType="numeric" />
                : <Text style={styles.fieldVal}>{form.years_experience ? `${form.years_experience} years` : "—"}</Text>
              }
            </Field>

            <Field label="Session Rate (₱)" icon="wallet-outline">
              {editing
                ? <TextInput style={styles.input} value={form.rate_per_session} onChangeText={v => set("rate_per_session", v)} placeholder="e.g. 500" keyboardType="numeric" />
                : <Text style={styles.fieldVal}>{form.rate_per_session ? `₱${Number(form.rate_per_session).toLocaleString()}` : "—"}</Text>
              }
            </Field>

            <Field label="Specializations" icon="book-outline" last>
              {editing ? (
                <View style={styles.specRow}>
                  {SPECIALIZATIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.specBtn, form.specialization.includes(s) && styles.specBtnActive]}
                      onPress={() => toggleSpec(s)}
                    >
                      <Text style={[styles.specTxt, form.specialization.includes(s) && styles.specTxtActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.specRow}>
                  {form.specialization.length > 0
                    ? form.specialization.map((s: string) => (
                        <View key={s} style={styles.specBtnActive}>
                          <Text style={styles.specTxtActive}>{s}</Text>
                        </View>
                      ))
                    : <Text style={styles.fieldVal}>—</Text>
                  }
                </View>
              )}
            </Field>
          </View>
        )}

        {/* ── Sign Out button ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={CORAL} />
          <Text style={styles.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Reusable Field row ────────────────────────────────────────────────────────
function Field({ label, icon, children, last }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
      <View style={styles.fieldLeft}>
        <Ionicons name={icon} size={16} color={MUTED} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={styles.fieldRight}>{children}</View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  content:      { padding: 16, paddingBottom: 60 },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },

  // Avatar card
  avatarCard:   { backgroundColor: CARD, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText:   { color: "#fff", fontSize: 32, fontWeight: "800" },
  profileName:  { fontSize: 20, fontWeight: "800", color: DARK },
  profileEmail: { fontSize: 13, color: MUTED, marginTop: 4 },
  rolePill:     { marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: PRIMARY_BG, borderRadius: 20 },
  rolePillTxt:  { fontSize: 12, fontWeight: "700", color: PRIMARY },
  rateTag:      { marginTop: 6, fontSize: 13, color: TEAL, fontWeight: "600" },

  // Banners
  successBanner:{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#D1FAE5", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#6EE7B7" },
  successTxt:   { fontSize: 13, fontWeight: "600", color: "#065F46", flex: 1 },
  errorBanner:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CORAL_BG, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: CORAL },
  errorTxt:     { fontSize: 13, fontWeight: "600", color: CORAL, flex: 1 },

  // Edit row
  editRow:      { flexDirection: "row", gap: 10, marginBottom: 16 },
  editBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  editBtnTxt:   { fontSize: 14, fontWeight: "700", color: PRIMARY },
  saveBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: PRIMARY },
  saveBtnTxt:   { fontSize: 14, fontWeight: "700", color: "#fff" },
  cancelBtn:    { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  cancelBtnTxt: { fontSize: 14, fontWeight: "600", color: MUTED },

  // Card
  card:         { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16, overflow: "hidden" },
  cardTitle:    { fontSize: 13, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  // Field row
  fieldRow:       { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  fieldLeft:      { flexDirection: "row", alignItems: "center", gap: 8, width: 130 },
  fieldLabel:     { fontSize: 13, color: MUTED, fontWeight: "500" },
  fieldRight:     { flex: 1 },
  fieldVal:       { fontSize: 14, color: DARK, fontWeight: "500" },
  input:          { fontSize: 14, color: DARK, borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#F9FAFB" },

  // Gender
  genderRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  genderBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB" },
  genderBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  genderTxt:       { fontSize: 13, color: MUTED, fontWeight: "600" },
  genderTxtActive: { color: PRIMARY },

  // Specializations
  specRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  specBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB" },
  specBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_BG, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  specTxt:       { fontSize: 12, color: MUTED, fontWeight: "600" },
  specTxtActive: { color: PRIMARY, fontSize: 12, fontWeight: "600" },

  // Sign out
  signOutBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: CORAL_BG, borderWidth: 1, borderColor: CORAL, marginTop: 8, marginBottom: 32 },
  signOutTxt:   { fontSize: 14, fontWeight: "700", color: CORAL },
});
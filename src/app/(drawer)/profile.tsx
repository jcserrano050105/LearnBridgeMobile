import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";
const BG      = "#F5F7FB";

export default function ProfilePage() {
  const { profile, signOut } = useAuth() as any;
  const router = useRouter();

  // ── Sign out and go back to login ──
  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const fields = [
    { icon: "person-outline",   label: "Full Name", value: profile?.full_name || "—" },
    { icon: "mail-outline",     label: "Email",     value: profile?.email     || "—" },
    { icon: "location-outline", label: "Location",  value: profile?.location  || "—" },
    { icon: "people-outline",   label: "Gender",    value: profile?.gender    || "—" },
    { icon: "shield-outline",   label: "Role",      value: profile?.role      || "—" },
  ];

  return (
    <View style={styles.container}>
      <Header title="LearnBridge" subtitle="My Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Avatar ── */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0) || "U"}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.full_name || "User"}</Text>
          <Text style={styles.role}>{profile?.role?.toUpperCase() || "USER"}</Text>
        </View>

        {/* ── Info Fields ── */}
        <View style={styles.card}>
          {fields.map((f, i) => (
            <View key={f.label} style={[styles.row, i < fields.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <Ionicons name={f.icon as any} size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldValue}>{f.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Bio ── */}
        {profile?.bio ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* ── Sign Out Button → goes to /login ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  content:      { padding: 16, paddingBottom: 40 },
  avatarWrap:   { alignItems: "center", marginVertical: 24 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText:   { color: "#fff", fontSize: 32, fontWeight: "800" },
  name:         { fontSize: 20, fontWeight: "800", color: DARK },
  role:         { fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: 1 },
  card:         { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 14, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowIcon:      { width: 36, height: 36, borderRadius: 8, backgroundColor: "#EBEBFF", alignItems: "center", justifyContent: "center" },
  fieldLabel:   { fontSize: 11, color: MUTED, marginBottom: 2 },
  fieldValue:   { fontSize: 14, fontWeight: "600", color: DARK },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: DARK, padding: 16, paddingBottom: 8 },
  bio:          { fontSize: 13, color: MUTED, paddingHorizontal: 16, paddingBottom: 16, lineHeight: 20 },
  signOutBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 16, marginTop: 8 },
  signOutText:  { fontSize: 15, fontWeight: "700", color: "#EF4444" },
});
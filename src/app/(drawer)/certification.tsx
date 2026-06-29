import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";

const SUBJECTS = [
  { name: "Mathematics",        icon: "calculator-outline",  color: "#3D3BF3" },
  { name: "English",            icon: "book-outline",        color: "#10B981" },
  { name: "Science",            icon: "flask-outline",       color: "#F59E0B" },
  { name: "Filipino",           icon: "language-outline",    color: "#EF4444" },
  { name: "Araling Panlipunan", icon: "globe-outline",       color: "#8B5CF6" },
  { name: "MAPEH",              icon: "musical-notes-outline", color: "#EC4899" },
];

export default function CertificationPage() {
  return (
    <View style={styles.container}>
      <Header title="LearnBridge" subtitle="Certification" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="ribbon-outline" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.bannerTitle}>AI Certification Exam</Text>
          <Text style={styles.bannerText}>
            Pass subject exams to unlock tutoring opportunities and get matched with students.
          </Text>
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        {[
          { step: "1", text: "Choose a subject you want to teach" },
          { step: "2", text: "Take the AI-generated 20-question exam" },
          { step: "3", text: "Score 75% or higher to get certified" },
          { step: "4", text: "Get matched with students for that subject" },
        ].map((s) => (
          <View key={s.step} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{s.step}</Text>
            </View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}

        {/* Subjects */}
        <Text style={styles.sectionTitle}>Available Subjects</Text>
        <View style={styles.subjectGrid}>
          {SUBJECTS.map((sub) => (
            <TouchableOpacity key={sub.name} style={styles.subjectCard}>
              <View style={[styles.subjectIcon, { backgroundColor: sub.color + "20" }]}>
                <Ionicons name={sub.icon as any} size={24} color={sub.color} />
              </View>
              <Text style={styles.subjectName}>{sub.name}</Text>
              <View style={styles.takeBtn}>
                <Text style={styles.takeBtnText}>Take Exam</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  content:       { padding: 16, paddingBottom: 40 },
  banner:        { backgroundColor: "#FEFCE8", borderRadius: 14, borderWidth: 1, borderColor: "#FEF08A", padding: 20, alignItems: "center", marginBottom: 24 },
  bannerIcon:    { width: 64, height: 64, borderRadius: 16, backgroundColor: PRIMARY_BG, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  bannerTitle:   { fontSize: 18, fontWeight: "800", color: DARK, marginBottom: 8 },
  bannerText:    { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 },
  sectionTitle:  { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 12, marginTop: 4 },
  stepRow:       { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  stepNum:       { width: 32, height: 32, borderRadius: 16, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  stepNumText:   { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepText:      { fontSize: 14, color: DARK, flex: 1 },
  subjectGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  subjectCard:   { width: "47%", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, alignItems: "center" },
  subjectIcon:   { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  subjectName:   { fontSize: 13, fontWeight: "700", color: DARK, textAlign: "center", marginBottom: 12 },
  takeBtn:       { backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  takeBtnText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
});
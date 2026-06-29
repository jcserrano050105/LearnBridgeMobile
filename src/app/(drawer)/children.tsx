import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

// ── Colors ───────────────────────────────────────────────────────────────────
const PRIMARY    = "#3D3BF3"; const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280"; const DARK       = "#111827";
const BORDER     = "#E5E7EB"; const BG         = "#F5F7FB";
const GREEN      = "#10B981"; const GREEN_BG   = "#D1FAE5";
const ORANGE     = "#F59E0B"; const ORANGE_BG  = "#FEF3C7";
const CORAL      = "#EF4444"; const CORAL_BG   = "#FEE2E2";

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function analyzeResults(questions: any[], answers: Record<number, string>) {
  const byTopic: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
    byTopic[q.topic].total++;
    if (String(answers[i] ?? "").trim() === String(q.correct_answer ?? "").trim())
      byTopic[q.topic].correct++;
  });
  const strong: string[] = [], weak: string[] = [];
  Object.entries(byTopic).forEach(([topic, { correct, total }]) => {
    (correct / total >= 0.7 ? strong : weak).push(topic);
  });
  const totalCorrect = questions.filter((q, i) =>
    String(answers[i] ?? "").trim() === String(q.correct_answer ?? "").trim()
  ).length;
  const score = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;
  return { strong, weak, score, totalCorrect, total: questions.length };
}

function perfLabel(score: number) {
  if (score >= 80) return { label: "Advanced",      color: GREEN,  bg: GREEN_BG  };
  if (score >= 60) return { label: "Proficient",    color: ORANGE, bg: ORANGE_BG };
  if (score >= 40) return { label: "Developing",    color: ORANGE, bg: ORANGE_BG };
  return             { label: "Needs Support",  color: CORAL,  bg: CORAL_BG  };
}

function parseOptions(opts: any): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts;
  if (typeof opts === "object") return Object.values(opts);
  return [];
}

const SUBJECTS = ["english", "mathematics"];

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChildrenPage() {
  const { user } = useAuth() as any;

  // Students list
  const [students, setStudents] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Modal/flow state
  const [step, setStep] = useState<
    "none" | "form" | "assessing_english" | "assessing_mathematics" | "results"
  >("none");

  // Child form
  const [childForm, setChildForm] = useState({ name: "", grade_level: "3", notes: "" });

  // Assessment state
  const [questions,    setQuestions]    = useState<{ english: any[]; mathematics: any[] }>({ english: [], mathematics: [] });
  const [currentSubj,  setCurrentSubj]  = useState<"english" | "mathematics">("english");
  const [currentQ,     setCurrentQ]     = useState(0);
  const [answers,      setAnswers]      = useState<{ english: Record<number,string>; mathematics: Record<number,string> }>({ english: {}, mathematics: {} });
  const [loadingQ,     setLoadingQ]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [allResults,   setAllResults]   = useState<Record<string, number>>({});

  // ── Fetch students ──
  const loadStudents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("students")
      .select("id,name,grade_level,notes,assessment_results,created_at")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: false });
    setStudents(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ── Open add form ──
  const openForm = () => {
    setChildForm({ name: "", grade_level: "3", notes: "" });
    setAnswers({ english: {}, mathematics: {} });
    setAllResults({});
    setCurrentQ(0);
    setStep("form");
  };

  // ── Fetch questions for a subject ──
  const fetchQuestions = async (subject: string, gradeLevel: string) => {
    setLoadingQ(true);
    const { data } = await supabase
      .from("questions")
      .select("id,question_text,options,correct_answer,topic")
      .eq("subject", subject)
      .eq("status", "approved")
      .limit(20);
    const pool = shuffle(data || []).slice(0, 10);
    setQuestions(prev => ({ ...prev, [subject]: pool }));
    setLoadingQ(false);
  };

  // ── Start assessment ──
  const handleStartAssessment = async () => {
    if (!childForm.name.trim()) { Alert.alert("Error", "Please enter the child's name."); return; }
    setCurrentSubj("english");
    setCurrentQ(0);
    setStep("assessing_english");
    await fetchQuestions("english", childForm.grade_level);
  };

  // ── Answer a question ──
  const handleAnswer = (answer: string) => {
    const activeQs = questions[currentSubj] || [];
    setAnswers(prev => ({
      ...prev,
      [currentSubj]: { ...prev[currentSubj], [currentQ]: answer },
    }));
    if (currentQ < activeQs.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      // Finished this subject
      handleSubjectDone();
    }
  };

  const handleSubjectDone = async () => {
    if (currentSubj === "english") {
      // Move to mathematics
      setCurrentSubj("mathematics");
      setCurrentQ(0);
      setStep("assessing_mathematics");
      await fetchQuestions("mathematics", childForm.grade_level);
    } else {
      // Both done → compute results
      const engResult  = analyzeResults(questions.english,    answers.english);
      const mathResult = analyzeResults(questions.mathematics, answers.mathematics);
      setAllResults({ english: engResult.score, mathematics: mathResult.score });
      setStep("results");
    }
  };

  // ── Save child + results to Supabase ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const engResult  = analyzeResults(questions.english,    answers.english);
      const mathResult = analyzeResults(questions.mathematics, answers.mathematics);

      const assessmentResults = {
        english: {
          score:      engResult.score,
          correct:    engResult.totalCorrect,
          total:      engResult.total,
          strengths:  engResult.strong.join(", ") || "None identified",
          weaknesses: engResult.weak.join(", ")   || "None detected",
        },
        mathematics: {
          score:      mathResult.score,
          correct:    mathResult.totalCorrect,
          total:      mathResult.total,
          strengths:  mathResult.strong.join(", ") || "None identified",
          weaknesses: mathResult.weak.join(", ")   || "None detected",
        },
      };

      const { error } = await supabase.from("students").insert({
        parent_id:          user.id,
        name:               childForm.name.trim(),
        grade_level:        parseInt(childForm.grade_level),
        notes:              childForm.notes.trim() || null,
        assessment_results: assessmentResults,
      });

      if (error) throw error;
      await loadStudents();
      setStep("none");
      Alert.alert("Success!", `${childForm.name}'s profile has been created with pre-assessment results.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => setStep("none");

  // ── Active assessment vars ──
  const activeQs = questions[currentSubj] || [];
  const activeQ  = activeQs[currentQ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="My Children" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header row */}
        <View style={s.topRow}>
          <Text style={s.heading}>My Children</Text>
          <Text style={s.sub}>Manage your children's profiles and assessments.</Text>
          <TouchableOpacity style={s.addBtn} onPress={openForm}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnTxt}>Add Child</Text>
          </TouchableOpacity>
        </View>

        {/* Student list */}
        {loading ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} /> :
          students.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.eIcon}>👧</Text>
              <Text style={s.eTitle}>No children added yet</Text>
              <Text style={s.eTxt}>Tap "Add Child" to register your child and take a pre-assessment.</Text>
            </View>
          ) : students.map((st, i) => {
            const ar   = st.assessment_results;
            const eng  = ar?.english;
            const math = ar?.mathematics;
            return (
              <View key={st.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{st.name?.charAt(0) || "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{st.name}</Text>
                    <Text style={s.meta}>Grade {st.grade_level}</Text>
                    {st.notes ? <Text style={s.notes}>{st.notes}</Text> : null}
                  </View>
                  {ar && (
                    <View style={s.assessedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={GREEN} />
                      <Text style={s.assessedTxt}>Pre-assessed</Text>
                    </View>
                  )}
                </View>

                {/* Assessment Results */}
                {ar && (
                  <View style={s.resultsBox}>
                    <Text style={s.resultsTitle}>📊 Assessment Results</Text>
                    {[
                      { subj: "English",     data: eng  },
                      { subj: "Mathematics", data: math },
                    ].map(({ subj, data: d }) => {
                      if (!d) return null;
                      const perf = perfLabel(d.score);
                      return (
                        <View key={subj} style={s.subjRow}>
                          <View style={s.subjHeader}>
                            <Text style={s.subjName}>{subj === "English" ? "📖" : "🔢"} {subj}</Text>
                            <View style={[s.perfBadge, { backgroundColor: perf.bg }]}>
                              <Text style={[s.perfTxt, { color: perf.color }]}>{perf.label}</Text>
                            </View>
                          </View>
                          {/* Progress bar */}
                          <View style={s.barBg}>
                            <View style={[s.barFill, { width: `${d.score}%` as any, backgroundColor: perf.color }]} />
                          </View>
                          <Text style={s.scoreTxt}>{d.score}% · {d.correct}/{d.total} correct</Text>
                          {d.strengths && d.strengths !== "None identified" && (
                            <Text style={[s.feedbackTxt, { color: GREEN }]}>✓ Strong: {d.strengths}</Text>
                          )}
                          {d.weaknesses && d.weaknesses !== "None detected" && (
                            <Text style={[s.feedbackTxt, { color: CORAL }]}>⚠ Needs work: {d.weaknesses}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
      </ScrollView>

      {/* ── MODAL: Step 1 — Child Form ── */}
      <Modal visible={step === "form"} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Child Profile</Text>
              <TouchableOpacity onPress={resetFlow}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
            </View>
            <View style={s.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
              <Text style={s.infoBannerTxt}>After filling in your child's details, they will take a short <Text style={{ fontWeight: "700" }}>pre-assessment</Text> (English + Mathematics) to help match them with the right tutor.</Text>
            </View>
            <Text style={s.label}>Child's Full Name</Text>
            <TextInput style={s.input} placeholder="e.g. Maria Santos" value={childForm.name} onChangeText={v => setChildForm(f => ({ ...f, name: v }))} />
            <Text style={s.label}>Grade Level</Text>
            <View style={s.gradeRow}>
              {["2","3","4","5","6"].map(g => (
                <TouchableOpacity key={g} style={[s.gradeBtn, childForm.grade_level === g && s.gradeBtnActive]} onPress={() => setChildForm(f => ({ ...f, grade_level: g }))}>
                  <Text style={[s.gradeBtnTxt, childForm.grade_level === g && s.gradeBtnTxtActive]}>Grade {g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Notes (Optional)</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]} placeholder="e.g. Struggles with word problems..." value={childForm.notes} onChangeText={v => setChildForm(f => ({ ...f, notes: v }))} multiline />
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={resetFlow}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.nextBtn} onPress={handleStartAssessment}>
                <Text style={s.nextTxt}>Next: Pre-Assessment →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Step 2 — Assessment ── */}
      <Modal visible={step === "assessing_english" || step === "assessing_mathematics"} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modalBox, { maxHeight: "90%" }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {currentSubj === "english" ? "📖 English" : "🔢 Mathematics"} Assessment
              </Text>
            </View>

            {/* Progress bar */}
            <View style={s.progressRow}>
              <Text style={s.progressTxt}>
                {currentSubj === "english" ? "Subject 1/2" : "Subject 2/2"} · Question {currentQ + 1}/{activeQs.length}
              </Text>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${((currentQ + 1) / Math.max(activeQs.length, 1)) * 100}%` as any, backgroundColor: PRIMARY }]} />
              </View>
            </View>

            {loadingQ ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={{ color: MUTED, marginTop: 12 }}>Loading questions...</Text>
              </View>
            ) : !activeQ ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ color: MUTED }}>No questions available.</Text>
                <TouchableOpacity style={s.nextBtn} onPress={handleSubjectDone}>
                  <Text style={s.nextTxt}>Continue →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.questionTxt}>{activeQ.question_text}</Text>
                {parseOptions(activeQ.options).map((opt: string, idx: number) => {
                  const isSelected = answers[currentSubj][currentQ] === opt;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[s.optionBtn, isSelected && s.optionBtnSelected]}
                      onPress={() => handleAnswer(opt)}
                    >
                      <View style={[s.optionDot, isSelected && s.optionDotSelected]}>
                        <Text style={[s.optionDotTxt, isSelected && { color: "#fff" }]}>
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      </View>
                      <Text style={[s.optionTxt, isSelected && s.optionTxtSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Step 3 — Results ── */}
      <Modal visible={step === "results"} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>🎉 Assessment Complete!</Text>
            </View>
            <Text style={s.resultsSub}>Here are the results for {childForm.name}:</Text>

            {Object.entries(allResults).map(([subj, score]) => {
              const perf = perfLabel(score);
              return (
                <View key={subj} style={s.subjRow}>
                  <View style={s.subjHeader}>
                    <Text style={s.subjName}>{subj === "english" ? "📖 English" : "🔢 Mathematics"}</Text>
                    <View style={[s.perfBadge, { backgroundColor: perf.bg }]}>
                      <Text style={[s.perfTxt, { color: perf.color }]}>{score}% — {perf.label}</Text>
                    </View>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${score}%` as any, backgroundColor: perf.color }]} />
                  </View>
                </View>
              );
            })}

            {/* Strength subjects */}
            {Object.entries(allResults).some(([, sc]) => sc >= 60) && (
              <View style={s.strengthBox}>
                <Text style={s.strengthTxt}>
                  ⭐ <Text style={{ fontWeight: "800" }}>Strength Subjects: </Text>
                  {Object.entries(allResults).filter(([, sc]) => sc >= 60).map(([subj]) => subj.charAt(0).toUpperCase() + subj.slice(1)).join(" & ")}
                </Text>
              </View>
            )}

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={resetFlow}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.nextBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.nextTxt}>Save Profile ✓</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: BG },
  content:          { padding: 16, paddingBottom: 40 },
  topRow:           { flexDirection: "column", marginBottom: 20 },
  heading:          { fontSize: 20, fontWeight: "800", color: DARK },
  sub:              { fontSize: 13, color: MUTED, marginTop: 4 },
  addBtn:           { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, alignSelf: "flex-start" },
  addBtnTxt:        { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty:            { alignItems: "center", marginTop: 60 },
  eIcon:            { fontSize: 48, marginBottom: 12 },
  eTitle:           { fontSize: 16, fontWeight: "700", color: DARK },
  eTxt:             { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 8, lineHeight: 20 },

  // Student card
  card:             { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 14 },
  cardTop:          { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar:           { width: 46, height: 46, borderRadius: 23, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  avatarTxt:        { color: "#fff", fontWeight: "800", fontSize: 18 },
  name:             { fontSize: 15, fontWeight: "700", color: DARK },
  meta:             { fontSize: 12, color: MUTED, marginTop: 2 },
  notes:            { fontSize: 11, color: MUTED, marginTop: 3, fontStyle: "italic" },
  assessedBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GREEN_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  assessedTxt:      { fontSize: 10, color: GREEN, fontWeight: "700" },

  // Results section inside card
  resultsBox:       { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 14, marginTop: 4 },
  resultsTitle:     { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 12 },
  subjRow:          { marginBottom: 14 },
  subjHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  subjName:         { fontSize: 13, fontWeight: "700", color: DARK },
  perfBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  perfTxt:          { fontSize: 11, fontWeight: "700" },
  barBg:            { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  barFill:          { height: 8, borderRadius: 4 },
  scoreTxt:         { fontSize: 11, color: MUTED },
  feedbackTxt:      { fontSize: 11, marginTop: 4 },

  // Modal
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:         { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "85%" },
  modalHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:       { fontSize: 17, fontWeight: "800", color: DARK },
  infoBanner:       { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: PRIMARY_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoBannerTxt:    { fontSize: 12, color: PRIMARY, flex: 1, lineHeight: 18 },
  label:            { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 6, marginTop: 12 },
  input:            { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, fontSize: 14, color: DARK, backgroundColor: "#FAFAFA" },
  gradeRow:         { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff" },
  gradeBtnActive:   { backgroundColor: PRIMARY, borderColor: PRIMARY },
  gradeBtnTxt:      { fontSize: 13, color: MUTED, fontWeight: "600" },
  gradeBtnTxtActive:{ color: "#fff" },
  modalFooter:      { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn:        { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  cancelTxt:        { fontSize: 14, color: MUTED, fontWeight: "600" },
  nextBtn:          { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: PRIMARY, alignItems: "center" },
  nextTxt:          { fontSize: 14, color: "#fff", fontWeight: "700" },

  // Assessment modal
  progressRow:      { marginBottom: 16 },
  progressTxt:      { fontSize: 12, color: MUTED, marginBottom: 6 },
  questionTxt:      { fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 16, lineHeight: 22 },
  optionBtn:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 14, marginBottom: 10, backgroundColor: "#fff" },
  optionBtnSelected:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  optionDot:        { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  optionDotSelected:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
  optionDotTxt:     { fontSize: 12, fontWeight: "700", color: MUTED },
  optionTxt:        { fontSize: 14, color: DARK, flex: 1 },
  optionTxtSelected:{ color: PRIMARY, fontWeight: "600" },

  // Results modal
  resultsSub:       { fontSize: 14, color: MUTED, marginBottom: 16 },
  strengthBox:      { backgroundColor: GREEN_BG, borderRadius: 10, padding: 12, marginTop: 8 },
  strengthTxt:      { fontSize: 13, color: "#065F46", lineHeight: 20 },
});
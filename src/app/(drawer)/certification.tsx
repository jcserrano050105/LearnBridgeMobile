import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Header from "../../components/Header";

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const ORANGE     = "#F59E0B";
const ORANGE_BG  = "#FEF3C7";
const CORAL      = "#EF4444";
const CORAL_BG   = "#FEE2E2";
const GREEN      = "#10B981";
const GREEN_BG   = "#D1FAE5";
const MUTED      = "#6B7280";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";
const BG         = "#F5F7FB";
const CARD       = "#FFFFFF";

const EXAM_MINUTES    = 15;
const TOTAL_QUESTIONS = 10;
const PASS_SCORE      = 75;

const SUBJECTS = [
  { v: "english",     l: "📖 English",    desc: "Grammar, Reading, Communication, Vocabulary, Writing" },
  { v: "mathematics", l: "🔢 Mathematics", desc: "Arithmetic, Fractions, Word Problems, Algebra, Logic"  },
];

async function generateQuestions(subject: string): Promise<any[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured.");

  const prompt = subject === "english"
    ? `Generate ${TOTAL_QUESTIONS} multiple-choice certification exam questions for a Grade 2-6 English tutor. Topics: Grammar, Communication, Reading Comprehension, Vocabulary, Writing Skills. Each question must be at a professional/college level testing deep subject knowledge. Return ONLY a JSON array with objects: { question, options: [4 strings], correct: 0-based index }. No markdown.`
    : `Generate ${TOTAL_QUESTIONS} multiple-choice certification exam questions for a Grade 2-6 Mathematics tutor. Topics: Arithmetic, Fractions and Decimals, Word Problems, Basic Algebra, Logical Reasoning. Each question must be at a professional/college level. Return ONLY a JSON array with objects: { question, options: [4 strings], correct: 0-based index }. No markdown.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini", max_tokens: 3000, temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned).slice(0, TOTAL_QUESTIONS);
}

export default function CertificationScreen() {
  const { user } = useAuth() as any;

  const [phase,          setPhase]          = useState<"idle"|"loading"|"exam"|"result">("idle");
  const [subject,        setSubject]        = useState("english");
  const [questions,      setQuestions]      = useState<any[]>([]);
  const [current,        setCurrent]        = useState(0);
  const [answers,        setAnswers]        = useState<Record<number, number>>({});
  const [timeLeft,       setTimeLeft]       = useState(EXAM_MINUTES * 60);
  const [genError,       setGenError]       = useState("");
  const [result,         setResult]         = useState<any>(null);
  const [saving,         setSaving]         = useState(false);
  const [existingScores, setExistingScores] = useState<Record<string, any>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load existing scores ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("tutors").select("certification_scores").eq("id", user.id).single()
      .then(({ data }) => setExistingScores(data?.certification_scores || {}));
  }, [user]);

  // ── Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const fmt = (secs: number) =>
    `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  // ── Start exam ────────────────────────────────────────────────────
  const handleStart = async () => {
    setPhase("loading");
    setGenError("");
    setAnswers({});
    setCurrent(0);
    setTimeLeft(EXAM_MINUTES * 60);
    try {
      const qs = await generateQuestions(subject);
      setQuestions(qs);
      setPhase("exam");
    } catch (e: any) {
      setGenError(e.message);
      setPhase("idle");
    }
  };

  // ── Submit exam ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (phase !== "exam") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("result");

    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const scorePercent = Math.round((correct / questions.length) * 100);
    const passed       = scorePercent >= PASS_SCORE;
    const resultData   = { score: scorePercent, correct, total: questions.length, passed, subject };
    setResult(resultData);

    if (passed) {
      setSaving(true);
      try {
        const newScores = {
          ...existingScores,
          [subject]: { score: scorePercent, passed: true, date: new Date().toISOString() },
        };
        await supabase.from("tutors").update({ certification_scores: newScores }).eq("id", user.id);
        setExistingScores(newScores);
      } catch (e: any) {
        console.error("Failed to save score:", e.message);
      } finally {
        setSaving(false);
      }
    }
  }, [phase, questions, answers, subject, existingScores, user]);

  const handleReset = () => {
    setPhase("idle");
    setQuestions([]);
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setGenError("");
  };

  // ── LOADING ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Certification" />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={s.loadingTxt}>Generating your exam questions with AI...</Text>
        </View>
      </View>
    );
  }

  // ── EXAM ──────────────────────────────────────────────────────────
  if (phase === "exam") {
    const q       = questions[current];
    const LETTERS = ["A", "B", "C", "D"];
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Certification Exam" />

        <View style={s.examTop}>
          <Text style={s.examProgress}>Question {current + 1} / {questions.length}</Text>
          <View style={[s.timerBadge, timeLeft < 300 && { backgroundColor: CORAL_BG }]}>
            <Ionicons name="time-outline" size={14} color={timeLeft < 300 ? CORAL : PRIMARY} />
            <Text style={[s.timerTxt, timeLeft < 300 && { color: CORAL }]}>{fmt(timeLeft)}</Text>
          </View>
        </View>

        <View style={s.examBar}>
          <View style={[s.examBarFill, { width: `${((current + 1) / questions.length) * 100}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={s.examContent}>
          <Text style={s.questionTxt}>{q?.question}</Text>
          {q?.options?.map((opt: string, i: number) => {
            const isSelected = answers[current] === i;
            return (
              <TouchableOpacity
                key={i}
                style={[s.optionBtn, isSelected && s.optionBtnActive]}
                onPress={() => setAnswers(prev => ({ ...prev, [current]: i }))}
              >
                <View style={[s.optLetter, isSelected && s.optLetterActive]}>
                  <Text style={[s.optLetterTxt, isSelected && { color: "#fff" }]}>{LETTERS[i]}</Text>
                </View>
                <Text style={[s.optTxt, isSelected && { color: PRIMARY, fontWeight: "600" }]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.examNav}>
          <TouchableOpacity
            style={[s.navBtn, s.navBtnOutline, current === 0 && { opacity: 0.4 }]}
            onPress={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            <Ionicons name="chevron-back" size={18} color={PRIMARY} />
            <Text style={s.navBtnOutlineTxt}>Previous</Text>
          </TouchableOpacity>

          {current < questions.length - 1 ? (
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
            >
              <Text style={s.navBtnTxt}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.navBtn, { backgroundColor: GREEN }]} onPress={handleSubmit}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={s.navBtnTxt}>Submit Exam</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return (
      <View style={s.container}>
        <Header title="LearnBridge" subtitle="Exam Result" />
        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.resultCard, { borderColor: result.passed ? GREEN : CORAL }]}>
            <Text style={s.resultEmoji}>{result.passed ? "🎓" : "📓"}</Text>
            <Text style={s.resultTitle}>{result.passed ? "Congratulations!" : "Not Passed"}</Text>
            <Text style={s.resultSub}>
              {result.passed
                ? "You passed the certification exam!"
                : `You need ${PASS_SCORE}% to pass. Try again!`}
            </Text>

            <View style={s.resultStats}>
              <View style={s.resultStat}>
                <Text style={[s.resultStatVal, { color: result.passed ? GREEN : CORAL }]}>{result.score}%</Text>
                <Text style={s.resultStatLabel}>Score</Text>
              </View>
              <View style={s.resultStat}>
                <Text style={s.resultStatVal}>{result.correct}/{result.total}</Text>
                <Text style={s.resultStatLabel}>Correct</Text>
              </View>
              <View style={s.resultStat}>
                <Text style={[s.resultStatVal, { color: PRIMARY }]}>{PASS_SCORE}%</Text>
                <Text style={s.resultStatLabel}>Pass Mark</Text>
              </View>
            </View>

            <View style={s.scoreBar}>
              <View style={[s.scoreBarFill, {
                width: `${result.score}%` as any,
                backgroundColor: result.passed ? GREEN : CORAL,
              }]} />
            </View>
          </View>

          {saving && (
            <View style={s.savingRow}>
              <ActivityIndicator size="small" color={PRIMARY} />
              <Text style={{ color: MUTED, fontSize: 13 }}>Saving your score...</Text>
            </View>
          )}

          <TouchableOpacity style={s.retakeBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color={PRIMARY} />
            <Text style={s.retakeTxt}>Take Another Exam</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── IDLE ──────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Certification" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>AI Certification Exam</Text>
        <Text style={s.sub}>Pass the exam (75%+) to become fully certified on LearnBridge.</Text>

        <View style={s.warningBanner}>
          <Ionicons name="warning-outline" size={16} color={ORANGE} />
          <Text style={s.warningTxt}>
            A score of {PASS_SCORE}% or higher is required. Questions are at a professional/college level.
          </Text>
        </View>

        {genError !== "" && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={CORAL} />
            <Text style={s.errorTxt}>{genError}</Text>
          </View>
        )}

        {/* Existing scores */}
        {Object.keys(existingScores).length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your Certification Scores</Text>
            {Object.entries(existingScores).map(([subj, data]: [string, any]) => (
              <View key={subj} style={s.scoreRow}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={s.scoreSubject}>{subj === "english" ? "📖 English" : "🔢 Mathematics"}</Text>
                  <View style={[s.scorePill, { backgroundColor: data.passed ? GREEN_BG : CORAL_BG }]}>
                    <Text style={[s.scorePillTxt, { color: data.passed ? GREEN : CORAL }]}>
                      {data.score}% — {data.passed ? "✓ Passed" : "✗ Failed"}
                    </Text>
                  </View>
                </View>
                <View style={s.scoreBarBg}>
                  <View style={[s.scoreBarFg, {
                    width: `${data.score}%` as any,
                    backgroundColor: data.passed ? GREEN : CORAL,
                  }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Exam card */}
        <View style={s.card}>
          <View style={s.examCardTop}>
            <Text style={s.examCardTitle}>Take the AI Certification Exam</Text>
            <Text style={s.examCardSub}>
              {EXAM_MINUTES} minutes · {TOTAL_QUESTIONS} questions · {PASS_SCORE}% to pass
            </Text>
          </View>

          <Text style={s.fieldLabel}>Select Subject</Text>
          <View style={s.subjectRow}>
            {SUBJECTS.map(sub => (
              <TouchableOpacity
                key={sub.v}
                style={[s.subjectBtn, subject === sub.v && s.subjectBtnActive]}
                onPress={() => setSubject(sub.v)}
              >
                <Text style={[s.subjectBtnTxt, subject === sub.v && { color: PRIMARY, fontWeight: "700" }]}>
                  {sub.l}
                </Text>
                <Text style={s.subjectBtnDesc}>{sub.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.startBtn} onPress={handleStart}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.startBtnTxt}>Start Exam</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "transparent" },
  content:     { padding: 16, paddingBottom: 80 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingTxt:  { fontSize: 14, color: MUTED, textAlign: "center", marginTop: 12 },
  heading:     { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  sub:         { fontSize: 13, color: MUTED, marginBottom: 16 },

  warningBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: ORANGE_BG, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#FCD34D" },
  warningTxt:    { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17 },
  errorBanner:   { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: CORAL_BG, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:      { flex: 1, fontSize: 12, color: CORAL, lineHeight: 17 },

  card:      { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 14 },

  scoreRow:      { marginBottom: 14 },
  scoreSubject:  { fontSize: 13, fontWeight: "600", color: DARK },
  scorePill:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  scorePillTxt:  { fontSize: 11, fontWeight: "700" },
  scoreBarBg:    { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  scoreBarFg:    { height: 8, borderRadius: 4 },

  examCardTop:    { alignItems: "center", marginBottom: 20 },
  examCardTitle:  { fontSize: 18, fontWeight: "800", color: DARK, textAlign: "center" },
  examCardSub:    { fontSize: 13, color: MUTED, marginTop: 4, textAlign: "center" },
  fieldLabel:     { fontSize: 12, fontWeight: "700", color: DARK, marginBottom: 8 },
  subjectRow:     { gap: 10, marginBottom: 20 },
  subjectBtn:     { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F9FAFB" },
  subjectBtnActive:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  subjectBtnTxt:  { fontSize: 15, color: MUTED, fontWeight: "500" },
  subjectBtnDesc: { fontSize: 11, color: MUTED, marginTop: 3 },
  startBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12 },
  startBtnTxt:    { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Exam phase
  examTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  examProgress: { fontSize: 14, fontWeight: "700", color: DARK },
  timerBadge:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PRIMARY_BG, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  timerTxt:     { fontSize: 14, fontWeight: "800", color: PRIMARY },
  examBar:      { height: 4, backgroundColor: "#E5E7EB" },
  examBarFill:  { height: 4, backgroundColor: PRIMARY },
  examContent:  { padding: 20, paddingBottom: 120 },
  questionTxt:  { fontSize: 16, fontWeight: "700", color: DARK, lineHeight: 24, marginBottom: 20 },
  optionBtn:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: CARD, marginBottom: 10 },
  optionBtnActive:{ borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  optLetter:    { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  optLetterActive:{ backgroundColor: PRIMARY },
  optLetterTxt: { fontSize: 13, fontWeight: "700", color: DARK },
  optTxt:       { flex: 1, fontSize: 14, color: DARK, lineHeight: 20 },
  examNav:      { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 16, backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER },
  navBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY },
  navBtnTxt:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  navBtnOutline:{ backgroundColor: "transparent", borderWidth: 1.5, borderColor: PRIMARY },
  navBtnOutlineTxt: { fontSize: 14, fontWeight: "700", color: PRIMARY },

  // Result phase
  resultCard:      { backgroundColor: CARD, borderRadius: 16, borderWidth: 2, padding: 24, alignItems: "center", marginBottom: 20 },
  resultEmoji:     { fontSize: 48, marginBottom: 12 },
  resultTitle:     { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 4 },
  resultSub:       { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 20 },
  resultStats:     { flexDirection: "row", gap: 20, marginBottom: 20 },
  resultStat:      { alignItems: "center" },
  resultStatVal:   { fontSize: 24, fontWeight: "800", color: DARK },
  resultStatLabel: { fontSize: 11, color: MUTED, marginTop: 2 },
  scoreBar:        { width: "100%", height: 10, backgroundColor: "#E5E7EB", borderRadius: 5, overflow: "hidden" },
  scoreBarFill:    { height: 10, borderRadius: 5 },
  savingRow:       { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 16 },
  retakeBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  retakeTxt:       { color: PRIMARY, fontSize: 14, fontWeight: "700" },
});
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

// Quiz pieces mirroring the website:
//  • QuizFormModal       — create/edit a quiz (tutor SessionsPage saveQuiz)
//  • QuestionEditorModal — add/remove questions (tutor SessionsPage addQuestion/deleteQuestion)
//  • TakeQuizModal       — answer + submit (ParentSessionsPage openQuiz/submitQuiz)
// Tables: session_quizzes, quiz_questions, student_quiz_attempts.

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const MID        = "#374151";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";

export const QUIZ_TYPES = [
  { value: "formative",  label: "📝 Formative",       short: "FA",  color: "#6366F1", bg: "#EEF2FF" },
  { value: "summative",  label: "📊 Summative",       short: "SA",  color: "#059669", bg: "#ECFDF5" },
  { value: "practice",   label: "🎯 Practice",        short: "PQ",  color: "#D97706", bg: "#FFFBEB" },
  { value: "activity",   label: "🏃 Activity",        short: "ACT", color: "#BE185D", bg: "#FDF2F8" },
  { value: "checkpoint", label: "🔖 Checkpoint Exam", short: "CE",  color: "#DC2626", bg: "#FEE2E2" },
  { value: "short_quiz", label: "⚡ Short Quiz",      short: "SQ",  color: "#0891B2", bg: "#E0F2FE" },
];

export function quizType(v: string) {
  return QUIZ_TYPES.find(t => t.value === v) || QUIZ_TYPES[0];
}

// ═══════════════════════════════════════════════════════════════════
// Create / edit quiz
// ═══════════════════════════════════════════════════════════════════
type QuizFormProps = {
  target: { module: any; subtopic?: any; quiz?: any } | null;
  bookingId: string;
  tutorId?: string;
  onClose: () => void;
  onSaved: (created: any | null, msg: string) => void;   // created = new quiz row (to open the question editor)
  onError: (msg: string) => void;
};

export function QuizFormModal({ target, bookingId, tutorId, onClose, onSaved, onError }: QuizFormProps) {
  const [form, setForm] = useState({ title: "", quiz_type: "formative", instructions: "", pass_score: "75", max_attempts: "10", time_limit: "0" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = target?.quiz;
    setForm({
      title:        q?.title || "",
      quiz_type:    q?.quiz_type || "formative",
      instructions: q?.instructions || "",
      pass_score:   String(q?.pass_score ?? 75),
      max_attempts: String(q?.max_attempts ?? 10),
      time_limit:   String(q?.time_limit ?? 0),
    });
  }, [target]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!target) return;
    if (!form.title.trim()) { onError("Quiz title is required."); return; }
    setSaving(true);
    try {
      const payload = {
        booking_id:   bookingId,
        tutor_id:     tutorId,
        module_id:    target.module.id,
        subtopic_id:  target.subtopic?.id || null,
        title:        form.title,
        quiz_type:    form.quiz_type,
        instructions: form.instructions || null,
        pass_score:   Number(form.pass_score) || 75,
        max_attempts: Number(form.max_attempts) || 10,
        time_limit:   Number(form.time_limit) || 0,
        order_num:    target.module.quizzes?.length || 0,
        status:       "draft",
      };
      if (target.quiz) {
        const { error } = await supabase.from("session_quizzes").update(payload).eq("id", target.quiz.id);
        if (error) { onError(`Failed: ${error.message}`); return; }
        onSaved(null, "Quiz updated!");
      } else {
        const { data, error } = await supabase.from("session_quizzes").insert(payload).select().single();
        if (error) { onError(`Failed: ${error.message}`); return; }
        onSaved(data, "Quiz created! Now add questions.");
      }
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { maxHeight: "90%" }]}>
          <Text style={s.sheetTitle}>{target?.quiz ? "✏️ Edit Quiz" : "➕ New Quiz"}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Quiz title *</Text>
            <TextInput style={s.input} value={form.title} onChangeText={v => set("title", v)} placeholder="e.g. Fractions Check" placeholderTextColor={MUTED} />

            <Text style={s.label}>Quiz type</Text>
            <View style={s.chips}>
              {QUIZ_TYPES.map(t => {
                const on = form.quiz_type === t.value;
                return (
                  <TouchableOpacity key={t.value} onPress={() => set("quiz_type", t.value)}
                    style={[s.chip, { borderColor: on ? t.color : BORDER, backgroundColor: on ? t.bg : "#fff" }]}>
                    <Text style={[s.chipTxt, { color: on ? t.color : MUTED }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.label}>Instructions</Text>
            <TextInput style={[s.input, s.area]} value={form.instructions} onChangeText={v => set("instructions", v)} placeholder="Read each question carefully..." placeholderTextColor={MUTED} multiline />

            <View style={{ flexDirection: "row", gap: 8 }}>
              {([["pass_score", "Pass score (%)"], ["max_attempts", "Max attempts"], ["time_limit", "Time limit (min, 0 = none)"]] as const).map(([k, l]) => (
                <View key={k} style={{ flex: 1 }}>
                  <Text style={s.label} numberOfLines={2}>{l}</Text>
                  <TextInput style={s.input} value={(form as any)[k]} onChangeText={v => set(k, v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
                </View>
              ))}
            </View>
          </ScrollView>
          <Footer saving={saving} onCancel={onClose} onSave={save} />
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Question editor (tutor)
// ═══════════════════════════════════════════════════════════════════
const EMPTY_Q = { question_text: "", question_type: "multiple_choice", options: ["", "", "", ""], correct_index: 0, points: "1" };

export function QuestionEditorModal({ quiz, onClose }: { quiz: any | null; onClose: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [newQ,      setNewQ]      = useState<any>(EMPTY_Q);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<{ t: string; err?: boolean } | null>(null);

  const flash = (t: string, err = false) => { setMsg({ t, err }); setTimeout(() => setMsg(null), 3000); };

  const fetchQuestions = async (quizId: string) => {
    setLoading(true);
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_num");
    setQuestions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!quiz) return;
    setNewQ(EMPTY_Q); setMsg(null);
    fetchQuestions(quiz.id);
  }, [quiz?.id]);

  const addQuestion = async () => {
    if (!newQ.question_text.trim()) { flash("Question is required.", true); return; }
    if (newQ.question_type === "multiple_choice" && newQ.options.some((o: string) => !o.trim())) { flash("Fill in all 4 options.", true); return; }
    setSaving(true);
    try {
      const opts = newQ.question_type === "true_false" ? ["True", "False"] : newQ.options;
      const { error } = await supabase.from("quiz_questions").insert({
        quiz_id:       quiz.id,
        question_text: newQ.question_text,
        question_type: newQ.question_type,
        options:       opts,
        correct_index: newQ.correct_index,
        points:        Number(newQ.points) || 1,
        order_num:     questions.length,
      });
      if (error) { flash(`Failed: ${error.message}`, true); return; }
      setNewQ(EMPTY_Q);
      await fetchQuestions(quiz.id);
      flash("Question added!");
    } finally { setSaving(false); }
  };

  const deleteQuestion = async (qId: string) => {
    await supabase.from("quiz_questions").delete().eq("id", qId);
    await fetchQuestions(quiz.id);
    flash("Question removed.");
  };

  const opts = newQ.question_type === "true_false" ? ["True", "False"] : newQ.options;

  return (
    <Modal visible={!!quiz} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { maxHeight: "92%" }]}>
          <View style={s.sheetHead}>
            <Text style={[s.sheetTitle, { marginBottom: 0, flex: 1 }]} numberOfLines={1}>📝 {quiz?.title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
          </View>

          {msg && <Text style={[s.msg, { color: msg.err ? "#DC2626" : "#065F46", backgroundColor: msg.err ? "#FEE2E2" : "#D1FAE5" }]}>{msg.t}</Text>}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.section}>Questions ({questions.length})</Text>
            {loading ? <ActivityIndicator color={PRIMARY} /> : questions.length === 0 ? (
              <Text style={s.muted}>No questions yet — add one below.</Text>
            ) : questions.map((q, i) => (
              <View key={q.id} style={s.qCard}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={s.qText}>{i + 1}. {q.question_text}</Text>
                  <TouchableOpacity onPress={() => deleteQuestion(q.id)}><Ionicons name="trash-outline" size={16} color="#DC2626" /></TouchableOpacity>
                </View>
                {(q.options || []).map((o: string, oi: number) => (
                  <Text key={oi} style={[s.qOpt, oi === q.correct_index && s.qOptRight]}>
                    {oi === q.correct_index ? "✓ " : "• "}{o}
                  </Text>
                ))}
                <Text style={s.muted}>{q.points || 1} pt{(q.points || 1) !== 1 ? "s" : ""}</Text>
              </View>
            ))}

            {/* Add question */}
            <Text style={[s.section, { marginTop: 14 }]}>➕ Add Question</Text>
            <View style={s.chips}>
              {[["multiple_choice", "Multiple choice"], ["true_false", "True / False"]].map(([v, l]) => {
                const on = newQ.question_type === v;
                return (
                  <TouchableOpacity key={v} onPress={() => setNewQ((q: any) => ({ ...q, question_type: v, correct_index: 0 }))}
                    style={[s.chip, on && { borderColor: PRIMARY, backgroundColor: PRIMARY_BG }]}>
                    <Text style={[s.chipTxt, on && { color: PRIMARY }]}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput style={[s.input, s.area]} value={newQ.question_text} onChangeText={v => setNewQ((q: any) => ({ ...q, question_text: v }))} placeholder="Type the question..." placeholderTextColor={MUTED} multiline />

            <Text style={s.label}>Options — tap the circle to mark the correct answer</Text>
            {opts.map((o: string, i: number) => {
              const right = newQ.correct_index === i;
              return (
                <View key={i} style={s.optRow}>
                  <TouchableOpacity onPress={() => setNewQ((q: any) => ({ ...q, correct_index: i }))}>
                    <Ionicons name={right ? "radio-button-on" : "radio-button-off"} size={22} color={right ? "#059669" : MUTED} />
                  </TouchableOpacity>
                  {newQ.question_type === "true_false" ? (
                    <Text style={[s.optStatic, right && { color: "#059669", fontWeight: "700" }]}>{o}</Text>
                  ) : (
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      value={o}
                      onChangeText={v => setNewQ((q: any) => { const n = [...q.options]; n[i] = v; return { ...q, options: n }; })}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      placeholderTextColor={MUTED}
                    />
                  )}
                </View>
              );
            })}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
              <Text style={s.label}>Points</Text>
              <TextInput style={[s.input, { width: 70, marginBottom: 0 }]} value={newQ.points} onChangeText={v => setNewQ((q: any) => ({ ...q, points: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
            </View>

            <TouchableOpacity style={[s.primaryBtn, { marginTop: 14 }, saving && { opacity: 0.6 }]} onPress={addQuestion} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryTxt}>+ Add Question</Text>}
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeTxt}>Done</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Take quiz (parent / student)
// ═══════════════════════════════════════════════════════════════════
type TakeProps = {
  quiz: any | null;
  questions: any[];
  studentId: string;
  parentId: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export function TakeQuizModal({ quiz, questions, studentId, parentId, onClose, onSubmitted }: TakeProps) {
  const [answers,    setAnswers]    = useState<Record<number, number>>({});
  const [result,     setResult]     = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missing,    setMissing]    = useState(false);
  const [error,      setError]      = useState("");
  const [timeLeft,   setTimeLeft]   = useState<number | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (!quiz) return;
    setAnswers({}); setResult(null); setMissing(false); setError("");
    setTimeLeft(quiz.time_limit > 0 ? quiz.time_limit * 60 : null);
  }, [quiz?.id]);

  // Countdown — auto-submit at 0 (website behaviour)
  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) { submit(true); return; }
    const t = setTimeout(() => setTimeLeft(x => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, result]);

  const submit = async (timeUp = false) => {
    const ans = answersRef.current;
    if (!timeUp && Object.keys(ans).length < questions.length) {
      setMissing(true); setError("Please answer all questions before submitting."); return;
    }
    setSubmitting(true); setError("");
    try {
      let correct = 0;
      questions.forEach((q, i) => { if (ans[i] === q.correct_index) correct++; });
      const score  = Math.round((correct / questions.length) * 100);
      const passed = score >= quiz.pass_score;

      const { count } = await supabase
        .from("student_quiz_attempts")
        .select("*", { count: "exact", head: true })
        .eq("quiz_id", quiz.id)
        .eq("student_id", studentId);
      const attemptNum = (count || 0) + 1;

      const { error: insErr } = await supabase.from("student_quiz_attempts").insert({
        quiz_id:      quiz.id,
        student_id:   studentId,
        parent_id:    parentId,
        score,
        passed,
        answers:      ans,
        attempt_num:  attemptNum,
        submitted_at: new Date().toISOString(),
      });
      if (insErr) { setError(`Failed to save: ${insErr.message}`); return; }

      setResult({ score, passed, correct, total: questions.length, attemptNum });
      setTimeLeft(null);
      onSubmitted();
    } finally { setSubmitting(false); }
  };

  const mm = timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}` : "";
  const qt = quiz ? quizType(quiz.quiz_type) : QUIZ_TYPES[0];

  return (
    <Modal visible={!!quiz} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { maxHeight: "94%" }]}>
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sheetTitle, { marginBottom: 2 }]} numberOfLines={1}>{quiz?.title}</Text>
              <Text style={[s.muted, { color: qt.color }]}>{qt.label} · Pass: {quiz?.pass_score}%</Text>
            </View>
            {timeLeft !== null && !result && (
              <View style={[s.timer, timeLeft < 60 && { backgroundColor: "#FEE2E2" }]}>
                <Text style={[s.timerTxt, timeLeft < 60 && { color: "#DC2626" }]}>⏱ {mm}</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 8 }}><Ionicons name="close" size={22} color={MUTED} /></TouchableOpacity>
          </View>

          {result ? (
            <View style={[s.result, { backgroundColor: result.passed ? "#D1FAE5" : "#FEE2E2" }]}>
              <Text style={{ fontSize: 48 }}>{result.passed ? "🎉" : "📚"}</Text>
              <Text style={[s.resultScore, { color: result.passed ? "#065F46" : "#DC2626" }]}>{result.score}%</Text>
              <Text style={[s.resultTxt, { color: result.passed ? "#065F46" : "#DC2626" }]}>
                {result.passed ? "Passed!" : "Not passed yet"} · {result.correct}/{result.total} correct
              </Text>
              <Text style={s.muted}>Attempt {result.attemptNum} of {quiz?.max_attempts}</Text>
              <TouchableOpacity style={[s.primaryBtn, { alignSelf: "stretch", marginTop: 16 }]} onPress={onClose}>
                <Text style={s.primaryTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                {!!quiz?.instructions && <Text style={s.instructions}>{quiz.instructions}</Text>}
                {questions.map((q, i) => {
                  const unanswered = missing && ans(i) === undefined;
                  return (
                    <View key={q.id} style={[s.qCard, unanswered && { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]}>
                      <Text style={s.qText}>{i + 1}. {q.question_text}</Text>
                      {(q.options || []).map((o: string, oi: number) => {
                        const on = answers[i] === oi;
                        return (
                          <TouchableOpacity key={oi} style={[s.ansBtn, on && s.ansBtnOn]} onPress={() => setAnswers(a => ({ ...a, [i]: oi }))}>
                            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? PRIMARY : MUTED} />
                            <Text style={[s.ansTxt, on && { color: PRIMARY, fontWeight: "700" }]}>{o}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
              {!!error && <Text style={[s.msg, { color: "#DC2626", backgroundColor: "#FEE2E2" }]}>{error}</Text>}
              <View style={s.footer}>
                <Text style={[s.muted, { flex: 1 }]}>{Object.keys(answers).length}/{questions.length} answered</Text>
                <TouchableOpacity style={[s.primaryBtn, { paddingHorizontal: 24 }, submitting && { opacity: 0.6 }]} onPress={() => submit(false)} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryTxt}>Submit Quiz</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  function ans(i: number) { return answers[i]; }
}

function Footer({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <View style={s.footer}>
      <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={saving}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
      <TouchableOpacity style={[s.primaryBtn, { flex: 2 }, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryTxt}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetHead:  { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: DARK, marginBottom: 14 },
  label:      { fontSize: 12, fontWeight: "700", color: DARK, marginBottom: 6 },
  input:      { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 12 },
  area:       { height: 80, textAlignVertical: "top" },
  chips:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipTxt:    { fontSize: 12, fontWeight: "700", color: MUTED },
  section:    { fontSize: 14, fontWeight: "800", color: DARK, marginBottom: 8 },
  muted:      { fontSize: 12, color: MUTED },
  msg:        { fontSize: 12, fontWeight: "600", borderRadius: 8, padding: 10, marginBottom: 10 },

  qCard:     { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: "#fff" },
  qText:     { flex: 1, fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 8, lineHeight: 20 },
  qOpt:      { fontSize: 13, color: MID, marginBottom: 3 },
  qOptRight: { color: "#059669", fontWeight: "700" },
  optRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  optStatic: { fontSize: 14, color: MID },

  instructions: { fontSize: 13, color: MID, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 12, lineHeight: 19 },
  ansBtn:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 10, marginBottom: 6 },
  ansBtnOn:  { borderColor: PRIMARY, backgroundColor: PRIMARY_BG },
  ansTxt:    { flex: 1, fontSize: 13, color: MID },
  timer:     { backgroundColor: PRIMARY_BG, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  timerTxt:  { fontSize: 13, fontWeight: "800", color: PRIMARY },

  result:      { alignItems: "center", borderRadius: 14, padding: 24 },
  resultScore: { fontSize: 40, fontWeight: "900", marginTop: 6 },
  resultTxt:   { fontSize: 15, fontWeight: "700", marginBottom: 4 },

  footer:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  cancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  cancelTxt:  { fontSize: 14, color: MUTED, fontWeight: "600" },
  primaryBtn: { paddingVertical: 13, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  primaryTxt: { fontSize: 14, color: "#fff", fontWeight: "700" },
  closeBtn:   { marginTop: 10, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  closeTxt:   { fontSize: 14, color: MUTED, fontWeight: "600" },
});

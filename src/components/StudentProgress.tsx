import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "../lib/supabase";
import { quizType } from "./QuizModals";

// Tutor "📊 Student Progress" tab — mirrors the progress tab in the website's tutor SessionsPage.jsx:
// per session, every quiz with best score, pass mark bar and all attempts; plus materials opened.

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function StudentProgress({ bookingId }: { bookingId: string }) {
  const [modules,  setModules]  = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [views,    setViews]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: mods } = await supabase.from("session_modules").select("*").eq("booking_id", bookingId).order("module_number");
    if (!mods || mods.length === 0) { setModules([]); setLoading(false); return; }
    const modIds = mods.map((m: any) => m.id);
    const [{ data: subs }, { data: mats }, { data: quizzes }] = await Promise.all([
      supabase.from("module_subtopics").select("*").in("module_id", modIds).order("subtopic_number"),
      supabase.from("module_materials").select("*").in("module_id", modIds).order("order_num"),
      supabase.from("session_quizzes").select("*").in("module_id", modIds).order("order_num"),
    ]);
    const quizIds = (quizzes || []).map((q: any) => q.id);
    const matIds  = (mats || []).map((m: any) => m.id);
    const [aRes, vRes] = await Promise.all([
      quizIds.length ? supabase.from("student_quiz_attempts").select("*, student:student_id(name,grade_level)").in("quiz_id", quizIds).order("submitted_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      matIds.length  ? supabase.from("student_material_views").select("*, student:student_id(name)").in("material_id", matIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    setAttempts(aRes.data || []);
    setViews(vRes.data || []);
    setModules(mods.map((mod: any) => {
      const modSubs = (subs || []).filter((x: any) => x.module_id === mod.id);
      return {
        ...mod,
        // module-level quizzes + subtopic quizzes (website combines both)
        allQuizzes: [
          ...(quizzes || []).filter((q: any) => q.module_id === mod.id && !q.subtopic_id).map((q: any) => ({ ...q, subtopicName: null })),
          ...modSubs.flatMap((sub: any) => (quizzes || []).filter((q: any) => q.subtopic_id === sub.id).map((q: any) => ({ ...q, subtopicName: sub.title }))),
        ],
        allMaterials: (mats || []).filter((m: any) => m.module_id === mod.id),
      };
    }));
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 24 }} />;

  if (attempts.length === 0 && views.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={{ fontSize: 44, marginBottom: 10 }}>📊</Text>
        <Text style={s.emptyTitle}>No activity yet</Text>
        <Text style={s.muted}>The student hasn't opened any materials or taken any quizzes yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {modules.map(mod => {
        if (mod.allQuizzes.length === 0) return null;
        return (
          <View key={mod.id} style={s.card}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Session {mod.module_number}: {mod.title}</Text></View>
            <View style={{ padding: 12 }}>
              {mod.allQuizzes.map((quiz: any, qi: number) => {
                const list = attempts.filter(a => a.quiz_id === quiz.id);
                const best = list.reduce((b: any, a: any) => (!b || a.score > b.score ? a : b), null);
                const qt   = quizType(quiz.quiz_type);
                return (
                  <View key={quiz.id} style={[s.quiz, qi === mod.allQuizzes.length - 1 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
                    <View style={s.quizHead}>
                      <View style={[s.badge, { backgroundColor: qt.bg }]}><Text style={[s.badgeTxt, { color: qt.color }]}>{qt.short}</Text></View>
                      <Text style={s.quizTitle}>{quiz.title}</Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {!!quiz.subtopicName && <Text style={s.subTag}>📌 {quiz.subtopicName}</Text>}
                      <Text style={s.muted}>Pass: {quiz.pass_score}% · Max {quiz.max_attempts} attempts</Text>
                    </View>

                    {list.length === 0 ? (
                      <Text style={[s.muted, { fontStyle: "italic" }]}>No attempts yet</Text>
                    ) : (
                      <>
                        <View style={[s.best, { backgroundColor: best.passed ? "#F0FDF4" : "#FEF9C3", borderColor: best.passed ? "#6EE7B7" : "#FDE68A" }]}>
                          <View style={[s.scoreDot, { backgroundColor: best.passed ? "#10B981" : "#F59E0B" }]}>
                            <Text style={s.scoreDotTxt}>{best.score}%</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.bestTitle, { color: best.passed ? "#065F46" : "#92400E" }]}>{best.passed ? "✅ Passed" : "⚠️ Not Yet Passed"}</Text>
                            <Text style={s.muted}>Best score · {list.length} attempt{list.length !== 1 ? "s" : ""} · Student: {best.student?.name || "—"}</Text>
                            <View style={s.bar}>
                              <View style={[s.barFill, { width: `${best.score}%`, backgroundColor: best.passed ? "#10B981" : "#F59E0B" }]} />
                              <View style={[s.passMark, { left: `${quiz.pass_score}%` }]} />
                            </View>
                            <Text style={[s.muted, { fontSize: 10 }]}>{quiz.pass_score}% pass mark</Text>
                          </View>
                        </View>
                        {list.map(a => (
                          <View key={a.id} style={s.attempt}>
                            <Text style={s.attemptNum}>Attempt {a.attempt_num}</Text>
                            <Text style={[s.attemptScore, { color: a.passed ? "#065F46" : "#DC2626" }]}>{a.score}% {a.passed ? "✓ Passed" : "✗ Failed"}</Text>
                            <Text style={[s.muted, { marginLeft: "auto" }]}>{fmt(a.submitted_at)}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {views.length > 0 && (
        <View style={s.card}>
          <View style={[s.cardHead, { backgroundColor: "#F0FDF4" }]}><Text style={s.cardTitle}>📂 Materials Opened by Student</Text></View>
          <View style={{ padding: 12 }}>
            {modules.map(mod => {
              const seen = mod.allMaterials.filter((m: any) => views.some(v => v.material_id === m.id));
              if (seen.length === 0) return null;
              return (
                <View key={mod.id} style={{ marginBottom: 10 }}>
                  <Text style={s.groupLbl}>Session {mod.module_number}: {mod.title}</Text>
                  {seen.map((m: any) => {
                    const v = views.find(x => x.material_id === m.id);
                    return (
                      <View key={m.id} style={s.attempt}>
                        <Text style={{ color: "#065F46" }}>✓</Text>
                        <Text style={[s.attemptNum, { flex: 1, color: DARK }]}>{m.title}</Text>
                        <Text style={s.muted}>{v?.student?.name || "Student"} · {fmt(v?.viewed_at)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  empty:      { alignItems: "center", padding: 28, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 4 },
  muted:      { fontSize: 11, color: MUTED },
  card:       { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  cardHead:   { backgroundColor: "#EBEBFF", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  cardTitle:  { fontSize: 14, fontWeight: "700", color: DARK },
  quiz:       { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  quizHead:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  quizTitle:  { flex: 1, fontSize: 13, fontWeight: "600", color: DARK },
  badge:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt:   { fontSize: 10, fontWeight: "800" },
  subTag:     { fontSize: 11, fontWeight: "600", color: "#0891B2", backgroundColor: "#E0F2FE", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
  best:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  scoreDot:   { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  scoreDotTxt:{ color: "#fff", fontWeight: "800", fontSize: 14 },
  bestTitle:  { fontSize: 13, fontWeight: "700" },
  bar:        { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginTop: 6, marginBottom: 2 },
  barFill:    { height: "100%", borderRadius: 4 },
  passMark:   { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "#374151" },
  attempt:    { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
  attemptNum: { fontSize: 12, fontWeight: "700", color: MUTED },
  attemptScore:{ fontSize: 12, fontWeight: "700" },
  groupLbl:   { fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
});

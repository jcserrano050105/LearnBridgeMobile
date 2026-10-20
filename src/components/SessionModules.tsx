import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { confirmAsync } from "../lib/confirm";
import { readLocalFile } from "../lib/readLocalFile";
import { QuizFormModal, QuestionEditorModal, TakeQuizModal, quizType } from "./QuizModals";

// Session modules (sessions → subtopics → materials) for one booking.
// Mirrors the module/subtopic/material parts of the website's tutor SessionsPage.jsx
// (mode="tutor": full editing) and ParentSessionsPage.jsx (mode="parent": published only, read-only).
// Same tables: session_modules, module_subtopics, module_materials; files in "session-materials".

const PRIMARY    = "#3D3BF3";
const PRIMARY_BG = "#EBEBFF";
const MUTED      = "#6B7280";
const MID        = "#374151";
const DARK       = "#111827";
const BORDER     = "#E5E7EB";

export const MATERIAL_TYPES = [
  { value: "intro",         label: "INTRO",         color: "#6366F1", bg: "#EEF2FF" },
  { value: "guide",         label: "GUIDE",         color: "#0891B2", bg: "#ECFEFF" },
  { value: "main",          label: "MAIN",          color: "#059669", bg: "#ECFDF5" },
  { value: "note",          label: "NOTE",          color: "#7C3AED", bg: "#F5F3FF" },
  { value: "powerpoint",    label: "POWERPOINT",    color: "#DC2626", bg: "#FEF2F2" },
  { value: "video",         label: "VIDEO",         color: "#D97706", bg: "#FFFBEB" },
  { value: "supplementary", label: "SUPPLEMENTARY", color: "#6B7280", bg: "#F9FAFB" },
  { value: "discussion",    label: "DISCUSSION",    color: "#BE185D", bg: "#FDF2F8" },
];

function MatTypeBadge({ type }: { type: string }) {
  const t = MATERIAL_TYPES.find(x => x.value === type) || MATERIAL_TYPES[3];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeTxt, { color: t.color }]}>{t.label}</Text>
    </View>
  );
}

type PickedFile = { uri: string; name: string; mimeType: string };
type MatForm = { title: string; material_type: string; content: string; url: string; file: PickedFile | null };
const EMPTY_MAT: MatForm = { title: "", material_type: "note", content: "", url: "", file: null };

type Props = {
  bookingId: string;
  mode: "tutor" | "parent";
  tutorId?: string;     // tutor mode: owner of new modules/quizzes
  studentId?: string;   // parent mode: whose quiz attempts to show / record
  parentId?: string;    // parent mode: saved on quiz attempts
};

export default function SessionModules({ bookingId, mode, tutorId, studentId, parentId }: Props) {
  const isTutor = mode === "tutor";

  const [modules,  setModules]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openMat,  setOpenMat]  = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modals
  const [modModal, setModModal] = useState<"create" | any | null>(null);
  const [modForm,  setModForm]  = useState({ title: "", description: "" });
  const [subModal, setSubModal] = useState<{ module: any; subtopic?: any } | null>(null);
  const [subTitle, setSubTitle] = useState("");
  const [matModal, setMatModal] = useState<{ module: any; subtopic?: any; material?: any } | null>(null);
  const [matForm,  setMatForm]  = useState<MatForm>(EMPTY_MAT);
  const [saving,   setSaving]   = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Fetch (same shape as the website's fetchAll) ──────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("session_modules").select("*").eq("booking_id", bookingId).order("module_number");
    if (!isTutor) q = q.eq("status", "published");
    const { data: mods, error } = await q;
    if (error) { showToast(`Fetch error: ${error.message}`, "error"); setLoading(false); return; }
    if (!mods || mods.length === 0) { setModules([]); setLoading(false); return; }

    const modIds = mods.map((m: any) => m.id);
    let quizQ = supabase.from("session_quizzes").select("*").in("module_id", modIds).order("order_num");
    if (!isTutor) quizQ = quizQ.eq("status", "published");
    const [{ data: subs }, { data: mats }, { data: quizzes }] = await Promise.all([
      supabase.from("module_subtopics").select("*").in("module_id", modIds).order("subtopic_number"),
      supabase.from("module_materials").select("*").in("module_id", modIds).order("order_num"),
      quizQ,
    ]);

    // Parent: latest attempt per quiz for this student (website: attemptMap)
    const attemptMap: Record<string, any> = {};
    if (!isTutor && studentId && quizzes && quizzes.length > 0) {
      const { data: attempts } = await supabase
        .from("student_quiz_attempts").select("*")
        .eq("student_id", studentId).in("quiz_id", quizzes.map((q: any) => q.id));
      (attempts || []).forEach((a: any) => {
        if (!attemptMap[a.quiz_id] || a.attempt_num > attemptMap[a.quiz_id].attempt_num) {
          attemptMap[a.quiz_id] = a;
        }
      });
    }
    const withAttempt = (q: any) => ({ ...q, bestAttempt: attemptMap[q.id] || null });

    setModules(mods.map((mod: any) => ({
      ...mod,
      subtopics: (subs || []).filter((x: any) => x.module_id === mod.id).map((sub: any) => ({
        ...sub,
        materials: (mats || []).filter((m: any) => m.subtopic_id === sub.id),
        quizzes:   (quizzes || []).filter((q: any) => q.subtopic_id === sub.id).map(withAttempt),
      })),
      moduleMaterials: (mats || []).filter((m: any) => m.module_id === mod.id && !m.subtopic_id),
      quizzes:         (quizzes || []).filter((q: any) => q.module_id === mod.id && !q.subtopic_id).map(withAttempt),
    })));
    setLoading(false);
  }, [bookingId, isTutor, studentId]);

  // ── Quizzes ───────────────────────────────────────────────────────
  const [quizTarget, setQuizTarget] = useState<{ module: any; subtopic?: any; quiz?: any } | null>(null);
  const [editingQs,  setEditingQs]  = useState<any>(null);
  const [takeQuiz,   setTakeQuiz]   = useState<any>(null);
  const [takeQs,     setTakeQs]     = useState<any[]>([]);

  const deleteQuiz = async (quiz: any) => {
    const ok = await confirmAsync("Delete Quiz", `Delete quiz "${quiz.title}"?`, "Delete", true);
    if (!ok) return;
    const { error } = await supabase.from("session_quizzes").delete().eq("id", quiz.id);
    if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
    showToast("Quiz deleted."); fetchAll();
  };

  const togglePublishQuiz = async (quiz: any) => {
    const ns = quiz.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("session_quizzes").update({ status: ns }).eq("id", quiz.id);
    if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
    showToast(ns === "published" ? "Quiz published! Students can now take it." : "Quiz set to draft.");
    fetchAll();
  };

  // Parent: open a quiz (website openQuiz rules)
  const openQuiz = async (quiz: any) => {
    const best = quiz.bestAttempt;
    const attempts = best?.attempt_num || 0;
    if (attempts >= quiz.max_attempts && !best?.passed) {
      showToast(`Maximum ${quiz.max_attempts} attempts reached.`, "error"); return;
    }
    const { data: qs, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("order_num");
    if (error || !qs || qs.length === 0) { showToast("No questions added yet.", "error"); return; }
    setTakeQs(qs);
    setTakeQuiz(quiz);
  };

  const QuizRow = ({ quiz, module, subtopic }: { quiz: any; module: any; subtopic?: any }) => {
    const qt        = quizType(quiz.quiz_type);
    const published = quiz.status === "published";
    const best      = quiz.bestAttempt;
    return (
      <View style={[s.quizRow, { borderColor: qt.color + "55" }]}>
        <View style={s.quizTop}>
          <View style={[s.badge, { backgroundColor: qt.bg }]}><Text style={[s.badgeTxt, { color: qt.color }]}>{qt.short}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.matTitle}>{quiz.title}</Text>
            <Text style={s.muted}>
              Pass {quiz.pass_score}% · {quiz.max_attempts} attempts{quiz.time_limit > 0 ? ` · ${quiz.time_limit} min` : ""}
            </Text>
          </View>
          {isTutor && (
            <View style={[s.status, { backgroundColor: published ? "#D1FAE5" : "#F3F4F6" }]}>
              <Text style={[s.statusTxt, { color: published ? "#065F46" : MUTED }]}>{published ? "Published" : "Draft"}</Text>
            </View>
          )}
        </View>

        {isTutor ? (
          <View style={s.rowBtns}>
            <TouchableOpacity style={[s.smallBtn, s.smallPrimary]} onPress={() => setEditingQs(quiz)}>
              <Text style={[s.smallBtnTxt, { color: "#fff" }]}>📝 Questions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.smallBtn} onPress={() => togglePublishQuiz(quiz)}>
              <Text style={s.smallBtnTxt}>{published ? "↩ Unpublish" : "🚀 Publish"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.smallBtn} onPress={() => setQuizTarget({ module, subtopic, quiz })}>
              <Text style={s.smallBtnTxt}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.smallBtn, s.smallDanger]} onPress={() => deleteQuiz(quiz)}>
              <Text style={[s.smallBtnTxt, { color: "#DC2626" }]}>🗑</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.rowBtns, { alignItems: "center" }]}>
            {best ? (
              <View style={[s.status, { backgroundColor: best.passed ? "#D1FAE5" : "#FEE2E2" }]}>
                <Text style={[s.statusTxt, { color: best.passed ? "#065F46" : "#DC2626" }]}>
                  {best.passed ? "✓ Passed" : "Not passed"} · {best.score}% · attempt {best.attempt_num}/{quiz.max_attempts}
                </Text>
              </View>
            ) : (
              <Text style={s.muted}>Not taken yet</Text>
            )}
            {studentId && (
              <TouchableOpacity style={[s.smallBtn, s.smallPrimary, { marginLeft: "auto" }]} onPress={() => openQuiz(quiz)}>
                <Text style={[s.smallBtnTxt, { color: "#fff" }]}>{best ? "↻ Retake" : "▶ Take Quiz"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Module CRUD ───────────────────────────────────────────────────
  const openModule = (mod?: any) => {
    setModForm({ title: mod?.title || "", description: mod?.description || "" });
    setModModal(mod || "create");
  };

  const saveModule = async () => {
    if (!modForm.title.trim()) { showToast("Session title is required.", "error"); return; }
    setSaving(true);
    try {
      if (modModal === "create") {
        const { error } = await supabase.from("session_modules").insert({
          booking_id:    bookingId,
          tutor_id:      tutorId,
          module_number: modules.length + 1,
          title:         modForm.title,
          description:   modForm.description || null,
          status:        "draft",
        });
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Module created!");
      } else {
        const { error } = await supabase.from("session_modules")
          .update({ title: modForm.title, description: modForm.description || null }).eq("id", modModal.id);
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Module updated!");
      }
      setModModal(null); fetchAll();
    } finally { setSaving(false); }
  };

  const deleteModule = async (mod: any) => {
    const ok = await confirmAsync("Delete Session", `Delete Session ${mod.module_number}: "${mod.title}"? Everything inside will be deleted.`, "Delete", true);
    if (!ok) return;
    const { error } = await supabase.from("session_modules").delete().eq("id", mod.id);
    if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
    showToast("Module deleted."); fetchAll();
  };

  const togglePublish = async (mod: any) => {
    const ns = mod.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("session_modules").update({ status: ns }).eq("id", mod.id);
    if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
    showToast(ns === "published" ? "Module published! Students can now see it." : "Module set to draft.");
    fetchAll();
  };

  // ── Subtopic CRUD ─────────────────────────────────────────────────
  const openSubtopic = (module: any, subtopic?: any) => {
    setSubTitle(subtopic?.title || "");
    setSubModal({ module, subtopic });
  };

  const saveSubtopic = async () => {
    if (!subTitle.trim() || !subModal) { showToast("Title is required.", "error"); return; }
    setSaving(true);
    try {
      const mod = subModal.module;
      if (!subModal.subtopic) {
        const { error } = await supabase.from("module_subtopics")
          .insert({ module_id: mod.id, subtopic_number: (mod.subtopics?.length || 0) + 1, title: subTitle });
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Subtopic added!");
      } else {
        const { error } = await supabase.from("module_subtopics").update({ title: subTitle }).eq("id", subModal.subtopic.id);
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Subtopic updated!");
      }
      setSubModal(null); fetchAll();
    } finally { setSaving(false); }
  };

  const deleteSubtopic = async (sub: any) => {
    const ok = await confirmAsync("Delete Subtopic", `Delete "${sub.title}"?`, "Delete", true);
    if (!ok) return;
    const { error } = await supabase.from("module_subtopics").delete().eq("id", sub.id);
    if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
    showToast("Subtopic deleted."); fetchAll();
  };

  // ── Material CRUD ─────────────────────────────────────────────────
  const openMaterial = (module: any, subtopic?: any, material?: any) => {
    setMatForm(material ? {
      title:         material.title || "",
      material_type: material.material_type || "note",
      content:       material.content || "",
      url:           material.url || "",
      file:          null,
    } : EMPTY_MAT);
    setMatModal({ module, subtopic, material });
  };

  const pickMaterialFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setMatForm(f => ({ ...f, file: { uri: a.uri, name: a.name, mimeType: a.mimeType || "application/octet-stream" } }));
  };

  const saveMaterial = async () => {
    if (!matModal) return;
    if (!matForm.title.trim()) { showToast("Title is required.", "error"); return; }
    setSaving(true);
    try {
      let fileUrl  = matModal.material?.file_url  || null;
      let fileName = matModal.material?.file_name || null;
      let fileType = matModal.material?.file_type || null;

      if (matForm.file) {
        const path = `${tutorId}/${Date.now()}-${matForm.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const body = await readLocalFile(matForm.file.uri);
        const { error: upErr } = await supabase.storage
          .from("session-materials")
          .upload(path, body, { upsert: true, contentType: matForm.file.mimeType });
        if (upErr) { showToast(`File upload failed: ${upErr.message}`, "error"); return; }
        const { data: urlData } = supabase.storage.from("session-materials").getPublicUrl(path);
        fileUrl  = urlData?.publicUrl || null;
        fileName = matForm.file.name;
        fileType = matForm.file.mimeType;
      }

      const payload = {
        module_id:     matModal.module.id,
        subtopic_id:   matModal.subtopic?.id || null,
        material_type: matForm.material_type,
        title:         matForm.title,
        content:       matForm.content || null,
        url:           matForm.url || null,
        file_url:      fileUrl,
        file_name:     fileName,
        file_type:     fileType,
      };
      if (!matModal.material) {
        const orderNum = matModal.subtopic
          ? (matModal.subtopic.materials?.length || 0)
          : (matModal.module.moduleMaterials?.length || 0);
        const { error } = await supabase.from("module_materials").insert({ ...payload, order_num: orderNum });
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Material added!");
      } else {
        const { error } = await supabase.from("module_materials").update(payload).eq("id", matModal.material.id);
        if (error) { showToast(`Failed: ${error.message}`, "error"); return; }
        showToast("Material updated!");
      }
      setMatModal(null); fetchAll();
    } finally { setSaving(false); }
  };

  const deleteMaterial = async (mat: any) => {
    const ok = await confirmAsync("Remove Material", `Remove "${mat.title}"?`, "Remove", true);
    if (!ok) return;
    await supabase.from("module_materials").delete().eq("id", mat.id);
    showToast("Material removed."); fetchAll();
  };

  // ── Material row ──────────────────────────────────────────────────
  const MatRow = ({ mat, module, subtopic }: { mat: any; module: any; subtopic?: any }) => {
    const isOpen = openMat === mat.id;
    return (
      <View style={s.matRow}>
        <TouchableOpacity style={s.matTop} onPress={() => setOpenMat(isOpen ? null : mat.id)} activeOpacity={0.7}>
          <MatTypeBadge type={mat.material_type} />
          <Text style={s.matTitle} numberOfLines={isOpen ? undefined : 1}>{mat.title}</Text>
          {(mat.file_url || mat.url) && <Ionicons name={mat.file_url ? "document-attach-outline" : "link-outline"} size={14} color={MUTED} />}
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={MUTED} />
        </TouchableOpacity>

        {isOpen && (
          <View style={s.matBody}>
            {!!mat.content && <Text style={s.matContent}>{mat.content}</Text>}
            {!!mat.url && (
              <TouchableOpacity style={s.matLink} onPress={() => WebBrowser.openBrowserAsync(mat.url)}>
                <Ionicons name="link-outline" size={14} color={PRIMARY} />
                <Text style={s.matLinkTxt} numberOfLines={1}>{mat.url}</Text>
              </TouchableOpacity>
            )}
            {!!mat.file_url && (
              <TouchableOpacity style={s.matLink} onPress={() => WebBrowser.openBrowserAsync(mat.file_url)}>
                <Ionicons name="document-attach-outline" size={14} color={PRIMARY} />
                <Text style={s.matLinkTxt} numberOfLines={1}>📎 {mat.file_name || "Open file"}</Text>
              </TouchableOpacity>
            )}
            {!mat.content && !mat.url && !mat.file_url && <Text style={s.muted}>No content.</Text>}

            {isTutor && (
              <View style={s.rowBtns}>
                <TouchableOpacity style={s.smallBtn} onPress={() => openMaterial(module, subtopic, mat)}>
                  <Text style={s.smallBtnTxt}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.smallBtn, s.smallDanger]} onPress={() => deleteMaterial(mat)}>
                  <Text style={[s.smallBtnTxt, { color: "#DC2626" }]}>🗑 Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.headTitle}>📚 Learning Modules</Text>
          <Text style={s.headSub}>
            {isTutor ? "Create sessions, subtopics and materials. Publish a session so the student can see it." : "Lessons and materials your tutor has published."}
          </Text>
        </View>
        {isTutor && (
          <TouchableOpacity style={s.addBtn} onPress={() => openModule()}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnTxt}>Session</Text>
          </TouchableOpacity>
        )}
      </View>

      {toast && (
        <View style={[s.toast, { backgroundColor: toast.type === "error" ? "#FEE2E2" : "#D1FAE5" }]}>
          <Text style={[s.toastTxt, { color: toast.type === "error" ? "#DC2626" : "#065F46" }]}>
            {toast.type === "error" ? "❌ " : "✅ "}{toast.msg}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 24 }} />
      ) : modules.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 34, marginBottom: 6 }}>📚</Text>
          <Text style={s.emptyTitle}>{isTutor ? "No sessions yet" : "No published modules yet"}</Text>
          <Text style={s.muted}>
            {isTutor ? "Tap \"+ Session\" to create the first one." : "Your tutor's lessons will appear here once published."}
          </Text>
        </View>
      ) : modules.map(mod => {
        const open      = !!expanded[mod.id];
        const published = mod.status === "published";
        return (
          <View key={mod.id} style={s.modCard}>
            <TouchableOpacity style={s.modHead} onPress={() => toggle(mod.id)} activeOpacity={0.8}>
              <View style={s.modNum}><Text style={s.modNumTxt}>S{mod.module_number}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.modTitle}>{mod.title}</Text>
                <Text style={s.muted}>
                  {mod.subtopics.length} subtopic{mod.subtopics.length !== 1 ? "s" : ""} · {
                    mod.moduleMaterials.length + mod.subtopics.reduce((n: number, x: any) => n + x.materials.length, 0)
                  } material(s)
                </Text>
              </View>
              {isTutor && (
                <View style={[s.status, { backgroundColor: published ? "#D1FAE5" : "#F3F4F6" }]}>
                  <Text style={[s.statusTxt, { color: published ? "#065F46" : MUTED }]}>{published ? "Published" : "Draft"}</Text>
                </View>
              )}
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={MUTED} />
            </TouchableOpacity>

            {open && (
              <View style={s.modBody}>
                {!!mod.description && <Text style={s.modDesc}>{mod.description}</Text>}

                {isTutor && (
                  <View style={s.rowBtns}>
                    <TouchableOpacity style={[s.smallBtn, published ? null : s.smallPrimary]} onPress={() => togglePublish(mod)}>
                      <Text style={[s.smallBtnTxt, !published && { color: "#fff" }]}>{published ? "↩ Unpublish" : "🚀 Publish"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.smallBtn} onPress={() => openModule(mod)}>
                      <Text style={s.smallBtnTxt}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.smallBtn, s.smallDanger]} onPress={() => deleteModule(mod)}>
                      <Text style={[s.smallBtnTxt, { color: "#DC2626" }]}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Module-level materials + quizzes */}
                {mod.moduleMaterials.map((mat: any) => <MatRow key={mat.id} mat={mat} module={mod} />)}
                {mod.quizzes.map((q: any) => <QuizRow key={q.id} quiz={q} module={mod} />)}

                {/* Subtopics */}
                {mod.subtopics.map((sub: any) => (
                  <View key={sub.id} style={s.subCard}>
                    <View style={s.subHead}>
                      <Text style={s.subTitle}>{mod.module_number}.{sub.subtopic_number} {sub.title}</Text>
                      {isTutor && (
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <TouchableOpacity onPress={() => openSubtopic(mod, sub)}><Ionicons name="create-outline" size={16} color={MID} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteSubtopic(sub)}><Ionicons name="trash-outline" size={16} color="#DC2626" /></TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {sub.materials.length === 0 && sub.quizzes.length === 0 && <Text style={[s.muted, { marginBottom: 6 }]}>No materials yet.</Text>}
                    {sub.materials.map((mat: any) => <MatRow key={mat.id} mat={mat} module={mod} subtopic={sub} />)}
                    {sub.quizzes.map((q: any) => <QuizRow key={q.id} quiz={q} module={mod} subtopic={sub} />)}
                    {isTutor && (
                      <View style={{ flexDirection: "row", gap: 16 }}>
                        <TouchableOpacity style={s.linkBtn} onPress={() => openMaterial(mod, sub)}>
                          <Text style={s.linkBtnTxt}>+ Material</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.linkBtn} onPress={() => setQuizTarget({ module: mod, subtopic: sub })}>
                          <Text style={s.linkBtnTxt}>+ Quiz</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}

                {isTutor && (
                  <View style={s.rowBtns}>
                    <TouchableOpacity style={s.smallBtn} onPress={() => openSubtopic(mod)}>
                      <Text style={s.smallBtnTxt}>+ Subtopic</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.smallBtn} onPress={() => openMaterial(mod)}>
                      <Text style={s.smallBtnTxt}>+ Material</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.smallBtn} onPress={() => setQuizTarget({ module: mod })}>
                      <Text style={s.smallBtnTxt}>+ Quiz</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Quiz modals ── */}
      <QuizFormModal
        target={quizTarget}
        bookingId={bookingId}
        tutorId={tutorId}
        onClose={() => setQuizTarget(null)}
        onError={msg => showToast(msg, "error")}
        onSaved={async (created, msg) => {
          setQuizTarget(null);
          showToast(msg);
          await fetchAll();
          if (created) setEditingQs(created); // website: open the question editor right after creating
        }}
      />
      <QuestionEditorModal quiz={editingQs} onClose={() => { setEditingQs(null); fetchAll(); }} />
      <TakeQuizModal
        quiz={takeQuiz}
        questions={takeQs}
        studentId={studentId || ""}
        parentId={parentId || ""}
        onClose={() => setTakeQuiz(null)}
        onSubmitted={fetchAll}
      />

      {/* ── Module modal ── */}
      <Modal visible={!!modModal} transparent animationType="slide" onRequestClose={() => setModModal(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{modModal === "create" ? "➕ New Session" : "✏️ Edit Session"}</Text>
            <Text style={s.label}>Session title *</Text>
            <TextInput style={s.input} value={modForm.title} onChangeText={v => setModForm(f => ({ ...f, title: v }))} placeholder="e.g. Adding Fractions" placeholderTextColor={MUTED} />
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.input, s.area]} value={modForm.description} onChangeText={v => setModForm(f => ({ ...f, description: v }))} placeholder="What this session covers..." placeholderTextColor={MUTED} multiline />
            <SheetFooter saving={saving} onCancel={() => setModModal(null)} onSave={saveModule} />
          </View>
        </View>
      </Modal>

      {/* ── Subtopic modal ── */}
      <Modal visible={!!subModal} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{subModal?.subtopic ? "✏️ Edit Subtopic" : "➕ New Subtopic"}</Text>
            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} value={subTitle} onChangeText={setSubTitle} placeholder="e.g. Like fractions" placeholderTextColor={MUTED} />
            <SheetFooter saving={saving} onCancel={() => setSubModal(null)} onSave={saveSubtopic} />
          </View>
        </View>
      </Modal>

      {/* ── Material modal ── */}
      <Modal visible={!!matModal} transparent animationType="slide" onRequestClose={() => setMatModal(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: "90%" }]}>
            <Text style={s.sheetTitle}>{matModal?.material ? "✏️ Edit Material" : "➕ New Material"}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Title *</Text>
              <TextInput style={s.input} value={matForm.title} onChangeText={v => setMatForm(f => ({ ...f, title: v }))} placeholder="e.g. Fractions worksheet" placeholderTextColor={MUTED} />

              <Text style={s.label}>Type</Text>
              <View style={s.typeGrid}>
                {MATERIAL_TYPES.map(t => {
                  const on = matForm.material_type === t.value;
                  return (
                    <TouchableOpacity key={t.value} onPress={() => setMatForm(f => ({ ...f, material_type: t.value }))}
                      style={[s.typeBtn, { borderColor: on ? t.color : BORDER, backgroundColor: on ? t.bg : "#fff" }]}>
                      <Text style={[s.typeTxt, { color: on ? t.color : MUTED }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Content / Notes</Text>
              <TextInput style={[s.input, s.area]} value={matForm.content} onChangeText={v => setMatForm(f => ({ ...f, content: v }))} placeholder="Text the student will read..." placeholderTextColor={MUTED} multiline />

              <Text style={s.label}>Link (optional)</Text>
              <TextInput style={s.input} value={matForm.url} onChangeText={v => setMatForm(f => ({ ...f, url: v }))} placeholder="https://..." placeholderTextColor={MUTED} autoCapitalize="none" keyboardType="url" />

              <Text style={s.label}>File (optional)</Text>
              <TouchableOpacity style={[s.fileBox, matForm.file && s.fileBoxOk]} onPress={pickMaterialFile}>
                <Ionicons name={matForm.file ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={matForm.file ? "#059669" : MUTED} />
                <Text style={s.fileTxt} numberOfLines={1}>
                  {matForm.file ? matForm.file.name : matModal?.material?.file_name ? `Current: ${matModal.material.file_name} (tap to replace)` : "Tap to attach a file (PDF, slides, image, video)"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            <SheetFooter saving={saving} onCancel={() => setMatModal(null)} onSave={saveMaterial} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SheetFooter({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <View style={s.sheetFooter}>
      <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={saving}>
        <Text style={s.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveTxt}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { marginTop: 4 },
  head:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  headTitle: { fontSize: 16, fontWeight: "800", color: DARK },
  headSub:   { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 },
  addBtn:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },

  toast:    { borderRadius: 10, padding: 12, marginBottom: 12 },
  toastTxt: { fontSize: 13, fontWeight: "600" },

  empty:      { alignItems: "center", paddingVertical: 24, backgroundColor: "#F9FAFB", borderRadius: 12 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 4 },
  muted:      { fontSize: 12, color: MUTED },

  modCard:   { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 10, overflow: "hidden" },
  modHead:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  modNum:    { backgroundColor: PRIMARY_BG, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  modNumTxt: { fontSize: 12, fontWeight: "800", color: PRIMARY },
  modTitle:  { fontSize: 14, fontWeight: "700", color: DARK },
  status:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  modBody:   { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  modDesc:   { fontSize: 13, color: MID, lineHeight: 19, marginBottom: 10 },

  subCard:  { backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 10, marginTop: 8 },
  subHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  subTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: DARK },

  quizRow:    { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1.5, padding: 10, marginBottom: 6 },
  quizTop:    { flexDirection: "row", alignItems: "center", gap: 8 },
  matRow:     { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
  matTop:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  matTitle:   { flex: 1, fontSize: 13, fontWeight: "600", color: DARK },
  matBody:    { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  matContent: { fontSize: 13, color: MID, lineHeight: 19 },
  matLink:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PRIMARY_BG, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  matLinkTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: PRIMARY },
  badge:      { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  rowBtns:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  smallBtn:    { borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallPrimary:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
  smallDanger: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  smallBtnTxt: { fontSize: 12, fontWeight: "700", color: MID },
  linkBtn:     { alignSelf: "flex-start", marginTop: 2 },
  linkBtnTxt:  { fontSize: 12, fontWeight: "700", color: PRIMARY },

  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle:  { fontSize: 17, fontWeight: "800", color: DARK, marginBottom: 14 },
  label:       { fontSize: 12, fontWeight: "700", color: DARK, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", marginBottom: 12 },
  area:        { height: 90, textAlignVertical: "top" },
  typeGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  typeBtn:     { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  typeTxt:     { fontSize: 10, fontWeight: "800" },
  fileBox:     { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: BORDER, borderRadius: 10, padding: 12, marginBottom: 8 },
  fileBoxOk:   { borderColor: "#059669", backgroundColor: "#F0FDF4" },
  fileTxt:     { flex: 1, fontSize: 12, color: MID },
  sheetFooter: { flexDirection: "row", gap: 10, marginTop: 10 },
  cancelBtn:   { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  cancelTxt:   { fontSize: 14, color: MUTED, fontWeight: "600" },
  saveBtn:     { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  saveTxt:     { fontSize: 14, color: "#fff", fontWeight: "700" },
});

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Linking } from "react-native";
import { supabase } from "../lib/supabase";
import { confirmAsync } from "../lib/confirm";

// Session announcements for one booking — website tutor SessionsPage (post/edit/delete)
// and ParentSessionsPage "📢 Announcements" tab (read-only). Table: session_announcements.

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";

// Website linkify(): make URLs tappable
function Linkified({ text, style }: { text: string; style: any }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <Text key={i} style={{ color: PRIMARY, textDecorationLine: "underline" }} onPress={() => Linking.openURL(p)}>{p}</Text>
        : <Text key={i}>{p}</Text>)}
    </Text>
  );
}

type Props = { bookingId: string; mode: "tutor" | "parent"; tutorId?: string };

export default function SessionAnnouncements({ bookingId, mode, tutorId }: Props) {
  const isTutor = mode === "tutor";
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState("");
  const [editing,  setEditing]  = useState<any>(null);
  const [editText, setEditText] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ t: string; err?: boolean } | null>(null);

  const flash = (t: string, err = false) => { setMsg({ t, err }); setTimeout(() => setMsg(null), 3500); };

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase.from("session_announcements").select("*")
      .eq("booking_id", bookingId).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const post = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("session_announcements").insert({
        booking_id: bookingId, tutor_id: tutorId, message: text.trim(), is_pinned: true,
      });
      if (error) { flash(`Failed: ${error.message}`, true); return; }
      setText(""); fetchAnnouncements(); flash("Announcement posted!");
    } finally { setSaving(false); }
  };

  const update = async () => {
    if (!editText.trim() || !editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("session_announcements")
        .update({ message: editText.trim(), updated_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) { flash(`Failed: ${error.message}`, true); return; }
      setEditing(null); setEditText(""); fetchAnnouncements(); flash("Announcement updated!");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!(await confirmAsync("Delete", "Delete this announcement?", "Delete", true))) return;
    await supabase.from("session_announcements").delete().eq("id", id);
    fetchAnnouncements(); flash("Announcement deleted.");
  };

  return (
    <View>
      {msg && <Text style={[s.msg, { color: msg.err ? "#DC2626" : "#065F46", backgroundColor: msg.err ? "#FEE2E2" : "#D1FAE5" }]}>{msg.t}</Text>}

      {isTutor && (
        <View style={s.postBox}>
          <Text style={s.postTitle}>📢 Post an announcement</Text>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="e.g. Next session we'll review fractions. Please bring your notebook!"
            placeholderTextColor={MUTED}
            multiline
          />
          <TouchableOpacity style={[s.btn, (!text.trim() || saving) && { opacity: 0.5 }]} onPress={post} disabled={!text.trim() || saving}>
            {saving && !editing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>📌 Post Announcement</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 20 }} /> : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>📢</Text>
          <Text style={s.emptyTitle}>No announcements yet</Text>
          <Text style={s.muted}>{isTutor ? "Posts appear here and on the parent's Sessions page." : "Your tutor hasn't posted any announcements yet."}</Text>
        </View>
      ) : items.map(a => (
        <View key={a.id} style={s.card}>
          <Text style={{ fontSize: 20 }}>📌</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>Announcement from Tutor</Text>
            {editing?.id === a.id ? (
              <>
                <TextInput style={[s.input, { backgroundColor: "#fff" }]} value={editText} onChangeText={setEditText} multiline />
                <View style={s.row}>
                  <TouchableOpacity style={s.ghost} onPress={() => setEditing(null)}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={update} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Linkified text={a.message} style={s.cardTxt} />
            )}
            <Text style={s.cardDate}>
              📅 {new Date(a.created_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Text>
            {isTutor && editing?.id !== a.id && (
              <View style={[s.row, { marginTop: 8 }]}>
                <TouchableOpacity onPress={() => { setEditing(a); setEditText(a.message); }}><Text style={s.link}>✏️ Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(a.id)}><Text style={[s.link, { color: "#DC2626" }]}>🗑 Delete</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  msg:       { fontSize: 12, fontWeight: "600", borderRadius: 8, padding: 10, marginBottom: 10 },
  postBox:   { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 14 },
  postTitle: { fontSize: 14, fontWeight: "800", color: DARK, marginBottom: 8 },
  input:     { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 12, fontSize: 14, color: DARK, backgroundColor: "#F9FAFB", minHeight: 80, textAlignVertical: "top", marginBottom: 10 },
  btn:       { backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  btnTxt:    { color: "#fff", fontSize: 13, fontWeight: "700" },
  ghost:     { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", backgroundColor: "#fff" },
  ghostTxt:  { fontSize: 13, color: MUTED, fontWeight: "600" },
  row:       { flexDirection: "row", gap: 14, alignItems: "center" },
  empty:     { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  emptyTitle:{ fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 4 },
  muted:     { fontSize: 12, color: MUTED, textAlign: "center", paddingHorizontal: 16 },
  card:      { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, backgroundColor: "#FFFBEB", borderWidth: 2, borderColor: "#FDE68A", marginBottom: 10 },
  cardLabel: { fontSize: 11, fontWeight: "700", color: "#B45309", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  cardTxt:   { fontSize: 14, lineHeight: 22, color: "#78350F", fontWeight: "500" },
  cardDate:  { fontSize: 11, color: "#B45309", marginTop: 6 },
  link:      { fontSize: 12, fontWeight: "700", color: "#B45309" },
});

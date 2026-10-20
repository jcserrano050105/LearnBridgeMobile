import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { supabase } from "../lib/supabase";

// Mirrors the website's src/components/ZoomMeeting.jsx.
// Tutor creates a meeting via the "zoom-create-meeting" Edge Function; links are saved on the booking
// (zoom_meeting_id, zoom_join_url, zoom_host_url, zoom_meeting_status) so the website and app share them.

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";
const DARK    = "#111827";
const BORDER  = "#E5E7EB";

type Props = { booking: { id: string; subject?: string }; isTutor?: boolean };

export default function ZoomMeeting({ booking, isTutor = false }: Props) {
  const [status,    setStatus]    = useState<"idle" | "ready" | "ended">("idle");
  const [meetingId, setMeetingId] = useState("");
  const [joinUrl,   setJoinUrl]   = useState("");
  const [hostUrl,   setHostUrl]   = useState("");
  const [creating,  setCreating]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const fetchMeetingDetails = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("zoom_meeting_id, zoom_meeting_password, zoom_join_url, zoom_host_url, zoom_meeting_status")
      .eq("id", booking.id)
      .single();
    if (data?.zoom_meeting_id) {
      setMeetingId(String(data.zoom_meeting_id));
      setJoinUrl(data.zoom_join_url || "");
      setHostUrl(data.zoom_host_url || "");
      setStatus(data.zoom_meeting_status === "active" ? "ready" : data.zoom_meeting_status === "ended" ? "ended" : "idle");
    } else {
      setStatus("idle");
    }
    setLoading(false);
  }, [booking.id]);

  useEffect(() => { fetchMeetingDetails(); }, [fetchMeetingDetails]);

  // Student side: re-check every 20s so "Join" appears when the tutor starts
  useEffect(() => {
    if (isTutor) return;
    const t = setInterval(fetchMeetingDetails, 20000);
    return () => clearInterval(t);
  }, [isTutor, fetchMeetingDetails]);

  const createMeeting = async () => {
    setCreating(true); setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("zoom-create-meeting", {
        body: { topic: `LearnBridge — ${booking?.subject || "Tutoring Session"}`, duration: 60 },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      const { error: upErr } = await supabase.from("bookings").update({
        zoom_meeting_id:       data.meetingId,
        zoom_meeting_password: data.password,
        zoom_join_url:         data.joinUrl,
        zoom_host_url:         data.hostUrl,
        zoom_meeting_status:   "active",
      }).eq("id", booking.id);
      if (upErr) throw upErr;

      setMeetingId(String(data.meetingId));
      setJoinUrl(data.joinUrl);
      setHostUrl(data.hostUrl);
      setStatus("ready");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const endMeeting = async () => {
    await supabase.from("bookings").update({ zoom_meeting_status: "ended" }).eq("id", booking.id);
    setStatus("ended");
  };

  if (loading) return <ActivityIndicator color={PRIMARY} style={{ paddingVertical: 24 }} />;

  return (
    <View style={s.card}>
      {status === "idle" && (
        <>
          <Text style={s.icon}>🎥</Text>
          <Text style={s.title}>{isTutor ? "Start a Video Meeting" : "Join Video Meeting"}</Text>
          <Text style={s.body}>
            {isTutor
              ? "Create a Zoom meeting for this session. The student will be able to join directly from LearnBridge."
              : "No active meeting yet. Please wait for your tutor to start the meeting."}
          </Text>
          {isTutor ? (
            <TouchableOpacity style={[s.btn, creating && { opacity: 0.6 }]} onPress={createMeeting} disabled={creating}>
              {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>🎥 Start Meeting</Text>}
            </TouchableOpacity>
          ) : (
            <View style={s.wait}><Text style={s.waitTxt}>⏳ Waiting for your tutor to start the meeting...</Text></View>
          )}
        </>
      )}

      {status === "ready" && (
        <>
          <Text style={s.icon}>✅</Text>
          <Text style={[s.title, { color: "#065F46" }]}>Meeting is Active</Text>
          <Text style={s.body}>Meeting ID: <Text style={{ fontWeight: "800" }}>{meetingId}</Text></Text>

          {isTutor && !!hostUrl && (
            <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(hostUrl)}>
              <Text style={s.btnTxt}>🎥 Open as Host in Zoom</Text>
            </TouchableOpacity>
          )}
          {!isTutor && !!joinUrl && (
            <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(joinUrl)}>
              <Text style={s.btnTxt}>📹 Join Meeting in Zoom</Text>
            </TouchableOpacity>
          )}

          <View style={s.info}>
            <Text style={s.infoTitle}>📋 Meeting Details</Text>
            <Text style={s.infoTxt}>Meeting ID: <Text style={{ fontWeight: "800" }}>{meetingId}</Text></Text>
            <Text style={s.infoTxt}>Subject: <Text style={{ fontWeight: "800", textTransform: "capitalize" }}>{booking?.subject || "—"}</Text></Text>
            <Text style={s.infoTxt}>Status: <Text style={{ fontWeight: "800", color: "#065F46" }}>🟢 Active</Text></Text>
          </View>

          {isTutor && (
            <TouchableOpacity style={s.danger} onPress={endMeeting}>
              <Text style={s.dangerTxt}>📴 End Meeting</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {status === "ended" && (
        <>
          <Text style={s.icon}>📴</Text>
          <Text style={s.title}>Meeting Ended</Text>
          <Text style={s.body}>The video meeting has ended.</Text>
          {isTutor && (
            <TouchableOpacity style={[s.btn, creating && { opacity: 0.6 }]} onPress={createMeeting} disabled={creating}>
              {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>🎥 Start New Meeting</Text>}
            </TouchableOpacity>
          )}
        </>
      )}

      {!!error && (
        <View style={s.err}>
          <Text style={s.errTxt}>❌ {error}</Text>
          <TouchableOpacity onPress={() => setError("")}><Text style={[s.errTxt, { fontWeight: "700" }]}>Dismiss</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:     { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 24, alignItems: "center" },
  icon:     { fontSize: 52, marginBottom: 12 },
  title:    { fontSize: 19, fontWeight: "800", color: DARK, marginBottom: 6, textAlign: "center" },
  body:     { fontSize: 13, color: MUTED, lineHeight: 20, textAlign: "center", marginBottom: 18 },
  btn:      { alignSelf: "stretch", backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  btnTxt:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  wait:     { alignSelf: "stretch", backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12, padding: 14 },
  waitTxt:  { fontSize: 13, color: "#92400E", fontWeight: "600", textAlign: "center" },
  info:     { alignSelf: "stretch", backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, padding: 14, marginTop: 4 },
  infoTitle:{ fontSize: 13, fontWeight: "700", color: "#1D4ED8", marginBottom: 4 },
  infoTxt:  { fontSize: 13, color: "#1D4ED8", lineHeight: 21 },
  danger:   { alignSelf: "stretch", backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  dangerTxt:{ color: "#DC2626", fontSize: 14, fontWeight: "700" },
  err:      { alignSelf: "stretch", marginTop: 14, backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 12, gap: 6 },
  errTxt:   { fontSize: 13, color: "#DC2626" },
});

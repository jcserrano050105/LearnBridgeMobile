import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, TouchableWithoutFeedback,
  useWindowDimensions, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const SYSTEM_PROMPT = `You are LearnBot, a helpful AI assistant for LearnBridge — an online tutoring platform for Grade 2–6 Filipino learners specializing in English and Mathematics.

You help both parents and tutors navigate the platform. Here is what you know:

PLATFORM OVERVIEW:
- LearnBridge connects verified tutors with parents of Grade 2–6 students in the Philippines
- Subjects offered: English and Mathematics
- All tutors are verified (NBI Clearance, PRC License, Medical Certificate, Application Form) and must pass an AI certification exam before tutoring

FOR PARENTS:
- Parents must first add their child's profile under "My Children"
- Parents browse verified tutors in "Find Tutors" and send an inquiry
- After chatting with a tutor, parents can book an 8-session package
- Each booking = 8 sessions, 2 sessions/week, 1.5 hours each
- Payment is made directly to the tutor
- LearnBridge deducts a 10% platform commission from the tutor's wallet
- After each session, the tutor marks it complete, then the parent confirms and rates the tutor (1-5 stars)

FOR TUTORS:
- Tutors must register, upload documents, take the AI Certification Exam, and wait for admin approval
- Tutors maintain a wallet balance to cover the 10% platform commission per booking
- Tutors top up their wallet via GCash (send to 0968 709 5884 - Ronn Alexis Leonardo, then submit proof)
- Wallet top-ups are reviewed and approved by the admin within 24 hours

BOOKING FLOW:
1. Parent inquires → Chat with tutor → Parent clicks "Book Now" → Selects subject
2. Tutor receives booking request → Checks wallet balance → Accepts or Rejects
3. Confirmed booking → Tutor conducts sessions → Marks complete → Parent confirms → Commission deducted

IMPORTANT RULES:
- Always be friendly, helpful, and concise
- Respond in English
- Keep answers short — 2 to 4 sentences max unless a list is needed
- If unsure, say "Please contact our admin team for more details"`;

const PURPLE  = "#4F46E5";
const BG_CHAT = "#F8F9FF";
const DARK    = "#1F2937";
const MUTED   = "#6B7280";
const BORDER  = "#E5E7EB";

type Msg = { role: "user" | "assistant"; content: string };

export default function LearnBot() {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { profile } = useAuth() as any;
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const role      = profile?.role || "parent";

  const STATUS_BAR_H = StatusBar.currentHeight ?? (Platform.OS === "ios" ? 50 : 24);
  const TOP_OFFSET   = STATUS_BAR_H + 8;

  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role:    "assistant",
      content: `Hi ${firstName}! 👋 I'm LearnBot, your LearnBridge assistant. How can I help you today?`,
    },
  ]);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef  = useRef<TextInput>(null);

  const QUICK = role === "tutor"
    ? ["How do I top up my wallet?", "How does commission work?", "How do I accept bookings?"]
    : ["How do I book a tutor?", "How does a session work?", "How do I rate my tutor?"];

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
        inputRef.current?.focus();
      }, 300);
    }
  }, [open]);

  const callOpenAI = async (msgs: Msg[]) => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing API key");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        max_tokens:  300,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...msgs.slice(-10),
        ],
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Sorry, I could not generate a response.";
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const reply = await callOpenAI(next);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role:    "assistant",
        content: "⚠️ Sorry, I encountered an error. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const FAB_BOTTOM = Platform.OS === "ios" ? 40 : 24;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Chat window — anchored to TOP ── */}
      {open && (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          pointerEvents="box-none"
        >
          {/* Dim backdrop */}
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          {/* Chat panel — TOP of screen */}
          <View style={[
            styles.chatWindow,
            {
              top:       TOP_OFFSET,
              left:      16,
              right:     16,
              maxHeight: SCREEN_H * 0.75,
            },
          ]}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>LearnBot</Text>
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineTxt}>AI Assistant · Always here to help</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, backgroundColor: BG_CHAT }}
              contentContainerStyle={{ padding: 14, paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((m, i) => (
                <View key={i} style={[
                  styles.msgRow,
                  m.role === "user" ? styles.msgRowUser : styles.msgRowBot,
                ]}>
                  {m.role === "assistant" && (
                    <View style={styles.botAvatar}>
                      <Text style={{ fontSize: 13 }}>🤖</Text>
                    </View>
                  )}
                  <View style={[
                    styles.bubble,
                    { maxWidth: SCREEN_W * 0.65 },
                    m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                  ]}>
                    <Text style={[
                      styles.bubbleTxt,
                      m.role === "user" && { color: "#fff" },
                    ]}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Typing indicator */}
              {loading && (
                <View style={[styles.msgRow, styles.msgRowBot]}>
                  <View style={styles.botAvatar}>
                    <Text style={{ fontSize: 13 }}>🤖</Text>
                  </View>
                  <View style={[styles.bubbleBot, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                    <ActivityIndicator size="small" color={PURPLE} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick replies — first message only */}
            {messages.length === 1 && !loading && (
              <View style={styles.quickWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  {QUICK.map(q => (
                    <TouchableOpacity
                      key={q}
                      style={styles.quickBtn}
                      onPress={() => sendMessage(q)}
                    >
                      <Text style={styles.quickTxt}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input row */}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Ask me anything..."
                placeholderTextColor={MUTED}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => sendMessage()}
                returnKeyType="send"
                editable={!loading}
                multiline={false}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
                onPress={() => sendMessage()}
                disabled={!input.trim() || loading}
              >
                <Ionicons
                  name="send"
                  size={16}
                  color={!input.trim() || loading ? MUTED : "#fff"}
                />
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── FAB — stays bottom right ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: FAB_BOTTOM }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
      >
        {open
          ? <Ionicons name="close" size={24} color="#fff" />
          : <Text style={{ fontSize: 26 }}>🤖</Text>
        }
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  chatWindow: {
    position:        "absolute",
    backgroundColor: "#fff",
    borderRadius:    20,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.18,
    shadowRadius:    24,
    elevation:       20,
    borderWidth:     1,
    borderColor:     "rgba(79,70,229,.12)",
  },

  // Header
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    padding:         14,
    gap:             12,
    backgroundColor: PURPLE,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.18)",
    justifyContent:  "center",
    alignItems:      "center",
  },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  onlineRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  onlineTxt:   { color: "rgba(255,255,255,.8)", fontSize: 11 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,.18)",
    justifyContent:  "center",
    alignItems:      "center",
  },

  // Messages
  msgRow:    { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  msgRowUser:{ justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  botAvatar: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: PURPLE,
    justifyContent:  "center",
    alignItems:      "center",
    flexShrink:      0,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      18,
  },
  bubbleUser: {
    backgroundColor:         PURPLE,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor:        "#fff",
    borderBottomLeftRadius: 4,
    borderWidth:            1,
    borderColor:            "rgba(79,70,229,.1)",
    shadowColor:            "#000",
    shadowOffset:           { width: 0, height: 1 },
    shadowOpacity:          0.06,
    shadowRadius:           3,
    elevation:              1,
  },
  bubbleTxt: { fontSize: 13.5, lineHeight: 20, color: DARK },

  // Quick replies
  quickWrap: {
    borderTopWidth:  1,
    borderTopColor:  BORDER,
    backgroundColor: BG_CHAT,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      20,
    borderWidth:       1.5,
    borderColor:       "rgba(79,70,229,.3)",
    backgroundColor:   "rgba(79,70,229,.06)",
  },
  quickTxt: { fontSize: 11.5, fontWeight: "600", color: PURPLE },

  // Input
  inputRow: {
    flexDirection:   "row",
    alignItems:      "center",
    padding:         10,
    gap:             8,
    borderTopWidth:  1,
    borderTopColor:  "rgba(79,70,229,.1)",
    backgroundColor: "#fff",
  },
  input: {
    flex:              1,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      24,
    borderWidth:       1.5,
    borderColor:       "rgba(79,70,229,.2)",
    fontSize:          13,
    color:             DARK,
    backgroundColor:   BG_CHAT,
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: PURPLE,
    justifyContent:  "center",
    alignItems:      "center",
    shadowColor:     PURPLE,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.4,
    shadowRadius:    6,
    elevation:       4,
  },
  sendBtnOff: {
    backgroundColor: "#E5E7EB",
    shadowOpacity:   0,
    elevation:       0,
  },

  // FAB
  fab: {
    position:        "absolute",
    right:           20,
    width:           58,
    height:          58,
    borderRadius:    29,
    backgroundColor: PURPLE,
    justifyContent:  "center",
    alignItems:      "center",
    shadowColor:     PURPLE,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.45,
    shadowRadius:    12,
    elevation:       10,
  },
});
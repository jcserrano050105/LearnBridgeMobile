import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback, ScrollView, Animated, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions } from "expo-router/react-navigation";
import { useRouter, useNavigation } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";

const PRIMARY   = "#3D3BF3";
const DANGER    = "#EF4444";
const DARK      = "#111827";
const MUTED     = "#6B7280";
const BORDER    = "#E5E7EB";
const BG_LIGHT  = "#F9FAFB";

type HeaderProps = { title: string; subtitle?: string };

export default function Header({ title, subtitle }: HeaderProps) {
  const navigation  = useNavigation();
  const router      = useRouter();
  const { user, profile } = useAuth() as any;
  const userProfile = profile as { full_name?: string; avatar_url?: string; role?: string } | null;

  // ── Announcement state ──────────────────────────────────────
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [readIds,       setReadIds]       = useState<Set<string>>(new Set());
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim    = useRef(new Animated.Value(0)).current;

  // ── Fetch announcements ─────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: ann }, { data: reads }] = await Promise.all([
        supabase
          .from("announcements")
          .select("*, admin:admin_id ( full_name )")
          .order("created_at", { ascending: false }),
        supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", user.id),
      ]);
      const readSet = new Set<string>((reads || []).map((r: any) => r.announcement_id));
      setReadIds(readSet);
      setAnnouncements(ann || []);
      setUnreadCount((ann || []).filter((a: any) => !readSet.has(a.id)).length);
    } catch (err) {
      console.error("fetchAnnouncements error:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAnnouncements();
    intervalRef.current = setInterval(fetchAnnouncements, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAnnouncements, user]);

  // ── Animate dropdown ────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showDropdown ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showDropdown]);

  // ── Mark single read ────────────────────────────────────────
  const markRead = async (id: string) => {
    if (!user || readIds.has(id)) return;
    await supabase.from("announcement_reads").upsert({
      announcement_id: id,
      user_id: user.id,
    });
    setReadIds(prev => new Set([...prev, id]));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // ── Mark all read ───────────────────────────────────────────
  const markAllRead = async () => {
    if (!user) return;
    const unread = announcements.filter(a => !readIds.has(a.id));
    if (!unread.length) return;
    await supabase.from("announcement_reads").upsert(
      unread.map(a => ({ announcement_id: a.id, user_id: user.id }))
    );
    setReadIds(new Set(announcements.map(a => a.id)));
    setUnreadCount(0);
  };

  const handleAnnouncementPress = (item: any) => {
    markRead(item.id);
    setShowDropdown(false);
    router.push("/(drawer)/messages" as any);
  };

  const handleViewAll = () => {
    setShowDropdown(false);
    router.push("/(drawer)/messages" as any);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  return (
    <View style={styles.container}>
      {/* ── Left: menu + title ── */}
      <View style={styles.left}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={styles.menuBtn}
        >
          <Ionicons name="menu" size={26} color={DARK} />
        </TouchableOpacity>
        <Image
          source={require("../../assets/images/logo-mark.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <View style={styles.titleContainer}>
          <Text style={styles.logo}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      {/* ── Right: bell + avatar ── */}
      <View style={styles.right}>

        {/* Notification bell */}
        <TouchableOpacity
          style={[styles.iconBtn, showDropdown && styles.iconBtnActive]}
          onPress={() => setShowDropdown(p => !p)}
        >
          <Ionicons
            name={showDropdown ? "notifications" : "notifications-outline"}
            size={22}
            color={showDropdown ? PRIMARY : DARK}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Avatar — tapping navigates to My Profile */}
        <TouchableOpacity
          onPress={() => router.push("/(drawer)/profile" as any)}
          activeOpacity={0.8}
        >
          <Avatar src={userProfile?.avatar_url} name={userProfile?.full_name} role={userProfile?.role} size={38} />
        </TouchableOpacity>
      </View>

      {/* ── Notification Dropdown ── */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="none"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.dropdown, {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
          }],
        }]}>
          {/* Dropdown header */}
          <View style={styles.dropHead}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.dropTitle}>Announcements</Text>
              {unreadCount > 0 && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead}>
                <Text style={styles.markAll}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Announcement list */}
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {announcements.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={30} color={MUTED} />
                <Text style={styles.emptyText}>No announcements yet</Text>
              </View>
            ) : (
              announcements.map((item: any) => {
                const isUnread = !readIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.annRow, isUnread && styles.annRowUnread]}
                    onPress={() => handleAnnouncementPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dotWrap}>
                      <View style={[styles.dot, { backgroundColor: isUnread ? PRIMARY : BORDER }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.annTitle, isUnread && { color: DARK, fontWeight: "700" }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.annBody} numberOfLines={2}>{item.body}</Text>
                      <Text style={styles.annDate}>{formatDate(item.created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          {announcements.length > 0 && (
            <TouchableOpacity style={styles.dropFooter} onPress={handleViewAll}>
              <Text style={styles.viewAll}>View All in Messages</Text>
              <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 90,
    paddingTop: 45,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  left:           { flexDirection: "row", alignItems: "center", flex: 1 },
  menuBtn:        { padding: 4 },
  logoImg:        { width: 32, height: 32, marginLeft: 10 },
  titleContainer: { marginLeft: 8 },
  logo:           { fontSize: 17, fontWeight: "800", color: PRIMARY },
  subtitle:       { fontSize: 12, color: MUTED, marginTop: 1 },
  right:          { flexDirection: "row", alignItems: "center", gap: 10 },

  // Bell button
  iconBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  iconBtnActive: { backgroundColor: "#EBEBFF" },
  badge: {
    position: "absolute", top: 5, right: 5,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: DANGER,
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },

  // Avatar — now a TouchableOpacity
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: PRIMARY,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },

  // Modal overlay
  overlay: { flex: 1, backgroundColor: "transparent" },

  // Dropdown panel
  dropdown: {
    position: "absolute", top: 90, right: 16,
    width: 320, maxHeight: 420,
    backgroundColor: "#fff",
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
    overflow: "hidden", zIndex: 9999,
  },

  // Dropdown header
  dropHead: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: BG_LIGHT,
  },
  dropTitle:  { fontSize: 14, fontWeight: "700", color: DARK },
  pill:       { backgroundColor: DANGER, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillText:   { color: "#fff", fontSize: 11, fontWeight: "700" },
  markAll:    { fontSize: 11, color: PRIMARY, fontWeight: "600" },

  // Announcement row
  annRow:       { flexDirection: "row", padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: "#fff" },
  annRowUnread: { backgroundColor: "#F5F5FF" },
  dotWrap:      { marginTop: 4, marginRight: 10, width: 10, alignItems: "center" },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  annTitle:     { fontSize: 13, fontWeight: "600", color: MUTED, marginBottom: 2 },
  annBody:      { fontSize: 12, color: MUTED, lineHeight: 17, marginBottom: 4 },
  annDate:      { fontSize: 10, color: "#9CA3AF" },

  // Empty state
  empty:     { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: MUTED },

  // Footer
  dropFooter: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
    gap: 4, backgroundColor: BG_LIGHT,
  },
  viewAll: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
});
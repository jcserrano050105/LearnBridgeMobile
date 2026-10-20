import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from "react-native";
import { Drawer, DrawerContentScrollView, DrawerContentComponentProps } from "expo-router/drawer";
import { useEffect, useState } from "react";
import { usePathname, useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import LearnBot from "../../components/LearnBot";
import Avatar from "../../components/Avatar";

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";

type NavItem = { name: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const NAV_PARENT: NavItem[] = [
  { name: "dashboard",  label: "Dashboard",   icon: "home-outline"       },
  { name: "profile",    label: "My Profile",  icon: "person-outline"     },
  { name: "children",   label: "My Children", icon: "people-outline"     },
  { name: "tutors",     label: "Find Tutors", icon: "search-outline"     },
  { name: "bookings",   label: "Bookings",    icon: "calendar-outline"   },
  { name: "progress",   label: "Sessions",    icon: "book-outline"       },
  { name: "wallet",     label: "Wallet",      icon: "wallet-outline"     },
  { name: "messages",   label: "Messages",    icon: "chatbubble-outline" },
];

const NAV_TUTOR: NavItem[] = [
  { name: "dashboard",     label: "Dashboard",     icon: "home-outline"       },
  { name: "profile",       label: "My Profile",    icon: "person-outline"     },
  { name: "bookings",      label: "Bookings",      icon: "calendar-outline"   },
  { name: "sessions",      label: "Sessions",      icon: "book-outline"       },
  { name: "certification", label: "Certification", icon: "ribbon-outline"     },
  { name: "calendar",      label: "Calendar",      icon: "today-outline"      },
  { name: "wallet",        label: "Wallet",        icon: "wallet-outline"     },
  { name: "messages",      label: "Messages",      icon: "chatbubble-outline" },
];

const NAV_ADMIN: NavItem[] = [
  { name: "admin-dashboard",    label: "Dashboard",    icon: "home-outline"            },
  { name: "admin-verification", label: "Verification", icon: "shield-checkmark-outline"},
  { name: "sessions",           label: "All Sessions", icon: "calendar-outline"        },
  { name: "messages",           label: "Messages",     icon: "chatbubble-outline"      },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { profile, signOut, loading } = useAuth() as any;
  const pathname = usePathname();
  const router   = useRouter();
  const { unreadCount } = useAnnouncements();

  const handleSignOut = async () => {
    try { await signOut(); }
    catch (e: any) { console.error("Sign out error:", e.message); }
    router.replace("/login" as any);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={PRIMARY} /></View>;
  }

  const role        = profile?.role || "parent";
  const nav         = role === "tutor" ? NAV_TUTOR : role === "admin" ? NAV_ADMIN : NAV_PARENT;
  const currentPage = pathname.split("/").pop() || "dashboard";

  return (
    <View style={s.wrap}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoBox}>
          <Image source={require("../../../assets/images/logo-mark.png")} style={s.logoImg} resizeMode="contain" />
        </View>
        <View>
          <Text style={s.logoName}>LearnBridge</Text>
          <Text style={s.logoRole}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
        </View>
      </View>

      {/* Nav */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {nav.map(item => {
          const isActive = currentPage === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[s.navItem, isActive && s.navItemActive]}
              onPress={() => props.navigation.navigate(item.name)}
            >
              <Ionicons name={item.icon} size={20} color={isActive ? PRIMARY : MUTED} />
              <Text style={[s.navLabel, isActive && s.navLabelActive]}>{item.label}</Text>
              {/* Website Sidebar: unread announcements badge on Messages */}
              {item.name === "messages" && role !== "admin" && unreadCount > 0 && (
                <View style={s.navBadge}>
                  <Text style={s.navBadgeTxt}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
              {isActive && <View style={s.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerUser}>
          <Avatar src={profile?.avatar_url} name={profile?.full_name} role={profile?.role} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={s.footerName} numberOfLines={1}>{profile?.full_name || "User"}</Text>
            <Text style={s.footerEmail} numberOfLines={1}>{profile?.email || ""}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={MUTED} />
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DrawerLayout() {
  const { user, profile, loading } = useAuth() as any;
  const isTutor = profile?.role === "tutor";
  const [tutorStatus, setTutorStatus] = useState<string | null>(null);

  // Tutors must be approved before using the app (website: LoginPage → /pending-approval).
  // Checked here rather than only at login because the app keeps users signed in.
  useEffect(() => {
    if (!isTutor || !user) return;
    supabase.from("tutors").select("status").eq("id", user.id).single()
      .then(({ data }) => setTutorStatus(data?.status || "pending"));
  }, [isTutor, user?.id]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={PRIMARY} /></View>;
  }
  // Signed out (or session expired): leave the app screens immediately so none of them
  // render without a user (e.g. reading user.id during sign-out).
  if (!user) {
    return <Redirect href={"/login" as any} />;
  }
  if (isTutor && tutorStatus === null) {
    return <View style={s.center}><ActivityIndicator color={PRIMARY} /></View>;
  }
  if (isTutor && tutorStatus !== "approved") {
    return <Redirect href={"/pending-approval" as any} />;
  }

  return (
    <ImageBackground
      source={require("../../../assets/images/page-bg.png")}
      style={s.pageBg}
      resizeMode="cover"
    >
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerStyle: { width: 280 },
          // Transparent so the shared background image shows behind each page
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        {/* Shared */}
        <Drawer.Screen name="dashboard"          options={{ title: "Dashboard"     }} />
        <Drawer.Screen name="profile"            options={{ title: "My Profile"    }} />
        <Drawer.Screen name="children"           options={{ title: "My Children"   }} />
        <Drawer.Screen name="tutors"             options={{ title: "Find Tutors"   }} />
        <Drawer.Screen name="bookings"           options={{ title: "Bookings"      }} />
        <Drawer.Screen name="progress"           options={{ title: "Sessions"      }} />
        <Drawer.Screen name="sessions"           options={{ title: "Sessions"      }} />
        <Drawer.Screen name="certification"      options={{ title: "Certification" }} />
        <Drawer.Screen name="calendar"           options={{ title: "Calendar"      }} />
        <Drawer.Screen name="wallet"             options={{ title: "Wallet"        }} />
        <Drawer.Screen name="messages"           options={{ title: "Messages"      }} />
        <Drawer.Screen name="verification"       options={{ title: "Verification"  }} />

        {/* Admin-only */}
        <Drawer.Screen name="admin-dashboard"    options={{ title: "Admin Dashboard"    }} />
        <Drawer.Screen name="admin-verification" options={{ title: "Tutor Verification" }} />
      </Drawer>
      <LearnBot />
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  pageBg:          { flex: 1, backgroundColor: "#F5F7FB" },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  wrap:            { flex: 1, backgroundColor: "#111827" },
  header:          { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  logoBox:         { width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  logoImg:         { width: 38, height: 38 },
  logoName:        { color: "#fff", fontWeight: "800", fontSize: 16 },
  logoRole:        { color: MUTED, fontSize: 12, marginTop: 2 },
  navItem:         { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 20, marginHorizontal: 10, borderRadius: 10, marginBottom: 2, position: "relative" },
  navItemActive:   { backgroundColor: "#1F2937" },
  navLabel:        { fontSize: 14, color: MUTED, fontWeight: "500", flex: 1 },
  navLabelActive:  { color: "#fff", fontWeight: "700" },
  navBadge:        { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginRight: 6 },
  navBadgeTxt:     { color: "#fff", fontSize: 10, fontWeight: "800" },
  activeBar:       { position: "absolute", right: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 3, backgroundColor: PRIMARY },
  footer:          { borderTopWidth: 1, borderTopColor: "#1F2937", paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 },
  footerUser:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  footerAvatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  footerAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  footerName:      { fontSize: 13, fontWeight: "700", color: "#fff" },
  footerEmail:     { fontSize: 11, color: MUTED, marginTop: 2 },
  signOutBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#1F2937", borderRadius: 10 },
  signOutTxt:      { fontSize: 13, color: MUTED, fontWeight: "600" },
});
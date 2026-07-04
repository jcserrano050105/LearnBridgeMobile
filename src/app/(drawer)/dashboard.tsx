import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import ParentDashboard from "../../screens/parent/ParentDashboard";
import TutorDashboard from "../../screens/tutor/TutorDashboard";

export default function DashboardScreen() {
  const { profile, loading } = useAuth() as any;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (profile?.role === "admin") {
      router.replace("/(drawer)/admin-dashboard" as any);
    }
  }, [profile, loading]);

  if (loading || profile?.role === "admin") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3D3BF3" />
      </View>
    );
  }

  if (profile?.role === "tutor") return <TutorDashboard />;
  return <ParentDashboard />;
}
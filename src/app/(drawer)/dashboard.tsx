import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import ParentDashboard from "../../screens/parent/ParentDashboard";
import TutorDashboard from "../../screens/tutor/TutorDashboard";

export default function Dashboard() {
  const { profile, loading } = useAuth() as any;

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3D3BF3" />
      </View>
    );
  }

  if (profile.role === "tutor") return <TutorDashboard />;
  return <ParentDashboard />;
}
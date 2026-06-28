import { ScrollView, Text, View, StyleSheet } from "react-native";
import Header from "../../components/Header";
import StatCard from "../../components/dashboard/StatCard";
import QuickAction from "../../components/dashboard/QuickAction";
import RecentBookingCard from "../../components/dashboard/RecentBookingCard";
import useParentDashboard from "../../hooks/useParentDashboard";
import { useAuth } from "../../context/AuthContext";


export default function ParentDashboard() {

  const { profile } = useAuth();

  const {
    loading,
    students,
    bookings,
  } = useParentDashboard();

  const firstName =
    (profile as any)?.full_name?.split(" ")[0] || "Parent";

  return (
    <View style={styles.container}>
      <Header title="Parent Dashboard" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.welcome}>
  Good Morning, {firstName} 👋
</Text>

        <Text style={styles.subtitle}>
          Welcome back to LearnBridge
        </Text>

        <View style={styles.stats}>
          <StatCard
            title="Active Children"
            value={students.length}
            color="#3D3BF3"
          />

          <StatCard
            title="Bookings"
            value={bookings.length}
            color="#F59E0B"
          />

          <StatCard
            title="Progress"
            value="87%"
            color="#10B981"
          />

          <StatCard
            title="Tutors"
            value="12"
            color="#EF4444"
          />
        </View>

        <Text style={styles.section}>
          Quick Actions
        </Text>

        <View style={styles.quickActions}>
          <QuickAction
            title="My Children"
            icon="people"
            onPress={() => {}}
          />

          <QuickAction
            title="Find Tutors"
            icon="search"
            onPress={() => {}}
          />

          <QuickAction
            title="Bookings"
            icon="calendar"
            onPress={() => {}}
          />

          <QuickAction
            title="Progress"
            icon="stats-chart"
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  welcome: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },

  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 5,
    marginBottom: 25,
  },

  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  section: {
    marginTop: 20,
    marginBottom: 15,
    fontSize: 20,
    fontWeight: "700",
  },

  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
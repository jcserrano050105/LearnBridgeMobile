import { Drawer } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        // Hide Expo's default header because
        // we'll use our own Header component
        headerShown: false,

        drawerActiveTintColor: "#3D3BF3",
        drawerInactiveTintColor: "#6B7280",

        drawerStyle: {
          width: 280,
          backgroundColor: "#FFFFFF",
        },

        sceneStyle: {
          backgroundColor: "#F5F7FB",
        },
      }}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="children"
        options={{
          title: "My Children",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="tutors"
        options={{
          title: "Find Tutors",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="bookings"
        options={{
          title: "Bookings",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="progress"
        options={{
          title: "Progress",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="messages"
        options={{
          title: "Messages",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubble" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}


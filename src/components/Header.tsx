import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";

type HeaderProps = {
  title: string;
  subtitle?: string;
};

export default function Header({
  title,
  subtitle,
}: HeaderProps) {
  const navigation = useNavigation();
  const { profile } = useAuth();

  // Temporary until AuthContext is fully typed
  const userProfile = profile as {
    full_name?: string;
  } | null;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={28} color="#111827" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
  <Text style={styles.logo}>{title}</Text>

  <Text style={styles.subtitle}>
    {subtitle ?? title}
  </Text>
</View>
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {userProfile?.full_name?.charAt(0) ?? "U"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 85,
    paddingTop: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
  },

  titleContainer: {
    marginLeft: 15,
  },

  logo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3D3BF3",
  },

  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#3D3BF3",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
});


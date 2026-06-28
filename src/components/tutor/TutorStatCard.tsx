import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export default function TutorStatCard({
  title,
  value,
  icon,
  color,
}: Props) {
  return (
    <View style={styles.card}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: color + "20" },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={color}
        />
      </View>

      <Text style={styles.value}>
        {value}
      </Text>

      <Text style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,

    elevation: 4,
  },

  iconContainer: {
    width: 48,
    height: 48,

    borderRadius: 24,

    justifyContent: "center",
    alignItems: "center",
  },

  value: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },

  title: {
    marginTop: 5,
    color: "#6B7280",
    fontSize: 13,
  },
});
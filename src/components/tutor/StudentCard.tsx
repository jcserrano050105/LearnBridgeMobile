import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  grade: string;
  subject: string;
  progress: number;
  onPress?: () => void;
};

export default function StudentCard({
  name,
  grade,
  subject,
  progress,
  onPress,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Ionicons
          name="person"
          size={26}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>
          {name}
        </Text>

        <Text style={styles.info}>
          {grade}
        </Text>

        <Text style={styles.info}>
          {subject}
        </Text>

        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {progress}% Learning Progress
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",

    borderRadius: 18,

    padding: 18,

    marginBottom: 15,

    flexDirection: "row",

    alignItems: "center",

    shadowColor: "#000",

    shadowOpacity: 0.05,

    shadowRadius: 8,

    elevation: 4,
  },

  avatar: {
    width: 55,
    height: 55,

    borderRadius: 28,

    backgroundColor: "#3D3BF3",

    justifyContent: "center",

    alignItems: "center",
  },

  content: {
    flex: 1,

    marginLeft: 15,
  },

  name: {
    fontSize: 17,

    fontWeight: "700",

    color: "#111827",
  },

  info: {
    marginTop: 2,

    color: "#6B7280",

    fontSize: 13,
  },

  progressBackground: {
    marginTop: 12,

    width: "100%",

    height: 8,

    backgroundColor: "#E5E7EB",

    borderRadius: 5,
  },

  progressFill: {
    height: 8,

    backgroundColor: "#3D3BF3",

    borderRadius: 5,
  },

  progressText: {
    marginTop: 8,

    color: "#6B7280",

    fontSize: 12,
  },

  button: {
    width: 38,
    height: 38,

    borderRadius: 19,

    backgroundColor: "#3D3BF3",

    justifyContent: "center",

    alignItems: "center",
  },
});


import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  student: string;
  subject: string;
  date: string;
  time: string;
  status: string;
};

export default function UpcomingSessionCard({
  student,
  subject,
  date,
  time,
  status,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.subject}>
          {subject}
        </Text>

        <Text style={styles.student}>
          {student}
        </Text>

        <View style={styles.row}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color="#6B7280"
          />

          <Text style={styles.info}>
            {date}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons
            name="time-outline"
            size={14}
            color="#6B7280"
          />

          <Text style={styles.info}>
            {time}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.status,
          {
            backgroundColor:
              status === "Confirmed"
                ? "#DCFCE7"
                : "#FEF3C7",
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            {
              color:
                status === "Confirmed"
                  ? "#15803D"
                  : "#B45309",
            },
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,

    flexDirection: "row",
    justifyContent: "space-between",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,

    elevation: 4,
  },

  left: {
    flex: 1,
  },

  subject: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  student: {
    marginTop: 4,
    color: "#6B7280",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  info: {
    marginLeft: 6,
    color: "#6B7280",
    fontSize: 13,
  },

  status: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },

  statusText: {
    fontWeight: "700",
    fontSize: 12,
  },
});
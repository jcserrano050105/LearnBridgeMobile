import { View, Text, StyleSheet } from "react-native";

type Props = {
  subject: string;
  tutor: string;
  date: string;
  status: string;
};

export default function RecentBookingCard({
  subject,
  tutor,
  date,
  status,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.subject}>{subject}</Text>

        <Text style={styles.tutor}>
          {tutor}
        </Text>

        <Text style={styles.date}>
          {date}
        </Text>
      </View>

      <View
        style={[
          styles.badge,
          {
            backgroundColor:
              status === "confirmed"
                ? "#DCFCE7"
                : "#FEF3C7",
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            {
              color:
                status === "confirmed"
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
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 18,
    marginBottom: 15,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,

    elevation: 3,
  },

  subject: {
    fontWeight: "700",
    fontSize: 16,
  },

  tutor: {
    color: "#6B7280",
    marginTop: 3,
  },

  date: {
    color: "#3D3BF3",
    marginTop: 6,
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  badgeText: {
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
});

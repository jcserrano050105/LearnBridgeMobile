import { View, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
  value: string | number;
  color: string;
};

export default function StatCard({
  title,
  value,
  color,
}: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 5,
    marginBottom: 15,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 5,
  },

  value: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },

  title: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
  },
});
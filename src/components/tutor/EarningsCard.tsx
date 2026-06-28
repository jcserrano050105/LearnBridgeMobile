import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  total: number;
  pending: number;
};

export default function EarningsCard({
  total,
  pending,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons
          name="wallet"
          size={28}
          color="#3D3BF3"
        />

        <Text style={styles.title}>
          Earnings
        </Text>
      </View>

      <Text style={styles.amount}>
        ₱ {total.toLocaleString()}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.pending}>
          Pending
        </Text>

        <Text style={styles.pendingAmount}>
          ₱ {pending.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,

    elevation: 4,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    marginLeft: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  amount: {
    marginTop: 20,
    fontSize: 34,
    fontWeight: "800",
    color: "#3D3BF3",
  },

  footer: {
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  pending: {
    color: "#6B7280",
  },

  pendingAmount: {
    color: "#EF4444",
    fontWeight: "700",
  },
});
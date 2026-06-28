import React from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
} from "react-native";

import Header from "../../components/Header";

import TutorStatCard from "../../components/tutor/TutorStatCard";
import EarningsCard from "../../components/tutor/EarningsCard";
import UpcomingSessionCard from "../../components/tutor/UpcomingSessionCard";
import StudentCard from "../../components/tutor/StudentCard";
import useTutorDashboard from "../../hooks/useTutorDashboard";

export default function TutorDashboard() {
  const {
  loading,
  sessions,
  students,
  wallet,
} = useTutorDashboard();
    return (
    <View style={styles.container}>

      <Header
        title="LearnBridge"
        subtitle="Tutor Dashboard"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <Text style={styles.greeting}>
          Good Morning 👋
        </Text>

        <Text style={styles.subtitle}>
          Welcome back Tutor
        </Text>

        <View style={styles.stats}>

          <TutorStatCard
            title="Sessions"
            value={sessions.length}
            icon="calendar"
            color="#3D3BF3"
          />

          <TutorStatCard
            title="Students"
            value={students.length}
            icon="people"
            color="#10B981"
          />

          <TutorStatCard
            title="Rating"
            value="4.9"
            icon="star"
            color="#F59E0B"
          />

          <TutorStatCard
            title="Reviews"
            value={47}
            icon="chatbubble"
            color="#EF4444"
          />

        </View>

        <EarningsCard
          total={wallet?.balance || 0}
          pending={wallet?.pending || 0}
        />

        <Text style={styles.section}>
          Upcoming Sessions
        </Text>

        <UpcomingSessionCard
          student="Juan Dela Cruz"
          subject="Mathematics"
          date="Today"
          time="3:00 PM"
          status="Confirmed"
        />

        <UpcomingSessionCard
          student="Maria Santos"
          subject="English"
          date="Tomorrow"
          time="9:00 AM"
          status="Pending"
        />

        <Text style={styles.section}>
          Assigned Students
        </Text>

        <StudentCard
          name="Juan Dela Cruz"
          grade="Grade 5"
          subject="Mathematics"
          progress={78}
        />

        <StudentCard
          name="Maria Santos"
          grade="Grade 6"
          subject="Science"
          progress={92}
        />

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:"#F5F7FB",
  },

  content:{
    padding:20,
    paddingBottom:50,
  },

  greeting:{
    fontSize:28,
    fontWeight:"800",
    color:"#111827",
  },

  subtitle:{
    marginTop:4,
    color:"#6B7280",
    marginBottom:25,
  },

  stats:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-between",
  },

  section:{
    marginTop:25,
    marginBottom:15,
    fontSize:20,
    fontWeight:"700",
    color:"#111827",
  },

});
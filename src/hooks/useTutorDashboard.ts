import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function useTutorDashboard() {
  const { user } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);

  async function loadDashboard() {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .eq("tutor_id", user.id);

      setSessions(sessionsData ?? []);

      const { data: studentsData } = await supabase
        .from("students")
        .select("*")
        .eq("tutor_id", user.id);

      setStudents(studentsData ?? []);

      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("tutor_id", user.id)
        .single();

      setWallet(walletData);

    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return {
    loading,
    sessions,
    students,
    wallet,
    refresh: loadDashboard,
  };
}
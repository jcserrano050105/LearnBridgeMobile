import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function useParentDashboard() {
  const { user } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  async function loadDashboard() {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data: studentsData } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", user.id);

      setStudents(studentsData ?? []);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*")
        .eq("parent_id", user.id);

      setBookings(bookingsData ?? []);

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
    students,
    bookings,
    refresh: loadDashboard,
  };
}
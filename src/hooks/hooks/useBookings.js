import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        tutor:tutor_id   ( id, full_name, email ),
        parent:parent_id ( id, full_name, email ),
        student:student_id ( id, name, grade_level )
      `)
      .or(`parent_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!error) setBookings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const createBooking = async (payload) => {
    const { data, error } = await supabase
      .from('bookings')
      .insert({ ...payload, parent_id: user.id, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    await fetchBookings();
    return data;
  };

  const updateBookingStatus = async (id, status) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    await fetchBookings();
  };

  // Tutor clicks "Complete" → pending_parent_confirm
  const markComplete = async (bookingId) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'pending_parent_confirm' })
      .eq('id', bookingId);
    if (error) throw error;
    await fetchBookings();
  };

  // Parent clicks "Confirm" → creates session record + marks booking completed
  const confirmComplete = async (bookingId, feedback) => {
    // Create session record with feedback — no session_number
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        booking_id:            bookingId,
        scheduled_date:        new Date().toISOString().split('T')[0],
        status:                'completed',
        topic_covered:         feedback.topic,
        performance_indicator: feedback.indicator,
        tutor_comments:        feedback.comments || '',
      });

    if (sessionError) throw new Error('Failed to save feedback: ' + sessionError.message);

    // Mark booking as completed
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId);

    if (bookingError) throw new Error('Failed to complete booking: ' + bookingError.message);

    await fetchBookings();
  };

  return {
    bookings,
    loading,
    createBooking,
    updateBookingStatus,
    markComplete,
    confirmComplete,
    refresh: fetchBookings,
  };
}
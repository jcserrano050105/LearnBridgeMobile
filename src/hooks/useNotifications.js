import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 20000;
const MAX_STORED = 50;

function storageKey(userId) {
  return `lb_notifications_${userId}`;
}

function loadStored(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function saveStored(userId, list) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, MAX_STORED)));
  } catch {}
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const TEMPLATES = {
  booking_request: (b) => ({
    type: 'booking_request',
    title: '📅 New Booking Request',
    body: `${b.parent?.full_name || 'A parent'} booked a ${b.subject} session for ${b.student?.name || 'their child'}.`,
    link: '/bookings',
  }),
  booking_accepted: (b) => ({
    type: 'booking_accepted',
    title: '✅ Booking Accepted',
    body: `${b.tutor?.full_name || 'Your tutor'} accepted your ${b.subject} session request.`,
    link: '/bookings',
  }),
  booking_rejected: (b) => ({
    type: 'booking_rejected',
    title: '❌ Booking Rejected',
    body: `${b.tutor?.full_name || 'Your tutor'} was unable to confirm the ${b.subject} session. You can book another tutor.`,
    link: '/bookings',
  }),
  session_complete: (b) => ({
    type: 'session_complete',
    title: '🎓 Session Completed – Action Required',
    body: `${b.tutor?.full_name || 'Your tutor'} marked the ${b.subject} session as complete. Please confirm and rate.`,
    link: '/bookings',
  }),
  session_confirmed: (b) => ({
    type: 'session_confirmed',
    title: '⭐ Session Confirmed by Parent',
    body: `${b.parent?.full_name || 'The parent'} confirmed and rated the ${b.subject} session for ${b.student?.name || 'their child'}.`,
    link: '/bookings',
  }),
  new_message: (m, otherName) => ({
    type: 'new_message',
    title: '💬 New Message',
    body: `${otherName || 'Someone'} sent you a message.`,
    link: '/messages',
  }),
  wallet_low: (balance) => ({
    type: 'wallet_low',
    title: '⚠️ Low Wallet Balance',
    body: `Your wallet balance is ₱${Number(balance).toLocaleString()}. Top up to keep accepting bookings.`,
    link: '/wallet',
  }),
};

export function useNotifications() {
  const { user, profile } = useAuth();
  const role = profile?.role;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const prevBookings = useRef(null);
  const prevMessages = useRef(null);
  const prevWallet = useRef(null);
  const walletWarned = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const stored = loadStored(user.id);
    setNotifications(stored);
    setUnreadCount(stored.filter(n => !n.read).length);
  }, [user]);

  const persist = useCallback((list) => {
    if (!user) return;
    saveStored(user.id, list);
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.read).length);
  }, [user]);

  const addNotification = useCallback((template, bookingId = null) => {
    setNotifications(prev => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const duplicate = prev.some(n =>
        n.type === template.type &&
        (!bookingId || n.bookingId === bookingId) &&
        new Date(n.createdAt).getTime() > cutoff
      );
      if (duplicate) return prev;
      const entry = {
        id: makeId(),
        bookingId,
        ...template,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [entry, ...prev].slice(0, MAX_STORED);
      saveStored(user.id, updated);
      setUnreadCount(c => c + 1);
      return updated;
    });
  }, [user]);

  const poll = useCallback(async () => {
    if (!user || !role || role === 'admin') return;
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id, status, subject, created_at,
          tutor:tutor_id ( id, full_name ),
          parent:parent_id ( id, full_name ),
          student:student_id ( name )
        `)
        .or(role === 'tutor' ? `tutor_id.eq.${user.id}` : `parent_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(30);

      const bList = bookings || [];

      if (prevBookings.current !== null) {
        const prev = prevBookings.current;
        for (const b of bList) {
          const oldStatus = prev.get(b.id);
          const newStatus = b.status;
          if (oldStatus === undefined) {
            if (role === 'tutor' && newStatus === 'pending') {
              addNotification(TEMPLATES.booking_request(b), b.id);
            }
          } else if (oldStatus !== newStatus) {
            if (role === 'parent') {
              if (newStatus === 'confirmed')              addNotification(TEMPLATES.booking_accepted(b), b.id);
              if (newStatus === 'rejected')               addNotification(TEMPLATES.booking_rejected(b), b.id);
              if (newStatus === 'pending_parent_confirm') addNotification(TEMPLATES.session_complete(b), b.id);
            }
            if (role === 'tutor') {
              if (newStatus === 'completed') addNotification(TEMPLATES.session_confirmed(b), b.id);
            }
          }
        }
      }

      prevBookings.current = new Map(bList.map(b => [b.id, b.status]));

      if (bList.length > 0) {
        const bookingIds = bList.map(b => b.id);
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, booking_id, sender_id, created_at, sender:sender_id ( full_name )')
          .in('booking_id', bookingIds)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        const msgList = msgs || [];

        if (prevMessages.current !== null) {
          const prev = prevMessages.current;
          const latestPerBooking = {};
          for (const m of msgList) {
            if (!latestPerBooking[m.booking_id]) latestPerBooking[m.booking_id] = m;
          }
          for (const [bId, m] of Object.entries(latestPerBooking)) {
            const prevId = prev.get(bId);
            if (prevId !== m.id) {
              addNotification(TEMPLATES.new_message(m, m.sender?.full_name), bId);
            }
          }
        }

        prevMessages.current = new Map(
          Object.entries(
            msgList.reduce((acc, m) => {
              if (!acc[m.booking_id]) acc[m.booking_id] = m.id;
              return acc;
            }, {})
          )
        );
      }

      if (role === 'tutor') {
        const { data: tutorRow } = await supabase
          .from('tutors')
          .select('wallet_balance')
          .eq('id', user.id)
          .single();

        const balance = Number(tutorRow?.wallet_balance || 0);

        if (prevWallet.current !== null) {
          if (balance < 500 && !walletWarned.current) {
            walletWarned.current = true;
            addNotification(TEMPLATES.wallet_low(balance), null);
          } else if (balance >= 500) {
            walletWarned.current = false;
          }
        }

        prevWallet.current = balance;
      }
    } catch (err) {
      console.error('[useNotifications] poll error:', err);
    }
  }, [user, role, addNotification]);

  useEffect(() => {
    if (!user || !role || role === 'admin') return;
    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [poll, user, role]);

  const markRead = useCallback((id) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  const dismiss = useCallback((id) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    dismiss,
  };
}
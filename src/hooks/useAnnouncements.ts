import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  admin_id: string;
  admin?: { full_name: string };
}

export function useAnnouncements() {
  const { user, profile } = useAuth() as any;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds,       setReadIds]       = useState<Set<string>>(new Set());
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;

    try {
      const [{ data: ann }, { data: reads }] = await Promise.all([
        supabase
          .from('announcements')
          .select('*, admin:admin_id ( full_name )')
          .order('created_at', { ascending: false }),
        supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', user.id),
      ]);

      const readSet = new Set<string>((reads || []).map((r: any) => r.announcement_id));
      setReadIds(readSet);
      setAnnouncements(ann || []);
      setUnreadCount((ann || []).filter((a: Announcement) => !readSet.has(a.id)).length);
    } catch (err) {
      console.error('useAnnouncements fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchAnnouncements();

    intervalRef.current = setInterval(fetchAnnouncements, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchAnnouncements, user]);

  const markRead = async (announcementId: string) => {
    if (!user || readIds.has(announcementId)) return;
    try {
      await supabase.from('announcement_reads').upsert({
        announcement_id: announcementId,
        user_id: user.id,
      });
      setReadIds(prev => new Set([...prev, announcementId]));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('markRead error:', err);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = announcements.filter(a => !readIds.has(a.id));
    if (unread.length === 0) return;
    try {
      await supabase.from('announcement_reads').upsert(
        unread.map(a => ({ announcement_id: a.id, user_id: user.id }))
      );
      setReadIds(new Set(announcements.map(a => a.id)));
      setUnreadCount(0);
    } catch (err) {
      console.error('markAllRead error:', err);
    }
  };

  const postAnnouncement = async (title: string, body: string) => {
    if (!user) return;
    const { error } = await supabase.from('announcements').insert({
      admin_id: user.id,
      title:    title.trim(),
      body:     body.trim(),
    });
    if (error) throw error;
    await fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    setUnreadCount(prev => {
      const wasUnread = !readIds.has(id);
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });
  };

  return {
    announcements,
    readIds,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    postAnnouncement,
    deleteAnnouncement,
    isAdmin: profile?.role === 'admin',
    refresh: fetchAnnouncements,
  };
}
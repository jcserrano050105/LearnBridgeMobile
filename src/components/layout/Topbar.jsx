import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useNotifications } from '../../hooks/useNotifications';
import tokens from '../../lib/tokens';

const pageNames = {
  '/dashboard':          'Dashboard',
  '/my-children':        'My Children',
  '/find-tutors':        'Find Tutors',
  '/bookings':           'Bookings',
  '/progress':           'Progress',
  '/messages':           'Messages',
  '/my-profile':         'My Profile',
  '/certification':      'AI Certification',
  '/sessions':           'Sessions',
  '/question-bank':      'Question Bank',
  '/wallet':             'Wallet',
  '/tutor-verification': 'Tutor Verification',
  '/users':              'User Management',
  '/transactions':       'Transactions',
  '/settings':           'Settings',
};

const TYPE_ICON = {
  booking_request:   '📅',
  booking_accepted:  '✅',
  booking_rejected:  '❌',
  session_complete:  '🎓',
  session_confirmed: '⭐',
  new_message:       '💬',
  wallet_low:        '⚠️',
};

function timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Topbar() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = pageNames[pathname] || 'LearnBridge';

  const {
    announcements,
    unreadCount: annUnread,
    readIds,
    markRead: markAnnRead,
    markAllRead: markAllAnnRead,
  } = useAnnouncements();

  const {
    notifications,
    unreadCount: actUnread,
    markRead: markActRead,
    markAllRead: markAllActRead,
    dismiss,
  } = useNotifications();

  const totalUnread = annUnread + actUnread;

  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = () => setShowDropdown(prev => !prev);

  const handleActivityClick = (n) => {
    markActRead(n.id);
    setShowDropdown(false);
    if (n.link) navigate(n.link);
  };

  const handleAnnouncementClick = (a) => {
    markAnnRead(a.id);
    setShowDropdown(false);
    navigate('/messages');
  };

  const tabStyle = (active) => ({
    flex: 1,
    padding: '10px 0',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: active ? tokens.primary : tokens.muted,
    borderBottom: `2px solid ${active ? tokens.primary : 'transparent'}`,
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  });

  return (
    <header style={{
      height: 64,
      background: '#fff',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <h1 className="font-jakarta font-bold" style={{ fontSize: 16, color: tokens.dark }}>
        {title}
      </h1>

      <div className="flex items-center gap-12">
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            style={{
              position: 'relative', width: 38, height: 38,
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: showDropdown ? tokens.primaryLight : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            title="Notifications"
          >
            <Icon name="bell" size={19} color={showDropdown ? tokens.primary : tokens.mid} />
            {totalUnread > 0 && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 16, height: 16, borderRadius: '50%',
                background: tokens.danger,
                border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: '#fff',
                animation: 'pulse 2s infinite',
              }}>
                {totalUnread > 9 ? '9+' : totalUnread}
              </div>
            )}
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute', top: 46, right: 0,
              width: 360, maxHeight: 480,
              background: '#fff', borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,.12)',
              overflow: 'hidden', zIndex: 200,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                display: 'flex',
                borderBottom: `1px solid ${tokens.border}`,
                background: '#FAFAFA',
              }}>
                <button style={tabStyle(activeTab === 'activity')} onClick={() => setActiveTab('activity')}>
                  Activity
                  {actUnread > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 20,
                      background: tokens.danger, color: '#fff',
                      fontSize: 10, fontWeight: 800,
                    }}>
                      {actUnread}
                    </span>
                  )}
                </button>
                <button style={tabStyle(activeTab === 'announcements')} onClick={() => setActiveTab('announcements')}>
                  Announcements
                  {annUnread > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 20,
                      background: tokens.danger, color: '#fff',
                      fontSize: 10, fontWeight: 800,
                    }}>
                      {annUnread}
                    </span>
                  )}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
                {activeTab === 'activity' && (
                  <>
                    {notifications.length > 0 && actUnread > 0 && (
                      <div style={{
                        padding: '8px 14px',
                        display: 'flex', justifyContent: 'flex-end',
                        borderBottom: `1px solid ${tokens.border}`,
                        background: '#FAFAFA',
                      }}>
                        <button
                          onClick={markAllActRead}
                          style={{ fontSize: 11, color: tokens.primary, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Mark all read
                        </button>
                      </div>
                    )}
                    {notifications.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.muted, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                        No activity notifications yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleActivityClick(n)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid ${tokens.border}`,
                            cursor: 'pointer',
                            background: n.read ? '#fff' : '#F5F3FF',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#F5F3FF'}
                        >
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: n.read ? '#F3F4F6' : tokens.primaryLight,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                          }}>
                            {TYPE_ICON[n.type] || '🔔'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: n.read ? 500 : 700,
                              color: tokens.dark, lineHeight: 1.3, marginBottom: 2,
                            }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: tokens.muted, lineHeight: 1.4,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {n.body}
                            </div>
                            <div style={{ fontSize: 11, color: tokens.muted, marginTop: 4 }}>
                              {timeAgo(n.createdAt)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {!n.read && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.primary }} />
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                              style={{
                                width: 18, height: 18,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: tokens.muted, fontSize: 14, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 4,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === 'announcements' && (
                  <>
                    {annUnread > 0 && (
                      <div style={{
                        padding: '8px 14px',
                        display: 'flex', justifyContent: 'flex-end',
                        borderBottom: `1px solid ${tokens.border}`,
                        background: '#FAFAFA',
                      }}>
                        <button
                          onClick={markAllAnnRead}
                          style={{ fontSize: 11, color: tokens.primary, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Mark all read
                        </button>
                      </div>
                    )}
                    {announcements.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.muted, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
                        No announcements yet
                      </div>
                    ) : (
                      announcements.map(a => (
                        <div
                          key={a.id}
                          onClick={() => handleAnnouncementClick(a)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid ${tokens.border}`,
                            cursor: 'pointer',
                            background: readIds.has(a.id) ? '#fff' : '#FFF7ED',
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = readIds.has(a.id) ? '#fff' : '#FFF7ED'}
                        >
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: readIds.has(a.id) ? '#F3F4F6' : '#FEF3C7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                          }}>
                            📢
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: readIds.has(a.id) ? 500 : 700,
                              color: tokens.dark, lineHeight: 1.3, marginBottom: 2,
                            }}>
                              {a.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: tokens.muted, lineHeight: 1.4,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {a.body}
                            </div>
                            <div style={{ fontSize: 11, color: tokens.muted, marginTop: 4 }}>
                              {timeAgo(a.created_at)}
                            </div>
                          </div>
                          {!readIds.has(a.id) && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 4 }} />
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>

              <div style={{
                padding: '10px 16px',
                borderTop: `1px solid ${tokens.border}`,
                background: '#FAFAFA',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <button
                  onClick={() => { setShowDropdown(false); navigate('/messages'); }}
                  style={{ fontSize: 12, color: tokens.primary, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  View All in Messages →
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/my-profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
            borderRadius: 10, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = tokens.primaryLight}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size={30} />
          <div style={{ textAlign: 'left' }}>
            <div className="font-jakarta font-bold" style={{ fontSize: 12, color: tokens.dark, lineHeight: 1.2 }}>
              {profile?.full_name?.split(' ')[0] || 'User'}
            </div>
            <div style={{ fontSize: 10, color: tokens.muted, textTransform: 'capitalize' }}>
              {profile?.role || ''}
            </div>
          </div>
        </button>
      </div>
    </header>
  );
}

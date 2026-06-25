import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const PRIMARY      = '#3D3BF3';
const PRIMARY_LIGHT= '#EBEBFF';
const SECONDARY    = '#F5A623';
const TEAL         = '#0D9488';
const CORAL        = '#F25C54';
const MUTED        = '#6B7280';
const BORDER       = '#E5E7EB';
const DARK         = '#111827';

// ── Nav items matching the website sidebar exactly ──
const NAV = {
  parent: [
    { key: 'dashboard',  label: 'Dashboard',  icon: '🏠' },
    { key: 'children',   label: 'My Children',icon: '👨‍👩‍👧' },
    { key: 'tutors',     label: 'Find Tutors', icon: '🔍' },
    { key: 'bookings',   label: 'Bookings',   icon: '📅' },
    { key: 'progress',   label: 'Progress',   icon: '📈' },
    { key: 'messages',   label: 'Messages',   icon: '💬' },
  ],
  tutor: [
    { key: 'dashboard',  label: 'Dashboard',  icon: '🏠' },
    { key: 'profile',    label: 'My Profile', icon: '👤' },
    { key: 'bookings',   label: 'Bookings',   icon: '📅' },
    { key: 'sessions',   label: 'Sessions',   icon: '📖' },
    { key: 'wallet',     label: 'Wallet',     icon: '💰' },
    { key: 'messages',   label: 'Messages',   icon: '💬' },
  ],
  admin: [
    { key: 'dashboard',  label: 'Dashboard',  icon: '🏠' },
    { key: 'verify',     label: 'Verification',icon: '🛡️' },
    { key: 'sessions',   label: 'Sessions',   icon: '📅' },
    { key: 'reports',    label: 'Reports',    icon: '📊' },
  ],
};

// ── Stat Card ──
function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Coming Soon placeholder ──
function ComingSoon({ screen }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonIcon}>🚧</Text>
      <Text style={styles.comingSoonTitle}>{screen}</Text>
      <Text style={styles.comingSoonText}>This screen is coming soon.</Text>
    </View>
  );
}

// ── Parent Home ──
function ParentHome({ name }) {
  const [bookings, setBookings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const { data: s } = await supabase.from('students').select('*').eq('parent_id', user.id);
      setStudents(s || []);
      const { data: b } = await supabase
        .from('bookings')
        .select('*, tutor:tutors(*, profile:profiles(full_name))')
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setBookings(b || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      <Text style={styles.welcome}>Good day, {name} 👋</Text>
      <Text style={styles.subtitle}>Here's your children's learning overview.</Text>

      <View style={styles.statsGrid}>
        <StatCard label="Active Children"   value={students.length.toString()} color={PRIMARY}   />
        <StatCard label="Bookings"          value={bookings.length.toString()} color={SECONDARY} />
        <StatCard label="Hours This Month"  value="12"                         color={TEAL}      />
        <StatCard label="Avg. Performance"  value="Good"                       color={CORAL}     />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Children</Text>
        {students.length === 0
          ? <Text style={styles.emptyText}>No children added yet.</Text>
          : students.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{s.name?.charAt(0) || 'S'}</Text></View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Text style={styles.rowSub}>Grade {s.grade_level} · {s.subject}</Text>
              </View>
            </View>
          ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Bookings</Text>
        {bookings.length === 0
          ? <Text style={styles.emptyText}>No bookings yet.</Text>
          : bookings.map((b, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.dateBox, { backgroundColor: PRIMARY_LIGHT }]}>
                <Text style={[styles.dateText, { color: PRIMARY }]}>{b.status?.slice(0,3).toUpperCase() || 'NEW'}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{b.tutor?.profile?.full_name || 'Tutor'}</Text>
                <Text style={styles.rowSub}>{b.subject} · {b.schedule_date || 'TBD'}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: b.status === 'confirmed' ? '#E1F5EE' : '#FEF3C7' }]}>
                <Text style={[styles.badgeText, { color: b.status === 'confirmed' ? TEAL : SECONDARY }]}>{b.status || 'pending'}</Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

// ── Tutor Home ──
function TutorHome({ name }) {
  const [sessions, setSessions] = useState([]);
  const [wallet,   setWallet]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const { data: t } = await supabase.from('tutors').select('*').eq('profile_id', user.id).single();
      if (t) {
        const { data: s } = await supabase.from('sessions').select('*, booking:bookings(*, student:students(name))').eq('tutor_id', t.id).order('created_at', { ascending: false }).limit(5);
        setSessions(s || []);
        const { data: w } = await supabase.from('wallet_transactions').select('amount').eq('tutor_id', t.id);
        setWallet((w || []).reduce((sum, x) => sum + (x.amount || 0), 0));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      <Text style={styles.welcome}>Welcome back, {name} 👋</Text>
      <Text style={styles.subtitle}>Manage your sessions and wallet.</Text>

      <View style={styles.statsGrid}>
        <StatCard label="Sessions"     value={sessions.length.toString()}           color={PRIMARY}   />
        <StatCard label="Wallet"       value={`₱${wallet.toLocaleString()}`}        color={TEAL}      />
        <StatCard label="Rating"       value="4.8 ★"                               color={SECONDARY} />
        <StatCard label="This Month"   value="18"                                   color={CORAL}     />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Sessions</Text>
        {sessions.length === 0
          ? <Text style={styles.emptyText}>No sessions yet.</Text>
          : sessions.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.dateBox, { backgroundColor: PRIMARY_LIGHT }]}>
                <Text style={[styles.dateText, { color: PRIMARY }]}>{s.status?.slice(0,3).toUpperCase() || 'NEW'}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{s.booking?.student?.name || 'Student'}</Text>
                <Text style={styles.rowSub}>{s.topic || 'Session'} · #{s.session_number || i + 1}</Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

// ── Admin Home ──
function AdminHome() {
  const [stats, setStats]           = useState({ users:0, tutors:0, pending:0, sessions:0 });
  const [pendingTutors, setPending] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count: u } = await supabase.from('profiles').select('*', { count:'exact', head:true });
        const { count: t } = await supabase.from('tutors').select('*', { count:'exact', head:true }).eq('verification_status','approved');
        const { data: p }  = await supabase.from('tutors').select('*, profile:profiles(full_name,email)').eq('verification_status','pending').limit(5);
        const { count: s } = await supabase.from('sessions').select('*', { count:'exact', head:true });
        setStats({ users:u||0, tutors:t||0, pending:p?.length||0, sessions:s||0 });
        setPending(p || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />;

  return (
    <ScrollView>
      <Text style={styles.welcome}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Platform overview and control center.</Text>

      <View style={styles.statsGrid}>
        <StatCard label="Total Users"    value={stats.users.toString()}   color={PRIMARY}   />
        <StatCard label="Active Tutors"  value={stats.tutors.toString()}  color={TEAL}      />
        <StatCard label="Pending"        value={stats.pending.toString()} color={SECONDARY} />
        <StatCard label="Sessions"       value={stats.sessions.toString()} color={CORAL}   />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pending Tutor Verifications</Text>
        {pendingTutors.length === 0
          ? <Text style={styles.emptyText}>No pending verifications.</Text>
          : pendingTutors.map((t, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{t.profile?.full_name?.charAt(0) || 'T'}</Text></View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{t.profile?.full_name || 'Tutor'}</Text>
                <Text style={styles.rowSub}>{t.profile?.email}</Text>
              </View>
              <TouchableOpacity style={[styles.badge, { backgroundColor: PRIMARY_LIGHT }]}>
                <Text style={[styles.badgeText, { color: PRIMARY }]}>Review</Text>
              </TouchableOpacity>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

// ── Render screen based on active tab ──
function renderScreen(activeTab, role, name) {
  if (activeTab === 'dashboard') {
    if (role === 'admin')  return <AdminHome />;
    if (role === 'tutor')  return <TutorHome name={name} />;
    return <ParentHome name={name} />;
  }
  const labels = {
    children:  'My Children',
    tutors:    'Find Tutors',
    bookings:  'Bookings',
    progress:  'Progress',
    messages:  'Messages',
    profile:   'My Profile',
    sessions:  'Sessions',
    wallet:    'Wallet',
    verify:    'Tutor Verification',
    reports:   'Reports',
  };
  return <ComingSoon screen={labels[activeTab] || activeTab} />;
}

// ── Main Export ──
export default function DashboardScreen() {
  const { profile, signOut, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'User';
  const role = profile?.role || 'parent';
  const tabs = NAV[role] || NAV.parent;

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>LB</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>LearnBridge</Text>
            <Text style={styles.headerRole}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>{profile?.full_name?.charAt(0) || 'U'}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Page Title ── */}
      <View style={styles.topbar}>
        <Text style={styles.topbarTitle}>
          {tabs.find(t => t.key === activeTab)?.label || 'Dashboard'}
        </Text>
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {renderScreen(activeTab, role, name)}
      </View>

      {/* ── Bottom Navigation ── */}
      <View style={styles.bottomNav}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.bottomTab}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.bottomIcon}>{tab.icon}</Text>
            <Text style={[styles.bottomLabel, activeTab === tab.key && styles.bottomLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex:1, backgroundColor:'#FAFAFA' },
  loadingContainer: { flex:1, justifyContent:'center', alignItems:'center' },

  // Header
  header:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, backgroundColor:DARK, paddingTop:50 },
  headerLeft:       { flexDirection:'row', alignItems:'center' },
  headerRight:      { flexDirection:'row', alignItems:'center', gap:10 },
  logoBox:          { width:36, height:36, borderRadius:10, backgroundColor:PRIMARY, alignItems:'center', justifyContent:'center', marginRight:10 },
  logoText:         { color:'#fff', fontWeight:'800', fontSize:14 },
  headerTitle:      { color:'#fff', fontWeight:'800', fontSize:15 },
  headerRole:       { color:'#6B7280', fontSize:11 },
  avatarSmall:      { width:32, height:32, borderRadius:16, backgroundColor:PRIMARY, alignItems:'center', justifyContent:'center' },
  avatarSmallText:  { color:'#fff', fontWeight:'800', fontSize:14 },
  signOutBtn:       { backgroundColor:'rgba(255,255,255,0.1)', paddingHorizontal:10, paddingVertical:5, borderRadius:8 },
  signOutText:      { color:'#9CA3AF', fontSize:12 },

  // Topbar
  topbar:           { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:BORDER },
  topbarTitle:      { fontSize:16, fontWeight:'700', color:DARK },

  // Content
  content:          { flex:1, padding:16 },

  // Cards
  welcome:          { fontSize:22, fontWeight:'800', color:DARK, marginBottom:4 },
  subtitle:         { fontSize:14, color:MUTED, marginBottom:20 },
  statsGrid:        { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:20 },
  statCard:         { width:'47%', backgroundColor:'#fff', borderRadius:12, padding:16, borderLeftWidth:4, borderWidth:1, borderColor:BORDER },
  statValue:        { fontSize:22, fontWeight:'800', color:DARK, marginBottom:4 },
  statLabel:        { fontSize:12, color:MUTED },
  card:             { backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:BORDER, marginBottom:16, overflow:'hidden' },
  cardTitle:        { fontSize:15, fontWeight:'700', color:DARK, padding:16, borderBottomWidth:1, borderBottomColor:BORDER },
  row:              { flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:BORDER, gap:12 },
  dateBox:          { width:44, height:44, borderRadius:10, backgroundColor:PRIMARY_LIGHT, alignItems:'center', justifyContent:'center' },
  dateText:         { fontSize:10, fontWeight:'700', color:PRIMARY },
  avatar:           { width:44, height:44, borderRadius:22, backgroundColor:PRIMARY, alignItems:'center', justifyContent:'center' },
  avatarText:       { color:'#fff', fontWeight:'800', fontSize:16 },
  rowInfo:          { flex:1 },
  rowTitle:         { fontSize:14, fontWeight:'600', color:DARK },
  rowSub:           { fontSize:12, color:MUTED, marginTop:2 },
  badge:            { paddingHorizontal:10, paddingVertical:4, borderRadius:8, backgroundColor:'#E1F5EE' },
  badgeText:        { fontSize:11, fontWeight:'600', color:TEAL },
  emptyText:        { padding:16, color:MUTED, fontSize:13, textAlign:'center' },

  // Coming Soon
  comingSoon:       { flex:1, justifyContent:'center', alignItems:'center', paddingTop:80 },
  comingSoonIcon:   { fontSize:48, marginBottom:16 },
  comingSoonTitle:  { fontSize:20, fontWeight:'800', color:DARK, marginBottom:8 },
  comingSoonText:   { fontSize:14, color:MUTED },

  // Bottom Nav
  bottomNav:        { flexDirection:'row', backgroundColor:DARK, paddingBottom:24, paddingTop:8, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  bottomTab:        { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:4, position:'relative' },
  bottomIcon:       { fontSize:18, marginBottom:3 },
  bottomLabel:      { fontSize:10, color:'#6B7280' },
  bottomLabelActive:{ color:'#fff', fontWeight:'600' },
  activeIndicator:  { position:'absolute', top:0, width:24, height:3, backgroundColor:PRIMARY, borderRadius:2 },
});
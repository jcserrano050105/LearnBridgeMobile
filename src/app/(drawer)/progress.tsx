import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY   = "#3D3BF3"; const PRIMARY_BG = "#EBEBFF";
const MUTED     = "#6B7280"; const DARK       = "#111827";
const BORDER    = "#E5E7EB"; const BG         = "#F5F7FB";
const GREEN     = "#10B981"; const ORANGE     = "#F59E0B";
const CORAL     = "#EF4444"; const PURPLE     = "#7C3AED";

const INDICATOR_CONFIG: Record<string,{label:string,color:string,bg:string,dot:string}> = {
  good:             {label:"Good",             color:"#16A34A",bg:"#D1FAE5",dot:"#16A34A"},
  improving:        {label:"Improving",        color:"#CA8A04",bg:"#FEF3C7",dot:"#CA8A04"},
  needs_improvement:{label:"Needs Improvement",color:"#DC2626",bg:"#FEE2E2",dot:"#DC2626"},
};

const fmtDate = (d:string) =>
  d ? new Date(d).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "—";

export default function ParentSessionsPage() {
  const { user } = useAuth() as any;

  const [bookings,  setBookings]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);
  const [selected,  setSelected]  = useState<string|null>(null);
  const [sessModal, setSessModal] = useState<any>(null); // tap session to see detail

  // ── Fetch bookings + sessions — same as ParentSessionsPage.jsx ──────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { data: bookingData, error: bErr } = await supabase
        .from("bookings")
        .select(`id,subject,status,created_at,
          tutor:tutor_id(id,full_name),
          student:student_id(id,name,grade_level)`)
        .eq("parent_id",user.id)
        .in("status",["confirmed","pending_parent_confirm","completed","pending"])
        .order("created_at",{ascending:false});
      if (bErr) throw bErr;

      const bIds=(bookingData||[]).map((b:any)=>b.id);
      let sessMap: Record<string,any[]> = {};

      if (bIds.length>0) {
        const { data: sessData } = await supabase
          .from("sessions")
          .select("id,booking_id,session_number,scheduled_date,status,topic_covered,performance_indicator,tutor_comments,created_at")
          .in("booking_id",bIds)
          .order("session_number",{ascending:true});
        (sessData||[]).forEach((s:any)=>{
          if (!sessMap[s.booking_id]) sessMap[s.booking_id]=[];
          sessMap[s.booking_id].push(s);
        });
      }

      const merged=(bookingData||[]).map((b:any)=>({
        ...b,
        sessions:(sessMap[b.id]||[]).sort((a:any,b:any)=>(a.session_number||0)-(b.session_number||0)),
      }));

      setBookings(merged);
      if (merged.length>0 && !selected) setSelected(merged[0].id);
    } catch(e:any){ setError(e.message); }
    finally { setLoading(false); }
  },[user]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  // Auto-refresh every 15 seconds — same as website
  useEffect(()=>{
    const interval = setInterval(fetchData,15000);
    return ()=>clearInterval(interval);
  },[fetchData]);

  const activeBooking = bookings.find(b=>b.id===selected);

  if (loading) return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Sessions"/>
      <View style={s.centered}><ActivityIndicator size="large" color={PRIMARY}/></View>
    </View>
  );

  if (error) return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Sessions"/>
      <View style={s.centered}>
        <Text style={{color:CORAL,marginBottom:12}}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={fetchData}><Text style={{color:"#fff",fontWeight:"700"}}>Retry</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Sessions"/>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Sessions</Text>
        <Text style={s.sub}>Track your child's progress across all 8 tutoring sessions.</Text>

        {bookings.length===0 ? (
          <View style={s.empty}>
            <Text style={s.eIcon}>📋</Text>
            <Text style={s.eTitle}>No sessions yet</Text>
            <Text style={s.eTxt}>Sessions will appear here once your tutor logs feedback.</Text>
          </View>
        ) : (
          <>
            {/* ── Booking selector (horizontal scroll) — same as web left panel ── */}
            <Text style={s.sectionLabel}>YOUR BOOKINGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}}>
              {bookings.map((b:any,i:number)=>{
                const isActive   = selected===b.id;
                const sessCount  = b.sessions.length;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[s.tab,isActive&&s.tabActive]}
                    onPress={()=>setSelected(b.id)}
                  >
                    {/* Avatar initial */}
                    <View style={[s.tabAvatar,{backgroundColor:isActive?PRIMARY:"#E5E7EB"}]}>
                      <Text style={[s.tabAvatarTxt,{color:isActive?"#fff":MUTED}]}>
                        {b.student?.name?.charAt(0)||"S"}
                      </Text>
                    </View>
                    <Text style={[s.tabName,isActive&&{color:PRIMARY}]}>{b.student?.name}</Text>
                    <Text style={[s.tabSub,isActive&&{color:PRIMARY}]}>{b.subject}</Text>
                    <Text style={[s.tabSub,isActive&&{color:PRIMARY}]}>{sessCount}/8 sessions</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Active booking detail ── */}
            {activeBooking&&(
              <View style={s.detailBox}>
                {/* Header */}
                <View style={s.detailHeader}>
                  <View style={{flex:1}}>
                    <Text style={s.detailTitle}>
                      {activeBooking.student?.name} · {activeBooking.subject}
                    </Text>
                    <Text style={s.detailMeta}>
                      Grade {activeBooking.student?.grade_level} · Tutor: {activeBooking.tutor?.full_name}
                    </Text>
                  </View>
                  <View style={{alignItems:"flex-end"}}>
                    <Text style={s.sessCount}>{activeBooking.sessions.length}/8</Text>
                    <Text style={{fontSize:10,color:MUTED}}>sessions done</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.barBg}>
                  <View style={[s.barFill,{width:`${(activeBooking.sessions.length/8)*100}%` as any}]}/>
                </View>
                <Text style={s.barLabel}>{8-activeBooking.sessions.length} sessions remaining</Text>

                {/* ── 8-session timeline — matches website timeline exactly ── */}
                <View style={{marginTop:16}}>
                  {[1,2,3,4,5,6,7,8].map(num=>{
                    const sess    = activeBooking.sessions.find((s:any)=>s.session_number===num);
                    const hasSess = !!sess;
                    const indCfg  = hasSess ? INDICATOR_CONFIG[sess.performance_indicator] : null;
                    const dotColor= hasSess ? (indCfg?.dot||"#16A34A") : BORDER;
                    const isLast  = num===8;

                    return (
                      <View key={num} style={{flexDirection:"row",gap:0}}>
                        {/* Timeline line */}
                        <View style={{alignItems:"center",width:44}}>
                          <TouchableOpacity
                            style={[s.timelineDot,{
                              backgroundColor:hasSess?dotColor+"20":"#F3F4F6",
                              borderColor:dotColor,
                            }]}
                            onPress={()=>hasSess&&setSessModal(sess)}
                            disabled={!hasSess}
                          >
                            {hasSess
                              ?<Ionicons name="checkmark" size={14} color={dotColor}/>
                              :<Text style={{fontSize:11,fontWeight:"800",color:MUTED}}>{num}</Text>
                            }
                          </TouchableOpacity>
                          {!isLast&&<View style={[s.timelineLine,{backgroundColor:hasSess?dotColor+"40":BORDER}]}/>}
                        </View>

                        {/* Session content */}
                        <View style={{flex:1,paddingBottom:isLast?0:12,paddingTop:4}}>
                          {hasSess ? (
                            <TouchableOpacity style={s.sessCard} onPress={()=>setSessModal(sess)}>
                              <View style={s.sessCardTop}>
                                <Text style={s.sessCardTitle}>Session {num}</Text>
                                {indCfg&&(
                                  <View style={[s.indBadge,{backgroundColor:indCfg.bg}]}>
                                    <Text style={[s.indBadgeTxt,{color:indCfg.color}]}>{indCfg.label}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={s.sessCardDate}>{fmtDate(sess.scheduled_date)}</Text>
                              {sess.topic_covered&&(
                                <Text style={s.sessCardTopic}>📝 {sess.topic_covered}</Text>
                              )}
                              {sess.tutor_comments&&(
                                <Text style={s.sessCardComment} numberOfLines={2}>💬 {sess.tutor_comments}</Text>
                              )}
                              <Text style={s.tapHint}>Tap to view details →</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={s.sessPending}>
                              <Text style={s.sessPendingTxt}>Session {num} — not yet completed</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Session detail modal ── */}
      <Modal visible={!!sessModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Session {sessModal?.session_number} Details</Text>
              <TouchableOpacity onPress={()=>setSessModal(null)}>
                <Ionicons name="close" size={22} color={MUTED}/>
              </TouchableOpacity>
            </View>
            {sessModal&&(()=>{
              const indCfg=INDICATOR_CONFIG[sessModal.performance_indicator];
              return (
                <>
                  <View style={s.detailRow}><Text style={s.detailKey}>Date</Text><Text style={s.detailVal}>{fmtDate(sessModal.scheduled_date)}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailKey}>Status</Text><Text style={s.detailVal}>{sessModal.status}</Text></View>
                  {sessModal.topic_covered&&<View style={s.detailRow}><Text style={s.detailKey}>Topic Covered</Text><Text style={s.detailVal}>{sessModal.topic_covered}</Text></View>}
                  {indCfg&&(
                    <View style={s.detailRow}>
                      <Text style={s.detailKey}>Performance</Text>
                      <View style={[s.indBadge,{backgroundColor:indCfg.bg}]}>
                        <Text style={[s.indBadgeTxt,{color:indCfg.color}]}>{indCfg.label}</Text>
                      </View>
                    </View>
                  )}
                  {sessModal.tutor_comments&&(
                    <View style={{marginTop:12,backgroundColor:"#F9FAFB",borderRadius:10,padding:14}}>
                      <Text style={{fontSize:11,color:MUTED,fontWeight:"700",marginBottom:6,letterSpacing:0.5}}>TUTOR'S COMMENTS</Text>
                      <Text style={{fontSize:13,color:DARK,lineHeight:20}}>{sessModal.tutor_comments}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[s.nextBtn,{marginTop:16}]} onPress={()=>setSessModal(null)}>
                    <Text style={s.nextBtnTxt}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  content:{padding:16,paddingBottom:40},
  centered:{flex:1,alignItems:"center",justifyContent:"center",padding:24},
  retryBtn:{backgroundColor:PRIMARY,paddingHorizontal:20,paddingVertical:10,borderRadius:8},
  heading:{fontSize:20,fontWeight:"800",color:DARK},
  sub:{fontSize:13,color:MUTED,marginTop:4,marginBottom:20},
  sectionLabel:{fontSize:11,color:MUTED,fontWeight:"700",letterSpacing:0.5,textTransform:"uppercase",marginBottom:10},
  empty:{alignItems:"center",marginTop:60},
  eIcon:{fontSize:48,marginBottom:12},
  eTitle:{fontSize:16,fontWeight:"700",color:DARK},
  eTxt:{fontSize:13,color:MUTED,textAlign:"center",marginTop:8,lineHeight:20},
  // Booking tabs
  tab:{backgroundColor:"#fff",borderRadius:12,borderWidth:1.5,borderColor:BORDER,padding:14,marginRight:10,minWidth:130,alignItems:"center"},
  tabActive:{borderColor:PRIMARY,backgroundColor:PRIMARY_BG},
  tabAvatar:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",marginBottom:8},
  tabAvatarTxt:{fontWeight:"800",fontSize:14},
  tabName:{fontSize:13,fontWeight:"700",color:DARK,textAlign:"center"},
  tabSub:{fontSize:11,color:MUTED,textAlign:"center",marginTop:2},
  // Detail box
  detailBox:{backgroundColor:"#fff",borderRadius:12,borderWidth:1,borderColor:BORDER,padding:16},
  detailHeader:{flexDirection:"row",alignItems:"flex-start",marginBottom:12},
  detailTitle:{fontSize:15,fontWeight:"700",color:DARK},
  detailMeta:{fontSize:12,color:MUTED,marginTop:3},
  sessCount:{fontSize:22,fontWeight:"800",color:PRIMARY},
  barBg:{height:8,backgroundColor:"#E5E7EB",borderRadius:4,overflow:"hidden",marginBottom:6},
  barFill:{height:8,borderRadius:4,backgroundColor:PRIMARY},
  barLabel:{fontSize:11,color:MUTED,marginBottom:4},
  // Timeline
  timelineDot:{width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",borderWidth:2},
  timelineLine:{width:2,flex:1,minHeight:12,marginVertical:2},
  // Session cards
  sessCard:{flex:1,backgroundColor:"#F9FAFB",borderRadius:10,borderWidth:1,borderColor:BORDER,padding:12,marginLeft:8,marginBottom:2},
  sessCardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  sessCardTitle:{fontSize:13,fontWeight:"700",color:DARK},
  sessCardDate:{fontSize:11,color:MUTED,marginBottom:4},
  sessCardTopic:{fontSize:12,color:DARK,marginTop:4},
  sessCardComment:{fontSize:11,color:MUTED,marginTop:4,fontStyle:"italic"},
  tapHint:{fontSize:10,color:PRIMARY,marginTop:6,fontWeight:"600"},
  sessPending:{flex:1,paddingVertical:10,paddingHorizontal:12,marginLeft:8,marginBottom:2},
  sessPendingTxt:{fontSize:12,color:MUTED,fontStyle:"italic"},
  indBadge:{borderRadius:6,paddingHorizontal:8,paddingVertical:3},
  indBadgeTxt:{fontSize:10,fontWeight:"700"},
  // Modal
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  modalBox:{backgroundColor:"#fff",borderTopLeftRadius:20,borderTopRightRadius:20,padding:24,maxHeight:"85%"},
  modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  modalTitle:{fontSize:17,fontWeight:"800",color:DARK},
  detailRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER},
  detailKey:{fontSize:12,color:MUTED,fontWeight:"600"},
  detailVal:{fontSize:13,fontWeight:"700",color:DARK,textAlign:"right"},
  nextBtn:{paddingVertical:14,borderRadius:10,backgroundColor:PRIMARY,alignItems:"center"},
  nextBtnTxt:{fontSize:14,color:"#fff",fontWeight:"700"},
});
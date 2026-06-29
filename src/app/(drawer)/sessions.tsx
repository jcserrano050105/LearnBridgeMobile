import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY="#3D3BF3",PRIMARY_BG="#EBEBFF",MUTED="#6B7280",DARK="#111827";
const BORDER="#E5E7EB",BG="#F5F7FB",GREEN="#10B981",ORANGE="#F59E0B",CORAL="#EF4444";

const PERF:Record<string,{label:string,color:string,bg:string}>={
  good:             {label:"Good",             color:GREEN,  bg:"#D1FAE5"},
  improving:        {label:"Improving",        color:ORANGE, bg:"#FEF3C7"},
  needs_improvement:{label:"Needs Improvement",color:CORAL,  bg:"#FEE2E2"},
};

const STATUS_COLOR:Record<string,string>={
  scheduled:PRIMARY, completed:GREEN,
  pending_parent_confirm:"#7C3AED", pending_tutor_complete:ORANGE,
};

const fmtDate=(d:string)=>new Date(d).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});

export default function ParentSessionsPage() {
  const { user } = useAuth() as any;
  const [bookings,  setBookings]  = useState<any[]>([]);
  const [selected,  setSelected]  = useState<string|null>(null);
  const [loading,   setLoading]   = useState(true);
  const [feedback,  setFeedback]  = useState<any>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: bks } = await supabase
      .from("bookings")
      .select(`id,subject,status,
        tutor:tutor_id(id,full_name),
        student:student_id(name,grade_level)`)
      .eq("parent_id",user.id)
      .in("status",["confirmed","pending_parent_confirm","completed","pending"])
      .order("created_at",{ascending:false});

    const bIds=(bks||[]).map((b:any)=>b.id);
    let sessMap:Record<string,any[]>={};

    if (bIds.length>0) {
      const { data: sess } = await supabase
        .from("sessions")
        .select("id,booking_id,session_number,scheduled_date,status,topic_covered,performance_indicator,tutor_comments")
        .in("booking_id",bIds)
        .order("session_number",{ascending:true});
      (sess||[]).forEach((s:any)=>{
        if (!sessMap[s.booking_id]) sessMap[s.booking_id]=[];
        sessMap[s.booking_id].push(s);
      });
    }

    const merged=(bks||[]).map((b:any)=>({...b,sessions:sessMap[b.id]||[]}));
    setBookings(merged);
    if (merged.length>0 && !selected) setSelected(merged[0].id);
    setLoading(false);
  },[user]);

  useEffect(()=>{ load(); },[load]);

  const activeBooking = bookings.find(b=>b.id===selected);

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Sessions" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Sessions</Text>
        <Text style={s.sub}>Track your child's progress across all 8 tutoring sessions.</Text>

        {loading ? <ActivityIndicator color={PRIMARY} style={{marginTop:40}}/> :
          bookings.length===0 ? (
            <View style={s.empty}><Text style={s.eIcon}>📋</Text>
              <Text style={s.eTitle}>No sessions yet</Text>
              <Text style={s.eTxt}>Sessions will appear here once your tutor logs feedback.</Text>
            </View>
          ) : (
            <>
              {/* Booking selector tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
                {bookings.map((b,i)=>(
                  <TouchableOpacity key={b.id} style={[s.tab,selected===b.id&&s.tabActive]} onPress={()=>setSelected(b.id)}>
                    <Text style={[s.tabTxt,selected===b.id&&s.tabTxtActive]}>{b.student?.name}</Text>
                    <Text style={[s.tabSub,selected===b.id&&{color:PRIMARY}]}>{b.subject}</Text>
                    <Text style={[s.tabSub,selected===b.id&&{color:PRIMARY}]}>{b.sessions.length}/8 sessions</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Active booking sessions */}
              {activeBooking&&(
                <View>
                  <View style={s.bookingHeader}>
                    <View>
                      <Text style={s.bookingTitle}>{activeBooking.student?.name} · {activeBooking.subject}</Text>
                      <Text style={s.bookingMeta}>Tutor: {activeBooking.tutor?.full_name}</Text>
                    </View>
                    {/* Progress bar */}
                    <View style={{alignItems:"flex-end"}}>
                      <Text style={s.sessionCount}>{activeBooking.sessions.length}/8</Text>
                      <Text style={{fontSize:10,color:MUTED}}>sessions</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={s.barBg}>
                    <View style={[s.barFill,{width:`${(activeBooking.sessions.length/8)*100}%` as any}]}/>
                  </View>

                  {/* Session cards */}
                  {activeBooking.sessions.length===0 ? (
                    <View style={s.empty}><Text style={s.eIcon}>📅</Text>
                      <Text style={s.eTitle}>No sessions logged yet</Text>
                      <Text style={s.eTxt}>Sessions will appear once your tutor marks them complete.</Text>
                    </View>
                  ) : activeBooking.sessions.map((sess:any)=>{
                    const perf=PERF[sess.performance_indicator];
                    const sColor=STATUS_COLOR[sess.status]||MUTED;
                    return (
                      <TouchableOpacity key={sess.id} style={s.sessCard} onPress={()=>setFeedback(sess)}>
                        <View style={s.sessTop}>
                          <View style={[s.sessNum,{backgroundColor:sColor+"20"}]}>
                            <Text style={[s.sessNumTxt,{color:sColor}]}>{sess.session_number}</Text>
                          </View>
                          <View style={{flex:1}}>
                            <Text style={s.sessDate}>{sess.scheduled_date?fmtDate(sess.scheduled_date):"TBD"}</Text>
                            {sess.topic_covered&&<Text style={s.sessTopic}>📝 {sess.topic_covered}</Text>}
                          </View>
                          {perf&&<View style={[s.badge,{backgroundColor:perf.bg}]}><Text style={[s.badgeTxt,{color:perf.color}]}>{perf.label}</Text></View>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
      </ScrollView>

      {/* Feedback Detail Modal */}
      <Modal visible={!!feedback} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Session {feedback?.session_number} Details</Text>
              <TouchableOpacity onPress={()=>setFeedback(null)}><Ionicons name="close" size={22} color={MUTED}/></TouchableOpacity>
            </View>
            {feedback&&(
              <>
                <View style={s.detailRow}><Text style={s.detailKey}>Date</Text><Text style={s.detailVal}>{feedback.scheduled_date?fmtDate(feedback.scheduled_date):"TBD"}</Text></View>
                <View style={s.detailRow}><Text style={s.detailKey}>Status</Text><Text style={s.detailVal}>{feedback.status}</Text></View>
                {feedback.topic_covered&&<View style={s.detailRow}><Text style={s.detailKey}>Topic</Text><Text style={s.detailVal}>{feedback.topic_covered}</Text></View>}
                {feedback.performance_indicator&&<View style={s.detailRow}><Text style={s.detailKey}>Performance</Text><Text style={[s.detailVal,{color:PERF[feedback.performance_indicator]?.color}]}>{PERF[feedback.performance_indicator]?.label}</Text></View>}
                {feedback.tutor_comments&&(
                  <View style={{marginTop:12,backgroundColor:"#F9FAFB",borderRadius:10,padding:14}}>
                    <Text style={{fontSize:11,color:MUTED,fontWeight:"700",marginBottom:6}}>TUTOR'S COMMENTS</Text>
                    <Text style={{fontSize:13,color:DARK,lineHeight:20}}>{feedback.tutor_comments}</Text>
                  </View>
                )}
                <TouchableOpacity style={[s.nextBtn,{marginTop:16}]} onPress={()=>setFeedback(null)}>
                  <Text style={s.nextBtnTxt}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:BG}, content:{padding:16,paddingBottom:40},
  heading:{fontSize:20,fontWeight:"800",color:DARK}, sub:{fontSize:13,color:MUTED,marginTop:4,marginBottom:16},
  empty:{alignItems:"center",marginTop:40}, eIcon:{fontSize:48,marginBottom:12},
  eTitle:{fontSize:16,fontWeight:"700",color:DARK}, eTxt:{fontSize:13,color:MUTED,textAlign:"center",marginTop:8},
  tab:{backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:BORDER,padding:12,marginRight:10,minWidth:120},
  tabActive:{borderColor:PRIMARY,backgroundColor:PRIMARY_BG},
  tabTxt:{fontSize:13,fontWeight:"700",color:DARK}, tabTxtActive:{color:PRIMARY},
  tabSub:{fontSize:11,color:MUTED,marginTop:2},
  bookingHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  bookingTitle:{fontSize:15,fontWeight:"700",color:DARK}, bookingMeta:{fontSize:12,color:MUTED,marginTop:3},
  sessionCount:{fontSize:20,fontWeight:"800",color:PRIMARY},
  barBg:{height:8,backgroundColor:"#E5E7EB",borderRadius:4,overflow:"hidden",marginBottom:16},
  barFill:{height:8,borderRadius:4,backgroundColor:PRIMARY},
  sessCard:{backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:BORDER,padding:14,marginBottom:10},
  sessTop:{flexDirection:"row",alignItems:"center",gap:12},
  sessNum:{width:32,height:32,borderRadius:16,alignItems:"center",justifyContent:"center"},
  sessNumTxt:{fontSize:14,fontWeight:"800"},
  sessDate:{fontSize:13,fontWeight:"600",color:DARK}, sessTopic:{fontSize:11,color:MUTED,marginTop:3},
  badge:{borderRadius:6,paddingHorizontal:8,paddingVertical:4},
  badgeTxt:{fontSize:10,fontWeight:"700"},
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  modalBox:{backgroundColor:"#fff",borderTopLeftRadius:20,borderTopRightRadius:20,padding:24,maxHeight:"85%"},
  modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  modalTitle:{fontSize:17,fontWeight:"800",color:DARK},
  detailRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER},
  detailKey:{fontSize:12,color:MUTED,fontWeight:"600"},
  detailVal:{fontSize:13,fontWeight:"700",color:DARK,textAlign:"right"},
  nextBtn:{paddingVertical:14,borderRadius:10,backgroundColor:PRIMARY,alignItems:"center"},
  nextBtnTxt:{fontSize:14,color:"#fff",fontWeight:"700"},
});


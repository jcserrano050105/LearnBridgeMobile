import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY="#3D3BF3",PRIMARY_BG="#EBEBFF",MUTED="#6B7280",DARK="#111827";
const BORDER="#E5E7EB",BG="#F5F7FB",GREEN="#10B981",ORANGE="#F59E0B",CORAL="#EF4444";

export default function MessagesPage() {
  const { user } = useAuth() as any;

  const [threads,      setThreads]      = useState<any[]>([]);
  const [messages,     setMessages]     = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null); // tutor or admin profile
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [inquiryMap,   setInquiryMap]   = useState<Record<string,any>>({});
  const [students,     setStudents]     = useState<any[]>([]);
  const [bookModal,    setBookModal]    = useState(false);
  const [bookForm,     setBookForm]     = useState({student_id:"",subject:"",session_mode:"face-to-face",payment_method:"cash"});
  const [booking,      setBooking]      = useState(false);

  const pollRef   = useRef<any>(null);
  const flatRef   = useRef<FlatList>(null);

  // ── Load admin profile ──
  const loadAdmin = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id,full_name,role").eq("role","admin").limit(1).single();
    if (data) setAdminProfile(data);
  },[]);

  // ── Load threads ──
  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select(`sender_id,receiver_id,
        sender:sender_id(id,full_name,role),
        receiver:receiver_id(id,full_name,role)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at",{ascending:false});
    const seen=new Set<string>(); const users:any[]=[];
    (data||[]).forEach((m:any)=>{
      const other=m.sender_id===user.id?m.receiver:m.sender;
      if (other&&!seen.has(other.id)&&other.id!==user.id){ seen.add(other.id); users.push(other); }
    });
    setThreads(users); setLoading(false);
  },[user]);

  // ── Load messages for active thread ──
  const loadMessages = useCallback(async (otherId:string, initial=false) => {
    if (!user||!otherId) return;
    if (initial) setMsgLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("id,content,created_at,sender_id,sender:sender_id(id,full_name,role)")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order("created_at",{ascending:true});
    setMessages(data||[]);
    if (initial) setMsgLoading(false);
    setTimeout(()=>flatRef.current?.scrollToEnd({animated:false}),100);
  },[user]);

  // ── Load inquiries ──
  const loadInquiries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("inquiries")
      .select("id,tutor_id,status,tutor:tutor_id(id,full_name,approved_rate,rate_per_session)")
      .eq("parent_id",user.id).in("status",["open","booked"]);
    const map:Record<string,any>={};
    (data||[]).forEach((i:any)=>{ map[i.tutor_id]=i; });
    setInquiryMap(map);
  },[user]);

  // ── Load students ──
  const loadStudents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("id,name,grade_level").eq("parent_id",user.id);
    setStudents(data||[]);
  },[user]);

  useEffect(()=>{
    loadAdmin(); loadThreads(); loadInquiries(); loadStudents();
  },[loadAdmin,loadThreads,loadInquiries,loadStudents]);

  // ── Select thread ──
  const selectThread = (person:any) => {
    setActiveThread(person);
    loadMessages(person.id,true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current=setInterval(()=>loadMessages(person.id),5000);
  };

  useEffect(()=>()=>{ if (pollRef.current) clearInterval(pollRef.current); },[]);

  // ── Auto-select admin on first load ──
  useEffect(()=>{
    if (adminProfile&&!activeThread) selectThread(adminProfile);
  },[adminProfile]);

  // ── Send message ──
  const handleSend = async () => {
    if (!text.trim()||!activeThread) return;
    setSending(true);
    try {
      await supabase.from("direct_messages").insert({
        sender_id:user.id, receiver_id:activeThread.id, content:text.trim(),
      });
      setText("");
      await loadMessages(activeThread.id);
      await loadThreads();
    } catch(e:any){ Alert.alert("Error",e.message); }
    finally { setSending(false); }
  };

  // ── Book Now ──
  const handleBook = async () => {
    if (!bookForm.student_id) { Alert.alert("Required","Please select a child."); return; }
    if (!bookForm.subject)    { Alert.alert("Required","Please select a subject."); return; }
    setBooking(true);
    try {
      const inq   = inquiryMap[activeThread?.id];
      const tutor = inq?.tutor;
      const rate  = tutor?.approved_rate||tutor?.rate_per_session||0;
      const total = rate*8;
      const comm  = total*0.10;

      const { error } = await supabase.from("bookings").insert({
        parent_id:user.id, tutor_id:activeThread?.id,
        student_id:bookForm.student_id, subject:bookForm.subject,
        session_mode:bookForm.session_mode, payment_method:bookForm.payment_method,
        total_amount:total, commission_amount:comm, status:"pending",
      });
      if (error) throw error;

      // Update inquiry to booked
      if (inq?.id) {
        await supabase.from("inquiries").update({status:"booked",student_id:bookForm.student_id}).eq("id",inq.id);
      }

      // Auto send message
      await supabase.from("direct_messages").insert({
        sender_id:user.id, receiver_id:activeThread?.id,
        content:`I've submitted a booking request for ${bookForm.subject==="both"?"English & Mathematics":bookForm.subject}! Please confirm the schedule. Looking forward to working with you! 📚`,
      });

      setBookModal(false);
      setBookForm({student_id:"",subject:"",session_mode:"face-to-face",payment_method:"cash"});
      await loadMessages(activeThread.id);
      await loadInquiries();
      Alert.alert("Booking Submitted!","The tutor will confirm shortly.");
    } catch(e:any){ Alert.alert("Error",e.message); }
    finally { setBooking(false); }
  };

  const isInquiryThread = activeThread&&activeThread.id!==adminProfile?.id;
  const inquiry         = activeThread?inquiryMap[activeThread.id]:null;
  const isBooked        = inquiry?.status==="booked";

  const fmtTime=(ts:string)=>new Date(ts).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit",hour12:true});

  if (loading) return <View style={s.container}><Header title="LearnBridge" subtitle="Messages"/><View style={s.centered}><ActivityIndicator size="large" color={PRIMARY}/></View></View>;

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Messages" />
      <View style={s.body}>

        {/* ── Thread list (left panel) ── */}
        <View style={s.threadPanel}>
          {/* Admin thread */}
          {adminProfile&&(
            <TouchableOpacity style={[s.thread,activeThread?.id===adminProfile.id&&s.threadActive]} onPress={()=>selectThread(adminProfile)}>
              <View style={s.threadAvatar}><Text style={s.threadAvatarTxt}>A</Text></View>
              <View style={{flex:1}}>
                <Text style={[s.threadName,activeThread?.id===adminProfile.id&&{color:PRIMARY}]}>Admin</Text>
                <Text style={s.threadSub}>LearnBridge support</Text>
              </View>
            </TouchableOpacity>
          )}
          {/* Tutor threads */}
          {threads.filter(t=>t.role!=="admin").map(t=>(
            <TouchableOpacity key={t.id} style={[s.thread,activeThread?.id===t.id&&s.threadActive]} onPress={()=>selectThread(t)}>
              <View style={[s.threadAvatar,{backgroundColor:"#F59E0B"}]}><Text style={s.threadAvatarTxt}>{t.full_name?.charAt(0)||"T"}</Text></View>
              <View style={{flex:1}}>
                <Text style={[s.threadName,activeThread?.id===t.id&&{color:PRIMARY}]}>{t.full_name}</Text>
                <Text style={s.threadSub}>{inquiryMap[t.id]?.status==="booked"?"Booked":"Inquiry"}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {threads.filter(t=>t.role!=="admin").length===0&&(
            <View style={s.noThreads}><Text style={s.noThreadsTxt}>No tutor chats yet.{"\n"}Find a tutor to start.</Text></View>
          )}
        </View>

        {/* ── Chat panel (right) ── */}
        <View style={s.chatPanel}>
          {!activeThread ? (
            <View style={s.centered}><Text style={{color:MUTED}}>Select a conversation</Text></View>
          ) : (
            <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={90}>
              {/* Chat header */}
              <View style={s.chatHeader}>
                <Text style={s.chatName}>{activeThread.full_name||"Admin"}</Text>
                {isInquiryThread&&!isBooked&&inquiry&&(
                  <TouchableOpacity style={s.bookNowBtn} onPress={()=>setBookModal(true)}>
                    <Text style={s.bookNowTxt}>Book Now</Text>
                  </TouchableOpacity>
                )}
                {isBooked&&<View style={s.bookedBadge}><Text style={s.bookedTxt}>✓ Booked</Text></View>}
              </View>

              {/* Messages */}
              {msgLoading ? <ActivityIndicator color={PRIMARY} style={{marginTop:20}}/> : (
                <FlatList
                  ref={flatRef}
                  data={messages}
                  keyExtractor={i=>i.id}
                  contentContainerStyle={{padding:12,paddingBottom:4}}
                  renderItem={({item})=>{
                    const mine=item.sender_id===user.id;
                    return (
                      <View style={[s.bubble,mine?s.bubbleMine:s.bubbleOther]}>
                        <Text style={[s.bubbleTxt,mine?s.bubbleTxtMine:s.bubbleTxtOther]}>{item.content}</Text>
                        <Text style={s.bubbleTime}>{fmtTime(item.created_at)}</Text>
                      </View>
                    );
                  }}
                  onContentSizeChange={()=>flatRef.current?.scrollToEnd({animated:false})}
                />
              )}

              {/* Input */}
              <View style={s.inputRow}>
                <TextInput style={s.input} placeholder="Type a message..." placeholderTextColor={MUTED} value={text} onChangeText={setText} multiline/>
                <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={!text.trim()||sending}>
                  {sending?<ActivityIndicator size="small" color="#fff"/>:<Ionicons name="send" size={18} color="#fff"/>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>

      {/* Book Now Modal */}
      <Modal visible={bookModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Book {activeThread?.full_name}</Text>
              <TouchableOpacity onPress={()=>setBookModal(false)}><Ionicons name="close" size={22} color={MUTED}/></TouchableOpacity>
            </View>
            <View style={s.infoBanner}>
              <Text style={s.infoBannerTxt}>This sends a booking request to the tutor. They will confirm the details with you.</Text>
            </View>

            {/* Subject */}
            <Text style={s.label}>Subject *</Text>
            <View style={s.subjGrid}>
              {[{v:"english",l:"📖 English"},{v:"mathematics",l:"🔢 Mathematics"},{v:"both",l:"📚 Both"}].map(opt=>(
                <TouchableOpacity key={opt.v} style={[s.subjBtn,bookForm.subject===opt.v&&s.subjBtnActive]} onPress={()=>setBookForm(f=>({...f,subject:opt.v}))}>
                  <Text style={[s.subjBtnTxt,bookForm.subject===opt.v&&s.subjBtnTxtActive]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Child */}
            <Text style={s.label}>Which child? *</Text>
            {students.map(st=>(
              <TouchableOpacity key={st.id} style={[s.childBtn,bookForm.student_id===st.id&&s.childBtnActive]} onPress={()=>setBookForm(f=>({...f,student_id:st.id}))}>
                <Text style={[s.childBtnTxt,bookForm.student_id===st.id&&{color:PRIMARY}]}>{st.name} (Grade {st.grade_level})</Text>
              </TouchableOpacity>
            ))}

            {/* Session mode */}
            <Text style={s.label}>Session Mode</Text>
            <View style={s.subjGrid}>
              {[{v:"face-to-face",l:"Face-to-Face"},{v:"online",l:"Online"}].map(opt=>(
                <TouchableOpacity key={opt.v} style={[s.subjBtn,bookForm.session_mode===opt.v&&s.subjBtnActive]} onPress={()=>setBookForm(f=>({...f,session_mode:opt.v}))}>
                  <Text style={[s.subjBtnTxt,bookForm.session_mode===opt.v&&s.subjBtnTxtActive]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Payment */}
            <Text style={s.label}>Payment Method</Text>
            <View style={s.subjGrid}>
              {[{v:"cash",l:"Cash"},{v:"gcash",l:"GCash"},{v:"bank_transfer",l:"Bank Transfer"}].map(opt=>(
                <TouchableOpacity key={opt.v} style={[s.subjBtn,bookForm.payment_method===opt.v&&s.subjBtnActive]} onPress={()=>setBookForm(f=>({...f,payment_method:opt.v}))}>
                  <Text style={[s.subjBtnTxt,bookForm.payment_method===opt.v&&s.subjBtnTxtActive]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.ghostBtn} onPress={()=>setBookModal(false)}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.nextBtn,{flex:2}]} onPress={handleBook} disabled={booking||!bookForm.student_id||!bookForm.subject}>
                {booking?<ActivityIndicator color="#fff" size="small"/>:<Text style={s.nextBtnTxt}>✓ Confirm Booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  body:{flex:1,flexDirection:"row"},
  centered:{flex:1,alignItems:"center",justifyContent:"center"},
  // Thread panel
  threadPanel:{width:110,backgroundColor:"#fff",borderRightWidth:1,borderRightColor:BORDER},
  thread:{padding:10,borderBottomWidth:1,borderBottomColor:BORDER,alignItems:"center"},
  threadActive:{backgroundColor:PRIMARY_BG},
  threadAvatar:{width:36,height:36,borderRadius:18,backgroundColor:PRIMARY,alignItems:"center",justifyContent:"center",marginBottom:6},
  threadAvatarTxt:{color:"#fff",fontWeight:"800",fontSize:14},
  threadName:{fontSize:11,fontWeight:"700",color:DARK,textAlign:"center"},
  threadSub:{fontSize:10,color:MUTED,textAlign:"center",marginTop:2},
  noThreads:{padding:12,alignItems:"center"},
  noThreadsTxt:{fontSize:11,color:MUTED,textAlign:"center",lineHeight:16},
  // Chat panel
  chatPanel:{flex:1,backgroundColor:BG},
  chatHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:12,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:BORDER},
  chatName:{fontSize:14,fontWeight:"700",color:DARK,flex:1},
  bookNowBtn:{backgroundColor:PRIMARY,borderRadius:8,paddingHorizontal:12,paddingVertical:6},
  bookNowTxt:{color:"#fff",fontSize:12,fontWeight:"700"},
  bookedBadge:{backgroundColor:"#D1FAE5",borderRadius:8,paddingHorizontal:10,paddingVertical:6},
  bookedTxt:{color:GREEN,fontSize:12,fontWeight:"700"},
  // Bubbles
  bubble:{maxWidth:"75%",marginBottom:8,padding:10,borderRadius:12},
  bubbleMine:{backgroundColor:PRIMARY,alignSelf:"flex-end",borderBottomRightRadius:2},
  bubbleOther:{backgroundColor:"#fff",alignSelf:"flex-start",borderWidth:1,borderColor:BORDER,borderBottomLeftRadius:2},
  bubbleTxt:{fontSize:13,lineHeight:18},
  bubbleTxtMine:{color:"#fff"}, bubbleTxtOther:{color:DARK},
  bubbleTime:{fontSize:10,marginTop:4,opacity:0.7},
  // Input
  inputRow:{flexDirection:"row",alignItems:"flex-end",padding:10,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:BORDER,gap:8},
  input:{flex:1,borderWidth:1,borderColor:BORDER,borderRadius:20,paddingHorizontal:14,paddingVertical:8,fontSize:13,color:DARK,maxHeight:80,backgroundColor:"#FAFAFA"},
  sendBtn:{width:40,height:40,borderRadius:20,backgroundColor:PRIMARY,alignItems:"center",justifyContent:"center"},
  // Modal
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  modalBox:{backgroundColor:"#fff",borderTopLeftRadius:20,borderTopRightRadius:20,padding:24,maxHeight:"90%"},
  modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  modalTitle:{fontSize:17,fontWeight:"800",color:DARK},
  infoBanner:{backgroundColor:"#EFF6FF",borderRadius:10,padding:12,marginBottom:12},
  infoBannerTxt:{fontSize:13,color:"#1D4ED8"},
  label:{fontSize:13,fontWeight:"600",color:DARK,marginTop:12,marginBottom:8},
  subjGrid:{flexDirection:"row",flexWrap:"wrap",gap:8},
  subjBtn:{paddingHorizontal:14,paddingVertical:8,borderRadius:8,borderWidth:1,borderColor:BORDER,backgroundColor:"#FAFAFA"},
  subjBtnActive:{borderColor:PRIMARY,backgroundColor:PRIMARY_BG},
  subjBtnTxt:{fontSize:13,color:MUTED,fontWeight:"600"},
  subjBtnTxtActive:{color:PRIMARY},
  childBtn:{paddingVertical:12,paddingHorizontal:14,borderRadius:8,borderWidth:1,borderColor:BORDER,backgroundColor:"#FAFAFA",marginBottom:6},
  childBtnActive:{borderColor:PRIMARY,backgroundColor:PRIMARY_BG},
  childBtnTxt:{fontSize:13,color:MUTED,fontWeight:"600"},
  modalFooter:{flexDirection:"row",gap:10,marginTop:16},
  ghostBtn:{flex:1,paddingVertical:14,borderRadius:10,borderWidth:1,borderColor:BORDER,alignItems:"center"},
  ghostTxt:{fontSize:14,color:MUTED,fontWeight:"600"},
  nextBtn:{flex:1,paddingVertical:14,borderRadius:10,backgroundColor:PRIMARY,alignItems:"center"},
  nextBtnTxt:{fontSize:14,color:"#fff",fontWeight:"700"},
});
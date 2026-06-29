import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TextInput, TouchableOpacity, Modal, Alert, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY="#3D3BF3",PRIMARY_BG="#EBEBFF",TEAL="#0D9488",TEAL_BG="#CCFBF1";
const MUTED="#6B7280",DARK="#111827",BORDER="#E5E7EB",BG="#F5F7FB";
const GREEN="#10B981",GREEN_BG="#D1FAE5",ORANGE="#F59E0B",ORANGE_BG="#FEF3C7";

export default function FindTutorsPage() {
  const { user } = useAuth() as any;
  const router   = useRouter();

  const [tutors,    setTutors]    = useState<any[]>([]);
  const [filtered,  setFiltered]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [inquiring, setInquiring] = useState<string|null>(null);
  const [inquiries, setInquiries] = useState<Record<string,any>>({});

  // Profile modal
  const [profileModal, setProfileModal] = useState<any>(null);

  // ── Load tutors ──
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tutors")
        .select(`id,specialization,years_experience,approved_rate,rate_per_session,
          certification_scores,status,average_rating,total_ratings,
          profile:id(full_name,email,location,bio,gender)`)
        .eq("status","approved")
        .order("created_at",{ascending:false});
      setTutors(data||[]); setFiltered(data||[]); setLoading(false);
    })();
  }, []);

  // ── Load existing inquiries ──
  const loadInquiries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("inquiries")
      .select("id,tutor_id,status")
      .eq("parent_id",user.id)
      .in("status",["open","booked"]);
    const map: Record<string,any> = {};
    (data||[]).forEach((i:any) => { map[i.tutor_id] = i; });
    setInquiries(map);
  },[user]);

  useEffect(() => { loadInquiries(); },[loadInquiries]);

  // ── Search filter ──
  useEffect(() => {
    if (!search) { setFiltered(tutors); return; }
    const q = search.toLowerCase();
    setFiltered(tutors.filter((t:any) =>
      t.profile?.full_name?.toLowerCase().includes(q) ||
      (t.specialization||[]).some((s:string)=>s.toLowerCase().includes(q))
    ));
  },[search,tutors]);

  // ── Inquire / open chat ──
  const handleInquire = async (tutor: any) => {
    if (!user) return;
    setInquiring(tutor.id);
    try {
      const existing = inquiries[tutor.id];
      if (!existing) {
        // Create inquiry
        const { data: inq, error } = await supabase
          .from("inquiries")
          .insert({ parent_id: user.id, tutor_id: tutor.id, status: "open", subject: "" })
          .select().single();
        if (error) throw error;
        // Send opening message
        await supabase.from("direct_messages").insert({
          sender_id:   user.id,
          receiver_id: tutor.id,
          content:     `Hello! I'm interested in tutoring services. I'd like to learn more about your approach and availability.`,
        });
        await loadInquiries();
      }
      // Navigate to messages
      router.push("/(drawer)/messages" as any);
    } catch (e:any) {
      Alert.alert("Error", e.message);
    } finally {
      setInquiring(null);
    }
  };

  const hasInquiry    = (id:string) => !!inquiries[id];
  const isBooked      = (id:string) => inquiries[id]?.status === "booked";
  const certScores    = (t:any) => Object.entries(t.certification_scores||{});
  const totalPrice    = (t:any) => ((t.approved_rate||t.rate_per_session||0)*8).toLocaleString();

  return (
    <View style={s.container}>
      <Header title="LearnBridge" subtitle="Find Tutors" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Find Tutors</Text>
        <Text style={s.sub}>Browse verified and certified tutors for your child.</Text>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={MUTED}/>
          <TextInput style={s.searchInput} placeholder="Search name or subject..." placeholderTextColor={MUTED} value={search} onChangeText={setSearch}/>
        </View>

        {loading ? <ActivityIndicator color={PRIMARY} style={{marginTop:40}}/> :
          filtered.length===0 ? (
            <View style={s.empty}><Text style={s.eIcon}>🔍</Text>
              <Text style={s.eTitle}>No tutors found</Text>
              <Text style={s.eTxt}>Try a different keyword.</Text>
            </View>
          ) : filtered.map((t:any) => {
            const rate       = t.approved_rate||t.rate_per_session||0;
            const ongoing    = hasInquiry(t.id);
            const booked     = isBooked(t.id);
            const isInquiring= inquiring === t.id;

            return (
              <View key={t.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{t.profile?.full_name?.charAt(0)||"T"}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={s.name}>{t.profile?.full_name||"Tutor"}</Text>
                    <Text style={s.meta}>{t.years_experience||0} yrs experience</Text>
                    {t.profile?.location&&<Text style={s.meta}>📍 {t.profile.location}</Text>}
                  </View>
                  <View style={s.verBadge}><Ionicons name="checkmark-circle" size={14} color={GREEN}/><Text style={s.verTxt}>Verified</Text></View>
                </View>

                {/* Rating */}
                {t.average_rating>0&&(
                  <View style={s.ratingRow}>
                    <Text style={s.starTxt}>{"★".repeat(Math.round(t.average_rating))}</Text>
                    <Text style={s.ratingTxt}>{Number(t.average_rating).toFixed(1)} ({t.total_ratings} ratings)</Text>
                  </View>
                )}

                {/* Subjects / specialization */}
                {t.specialization?.length>0&&(
                  <View style={s.tagsRow}>
                    {(t.specialization||[]).map((sub:string)=>(
                      <View key={sub} style={s.tag}><Text style={s.tagTxt}>{sub}</Text></View>
                    ))}
                  </View>
                )}

                {/* Cert scores */}
                {certScores(t).length>0&&(
                  <View style={s.certRow}>
                    {certScores(t).map(([topic,score]:any)=>(
                      <View key={topic} style={[s.certBadge,{backgroundColor:Number(score)>=80?GREEN_BG:ORANGE_BG}]}>
                        <Text style={[s.certTxt,{color:Number(score)>=80?GREEN:ORANGE}]}>
                          {topic.replace(/_/g," ")}: {score}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Price + button */}
                <View style={s.bottomRow}>
                  <View>
                    <Text style={s.price}>₱{totalPrice(t)}</Text>
                    <Text style={s.priceLabel}>for 8 sessions · ₱{rate.toLocaleString()}/session</Text>
                  </View>
                  <View style={{gap:6}}>
                    <TouchableOpacity style={s.profileBtn} onPress={()=>setProfileModal(t)}>
                      <Text style={s.profileBtnTxt}>View Profile</Text>
                    </TouchableOpacity>
                    {booked ? (
                      <View style={s.bookedBtn}><Text style={s.bookedTxt}>✓ Booked</Text></View>
                    ) : ongoing ? (
                      <TouchableOpacity style={s.ongoingBtn} onPress={()=>router.push("/(drawer)/messages" as any)}>
                        <Ionicons name="chatbubble-outline" size={13} color={ORANGE}/>
                        <Text style={s.ongoingTxt}>On-going</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={s.inquireBtn} onPress={()=>handleInquire(t)} disabled={isInquiring}>
                        {isInquiring ? <ActivityIndicator size="small" color="#fff"/> : <>
                          <Ionicons name="chatbubble-outline" size={13} color="#fff"/>
                          <Text style={s.inquireTxt}>Inquire Now</Text>
                        </>}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={!!profileModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tutor Profile</Text>
              <TouchableOpacity onPress={()=>setProfileModal(null)}><Ionicons name="close" size={22} color={MUTED}/></TouchableOpacity>
            </View>
            {profileModal&&(
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{alignItems:"center",marginBottom:16}}>
                  <View style={[s.avatar,{width:64,height:64,borderRadius:32,marginBottom:10}]}>
                    <Text style={[s.avatarTxt,{fontSize:26}]}>{profileModal.profile?.full_name?.charAt(0)||"T"}</Text>
                  </View>
                  <Text style={[s.name,{fontSize:18}]}>{profileModal.profile?.full_name}</Text>
                  <Text style={s.meta}>{profileModal.years_experience||0} yrs experience · {profileModal.profile?.location||"—"}</Text>
                  {profileModal.average_rating>0&&(
                    <Text style={[s.starTxt,{marginTop:6}]}>{"★".repeat(Math.round(profileModal.average_rating))} {Number(profileModal.average_rating).toFixed(1)}</Text>
                  )}
                </View>
                {profileModal.profile?.bio&&<Text style={s.bio}>{profileModal.profile.bio}</Text>}
                <View style={s.infoGrid}>
                  <View style={s.infoCell}><Text style={s.infoCellLabel}>Rate</Text><Text style={[s.infoCellVal,{color:TEAL}]}>₱{(profileModal.approved_rate||profileModal.rate_per_session||0).toLocaleString()}/session</Text></View>
                  <View style={s.infoCell}><Text style={s.infoCellLabel}>Package</Text><Text style={s.infoCellVal}>8 sessions</Text></View>
                  <View style={s.infoCell}><Text style={s.infoCellLabel}>Total</Text><Text style={s.infoCellVal}>₱{totalPrice(profileModal)}</Text></View>
                  <View style={s.infoCell}><Text style={s.infoCellLabel}>Experience</Text><Text style={s.infoCellVal}>{profileModal.years_experience||0} yrs</Text></View>
                </View>
                {(profileModal.specialization||[]).length>0&&(
                  <View style={{marginBottom:16}}>
                    <Text style={s.sectionLabel}>Subjects</Text>
                    <View style={s.tagsRow}>
                      {(profileModal.specialization||[]).map((sub:string)=>(
                        <View key={sub} style={s.tag}><Text style={s.tagTxt}>{sub}</Text></View>
                      ))}
                    </View>
                  </View>
                )}
                <View style={s.modalFooter}>
                  <TouchableOpacity style={s.cancelBtn} onPress={()=>setProfileModal(null)}><Text style={s.cancelTxt}>Close</Text></TouchableOpacity>
                  {!isBooked(profileModal.id)&&!hasInquiry(profileModal.id)&&(
                    <TouchableOpacity style={s.nextBtn} onPress={()=>{setProfileModal(null);handleInquire(profileModal);}}>
                      <Text style={s.nextTxt}>Inquire Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
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
  searchBox:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:BORDER,paddingHorizontal:14,paddingVertical:10,marginBottom:16},
  searchInput:{flex:1,fontSize:14,color:DARK},
  empty:{alignItems:"center",marginTop:60}, eIcon:{fontSize:48,marginBottom:12},
  eTitle:{fontSize:16,fontWeight:"700",color:DARK}, eTxt:{fontSize:13,color:MUTED,textAlign:"center",marginTop:8},
  card:{backgroundColor:"#fff",borderRadius:12,borderWidth:1,borderColor:BORDER,padding:16,marginBottom:12},
  cardTop:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:10},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:PRIMARY,alignItems:"center",justifyContent:"center"},
  avatarTxt:{color:"#fff",fontWeight:"800",fontSize:18},
  name:{fontSize:15,fontWeight:"700",color:DARK}, meta:{fontSize:12,color:MUTED,marginTop:2},
  verBadge:{flexDirection:"row",alignItems:"center",gap:4,backgroundColor:GREEN_BG,borderRadius:6,paddingHorizontal:8,paddingVertical:4},
  verTxt:{fontSize:11,color:GREEN,fontWeight:"700"},
  ratingRow:{flexDirection:"row",alignItems:"center",gap:6,marginBottom:8},
  starTxt:{color:ORANGE,fontSize:14}, ratingTxt:{fontSize:12,color:MUTED},
  tagsRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:8},
  tag:{backgroundColor:PRIMARY_BG,borderRadius:6,paddingHorizontal:8,paddingVertical:4},
  tagTxt:{fontSize:11,color:PRIMARY,fontWeight:"600"},
  certRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:10},
  certBadge:{borderRadius:6,paddingHorizontal:8,paddingVertical:4},
  certTxt:{fontSize:10,fontWeight:"700"},
  bottomRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end",marginTop:8},
  price:{fontSize:18,fontWeight:"800",color:PRIMARY}, priceLabel:{fontSize:11,color:MUTED,marginTop:2},
  profileBtn:{paddingHorizontal:12,paddingVertical:7,borderRadius:8,borderWidth:1,borderColor:BORDER,alignItems:"center"},
  profileBtnTxt:{fontSize:12,color:MUTED,fontWeight:"600"},
  inquireBtn:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:PRIMARY,borderRadius:8,paddingHorizontal:14,paddingVertical:8},
  inquireTxt:{color:"#fff",fontWeight:"700",fontSize:12},
  ongoingBtn:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:ORANGE_BG,borderRadius:8,paddingHorizontal:14,paddingVertical:8},
  ongoingTxt:{color:ORANGE,fontWeight:"700",fontSize:12},
  bookedBtn:{backgroundColor:GREEN_BG,borderRadius:8,paddingHorizontal:14,paddingVertical:8,alignItems:"center"},
  bookedTxt:{color:GREEN,fontWeight:"700",fontSize:12},
  // Modal
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  modalBox:{backgroundColor:"#fff",borderTopLeftRadius:20,borderTopRightRadius:20,padding:24,maxHeight:"85%"},
  modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  modalTitle:{fontSize:17,fontWeight:"800",color:DARK},
  bio:{fontSize:13,color:MUTED,lineHeight:20,marginBottom:16},
  infoGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:16},
  infoCell:{width:"47%",backgroundColor:"#F9FAFB",borderRadius:8,padding:12},
  infoCellLabel:{fontSize:10,color:MUTED,textTransform:"uppercase",fontWeight:"700",marginBottom:4},
  infoCellVal:{fontSize:14,fontWeight:"700",color:DARK},
  sectionLabel:{fontSize:13,fontWeight:"700",color:DARK,marginBottom:8},
  modalFooter:{flexDirection:"row",gap:10,marginTop:16},
  cancelBtn:{flex:1,paddingVertical:14,borderRadius:10,borderWidth:1,borderColor:BORDER,alignItems:"center"},
  cancelTxt:{fontSize:14,color:MUTED,fontWeight:"600"},
  nextBtn:{flex:2,paddingVertical:14,borderRadius:10,backgroundColor:PRIMARY,alignItems:"center"},
  nextTxt:{fontSize:14,color:"#fff",fontWeight:"700"},
});
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TextInput, TouchableOpacity, Modal, Alert, FlatList,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Header from "../../components/Header";
import BookTutorModal from "../../components/BookTutorModal";
import { geocode, distanceKm, locationPoints } from "../../lib/geo";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const PRIMARY="#3D3BF3",PRIMARY_BG="#EBEBFF",TEAL="#0D9488",TEAL_BG="#CCFBF1";
const MUTED="#6B7280",DARK="#111827",BORDER="#E5E7EB",BG="#F5F7FB";
const GREEN="#10B981",GREEN_BG="#D1FAE5",ORANGE="#F59E0B",ORANGE_BG="#FEF3C7";
// Same rotation as the website's FindTutorsPage
const ACCENT_COLORS=[PRIMARY,TEAL,MUTED];

// Tutor photo (profile.avatar_url) or white initial on a coloured tile — matches the website
function TutorPhoto({profile,size,radius,bg,style}:{profile:any;size:number;radius:number;bg:string;style?:any}){
  const [failed,setFailed]=useState(false);
  const uri=profile?.avatar_url;
  return (
    <View style={[{width:size,height:size,borderRadius:radius,backgroundColor:bg,alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0},style]}>
      {uri&&!failed
        ? <Image source={{uri}} style={{width:"100%",height:"100%"}} resizeMode="cover" onError={()=>setFailed(true)}/>
        : <Text style={{color:"#fff",fontWeight:"800",fontSize:Math.round(size*0.4)}}>{(profile?.full_name||"T").charAt(0)}</Text>}
    </View>
  );
}

export default function FindTutorsPage() {
  const { user, profile } = useAuth() as any;
  const router   = useRouter();

  // ── Book Now (website parity) ──
  const [students,       setStudents]       = useState<any[]>([]);
  const [activeTutorIds, setActiveTutorIds] = useState<Set<string>>(new Set());
  const [bookingTutor,   setBookingTutor]   = useState<any>(null);
  const [toast,          setToast]          = useState("");

  const loadBookingData = useCallback(async () => {
    if (!user) return;
    const [{ data: kids }, { data: bks }] = await Promise.all([
      supabase.from("students").select("id,name,grade_level,assessment_results").eq("parent_id", user.id),
      supabase.from("bookings").select("tutor_id,status").eq("parent_id", user.id)
        .in("status", ["pending", "confirmed", "pending_parent_confirm"]),
    ]);
    setStudents(kids || []);
    setActiveTutorIds(new Set((bks || []).map((b: any) => b.tutor_id)));
  }, [user]);

  useEffect(() => { loadBookingData(); }, [loadBookingData]);

  const isVerified = profile?.status === "approved";

  const [tutors,    setTutors]    = useState<any[]>([]);
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
          profile:id(full_name,email,location,bio,gender,avatar_url)`)
        .eq("status","approved")
        .order("created_at",{ascending:false});
      setTutors(data||[]); setLoading(false);
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

  // ── Browse / Smart Match + filters (website FindTutorsPage) ──
  const [mode,          setMode]          = useState<"browse"|"smart">("browse");
  const [selectedChild, setSelectedChild] = useState("");
  const [subject,       setSubject]       = useState("");
  const [budget,        setBudget]        = useState("");
  const [gender,        setGender]        = useState("");
  const [locDistances,  setLocDistances]  = useState<Record<string,number>>({});
  const [locChecking,   setLocChecking]   = useState(false);

  // Location checker: parent ↔ tutor distance in km (Factor 5)
  useEffect(() => {
    if (mode !== "smart" || !selectedChild || !profile?.location || !tutors.length) return;
    let cancelled = false;
    (async () => {
      setLocChecking(true);
      const home = await geocode(profile.location);
      if (home) {
        for (const t of tutors) {
          if (cancelled) return;
          if (!t.profile?.location) continue;
          const spot = await geocode(t.profile.location);
          if (spot && !cancelled) setLocDistances(d => ({ ...d, [t.id]: distanceKm(home, spot) }));
        }
      }
      if (!cancelled) setLocChecking(false);
    })();
    return () => { cancelled = true; };
  }, [mode, selectedChild, profile?.location, tutors]);

  const norm = (v:any) => String(v ?? "").toLowerCase().trim();

  // Child's weak subject = lowest subject score in the pre-assessment.
  // Handles the website shape (subject_scores) and the app's older shape ({english:{score}, mathematics:{score}}).
  const getWeakSubject = (child:any) => {
    const res = child?.assessment_results;
    if (!res) return null;
    let entries = Object.entries(res.subject_scores || {}) as [string, number][];
    if (!entries.length) {
      entries = (["english","mathematics"] as const)
        .filter(k => typeof res[k]?.score === "number")
        .map(k => [k, res[k].score] as [string, number]);
    }
    if (entries.length) return entries.sort((a,b) => a[1]-b[1])[0][0];
    return res.level === "primary" ? "english" : "mathematics";
  };

  const calcMatchScore = (tutor:any) => {
    const child = students.find(s => s.id === selectedChild);
    if (!child || !child.assessment_results) return null;

    const certScores = Object.fromEntries(
      Object.entries(tutor.certification_scores || {}).map(([k,v]) => [norm(k), Number(v) || 0])
    ) as Record<string, number>;
    const weakSubject = getWeakSubject(child);

    // F1 weak-subject certification (40%)
    const f1 = ((certScores[weakSubject || ""] || 0) / 100) * 40;
    // F2 overall certification average (20%)
    const scores = Object.values(certScores);
    const avg    = scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;
    const f2     = (avg / 100) * 20;
    // F3 rate vs budget (20%)
    const rate      = tutor.approved_rate || tutor.rate_per_session || 0;
    const budgetNum = budget ? parseInt(budget) : null;
    const f3        = !budgetNum || rate <= budgetNum ? 20 : Math.max(0, 20 - ((rate - budgetNum) / budgetNum) * 20);
    // F4 gender preference (10%)
    const f4 = !gender || norm(tutor.profile?.gender) === norm(gender) ? 10 : 0;
    // F5 location (10%) — distance, or text match fallback
    const parentLoc = norm(profile?.location);
    const tutorLoc  = norm(tutor.profile?.location);
    const km        = locDistances[tutor.id];
    const f5        = typeof km === "number"
      ? locationPoints(km)
      : parentLoc && tutorLoc && (tutorLoc.includes(parentLoc) || parentLoc.includes(tutorLoc)) ? 10 : 0;

    return {
      total: Math.round((f1+f2+f3+f4+f5) * 10) / 10,
      distanceKm: typeof km === "number" ? km : null,
      weakSubject,
      factors: [f1,f2,f3,f4,f5].map(f => Math.round(f*10)/10),
    };
  };

  // Browse: budget & gender are hard filters. Smart Match: they're scored instead (website behaviour).
  const childObj   = students.find(s => s.id === selectedChild);
  const smartOn    = mode === "smart" && !!selectedChild;
  const q          = search.toLowerCase();
  const baseFiltered = tutors.filter((t:any) => {
    if (q && !(t.profile?.full_name?.toLowerCase().includes(q) || (t.specialization||[]).some((s:string)=>s.toLowerCase().includes(q)))) return false;
    if (subject && !(t.specialization||[]).map(norm).includes(subject)) return false;
    if (smartOn) return true;
    const rate = t.approved_rate||t.rate_per_session||0;
    if (budget && rate > parseInt(budget)) return false;
    if (gender && t.profile?.gender !== gender) return false;
    return true;
  });
  const filtered = smartOn
    ? baseFiltered
        .map((t:any) => { const m = calcMatchScore(t); return { ...t, matchScore: m?.total, matchFactors: m?.factors, weakSubject: m?.weakSubject, distanceKm: m?.distanceKm }; })
        .sort((a:any,b:any) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    : baseFiltered;

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

        {toast!=="" && (
          <View style={s.toast}>
            <Text style={s.toastTxt}>✅ {toast}</Text>
            <TouchableOpacity onPress={()=>setToast("")}><Ionicons name="close" size={16} color="#065F46"/></TouchableOpacity>
          </View>
        )}

        {/* Mode toggle */}
        <View style={s.modeRow}>
          {([["browse","📋 Browse All"],["smart","🤖 Smart Match"]] as const).map(([k,l])=>(
            <TouchableOpacity key={k} style={[s.modeBtn, mode===k&&s.modeBtnOn]} onPress={()=>setMode(k)}>
              <Text style={[s.modeTxt, mode===k&&{color:"#fff"}]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Smart Match — child selector */}
        {mode==="smart" && (
          <View style={s.smartCard}>
            <Text style={s.smartTitle}>🤖 Smart Match</Text>
            <Text style={s.smartTxt}>
              Select a child to rank tutors based on their pre-assessment results, certification scores, your budget, and gender preference.
            </Text>
            <Text style={s.filterLbl}>Select Child</Text>
            {students.length===0 ? (
              <Text style={s.meta}>Add a child in My Children first.</Text>
            ) : (
              <View style={{gap:6}}>
                {students.map((st:any)=>{
                  const on = selectedChild===st.id;
                  return (
                    <TouchableOpacity key={st.id} style={[s.childOpt, on&&s.childOptOn]} onPress={()=>setSelectedChild(on?"":st.id)}>
                      <Text style={[s.childOptTxt, on&&{color:"#7C3AED",fontWeight:"700"}]}>
                        {st.name} (Grade {st.grade_level}){st.assessment_results ? " ✓ Assessed" : " — No assessment yet"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {childObj && !childObj.assessment_results && (
              <View style={s.warnBox}><Text style={s.warnTxt}>⚠️ This child hasn't taken the pre-assessment yet. Go to <Text style={{fontWeight:"800"}}>My Children</Text> to complete it first.</Text></View>
            )}
            {childObj?.assessment_results && (
              <View style={s.okBox}><Text style={s.okTxt}>✅ Tutors are ranked by how well they match <Text style={{fontWeight:"800"}}>{childObj.name}</Text>'s learning needs.</Text></View>
            )}
          </View>
        )}

        {/* Filters */}
        <View style={s.filterCard}>
          <Text style={s.filterTitle}>🔎 Filter Tutors</Text>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={MUTED}/>
            <TextInput style={s.searchInput} placeholder="Search name or subject..." placeholderTextColor={MUTED} value={search} onChangeText={setSearch}/>
          </View>
          <Text style={s.filterLbl}>Subject</Text>
          <View style={s.chipRow}>
            {[["","All Subjects"],["english","English"],["mathematics","Mathematics"]].map(([v,l])=>(
              <TouchableOpacity key={v} style={[s.chip, subject===v&&s.chipOn]} onPress={()=>setSubject(v)}>
                <Text style={[s.chipTxt, subject===v&&s.chipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.filterLbl}>Max Budget (₱/session)</Text>
          <TextInput style={s.budgetInput} placeholder="e.g. 400" placeholderTextColor={MUTED} keyboardType="number-pad" value={budget} onChangeText={v=>setBudget(v.replace(/[^0-9]/g,""))}/>
          <Text style={s.filterLbl}>Gender Preference</Text>
          <View style={s.chipRow}>
            {[["","No Preference"],["Female","Female"],["Male","Male"]].map(([v,l])=>(
              <TouchableOpacity key={v} style={[s.chip, gender===v&&s.chipOn]} onPress={()=>setGender(v)}>
                <Text style={[s.chipTxt, gender===v&&s.chipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!loading && (
          <Text style={s.countTxt}>
            {filtered.length} Tutor{filtered.length!==1?"s":""} Found
            {smartOn && childObj?.assessment_results && (
              <Text style={s.countSub}>
                {"  "}— ranked by match score{locChecking ? " · 📍 checking locations…" : ""}{!profile?.location ? " · add your location in My Profile for distance matching" : ""}
              </Text>
            )}
          </Text>
        )}

        {loading ? <ActivityIndicator color={PRIMARY} style={{marginTop:40}}/> :
          filtered.length===0 ? (
            <View style={s.empty}><Text style={s.eIcon}>🔍</Text>
              <Text style={s.eTitle}>No tutors match your filters</Text>
              <Text style={s.eTxt}>Try widening your budget or removing filters.</Text>
            </View>
          ) : filtered.map((t:any, i:number) => {
            const rate       = t.approved_rate||t.rate_per_session||0;
            const ongoing    = hasInquiry(t.id);
            const booked     = isBooked(t.id);
            const isInquiring= inquiring === t.id;

            return (
              <View key={t.id} style={s.card}>
                <View style={s.cardTop}>
                  <TutorPhoto profile={t.profile} size={52} radius={14} bg={ACCENT_COLORS[i%3]}/>
                  <View style={{flex:1}}>
                    <Text style={s.name}>{t.profile?.full_name||"Tutor"}</Text>
                    {smartOn && t.matchScore != null && (
                      <View style={[s.matchBadge,{backgroundColor:t.matchScore>=80?"#D1FAE5":t.matchScore>=60?"#EFF6FF":"#FEF9C3"}]}>
                        <Text style={[s.matchTxt,{color:t.matchScore>=80?"#065F46":t.matchScore>=60?"#1D4ED8":"#92400E"}]}>
                          {t.matchScore.toFixed(1)}% Match
                        </Text>
                      </View>
                    )}
                    <Text style={s.meta}>{t.years_experience||0} yrs experience</Text>
                    {t.profile?.location&&<Text style={s.meta}>📍 {t.profile.location}</Text>}
                  </View>
                  <View style={s.verBadge}><Ionicons name="checkmark-circle" size={14} color={GREEN}/><Text style={s.verTxt}>Verified</Text></View>
                </View>

                {/* Smart Match factor breakdown */}
                {smartOn && t.matchFactors && (
                  <View style={s.factorBox}>
                    <Text style={s.factorTxt}>
                      Weak subject: <Text style={{fontWeight:"800",textTransform:"capitalize"}}>{t.weakSubject}</Text>{"\n"}
                      {["Weak subj","Overall","Budget","Gender","Location"].map((l,fi)=>`${l} ${t.matchFactors[fi].toFixed(1)}`).join(" · ")}
                      {t.distanceKm != null ? `\n📍 About ${t.distanceKm < 1 ? "<1" : t.distanceKm.toFixed(1)} km away` : ""}
                    </Text>
                  </View>
                )}

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
                    {/* Book Now — same states as the website */}
                    {activeTutorIds.has(t.id) ? (
                      <View style={s.ongoingSession}><Text style={s.ongoingSessionTxt}>⏳ Ongoing Session</Text></View>
                    ) : !isVerified ? (
                      <View style={s.verifyFirst}><Text style={s.verifyFirstTxt}>🪪 Verify ID First</Text></View>
                    ) : (
                      <TouchableOpacity
                        style={[s.bookBtn, students.length===0 && {opacity:0.5}]}
                        onPress={()=>setBookingTutor(t)}
                        disabled={students.length===0}
                      >
                        <Ionicons name="calendar-outline" size={13} color="#fff"/>
                        <Text style={s.inquireTxt}>Book Now</Text>
                      </TouchableOpacity>
                    )}
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
                {students.length===0 && isVerified && !activeTutorIds.has(t.id) && (
                  <Text style={s.addChildNote}>Add a child profile first to book.</Text>
                )}
              </View>
            );
          })}
      </ScrollView>

      <BookTutorModal
        tutor={bookingTutor}
        students={students}
        parentId={user?.id}
        onClose={()=>setBookingTutor(null)}
        onBooked={(msg)=>{ setBookingTutor(null); setToast(msg); setTimeout(()=>setToast(""),4000); loadBookingData(); }}
      />

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
                  <TutorPhoto profile={profileModal.profile} size={64} radius={32} bg={PRIMARY} style={{marginBottom:10}}/>
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
                  {isVerified && !activeTutorIds.has(profileModal.id) && students.length>0 && (
                    <TouchableOpacity style={s.nextBtn} onPress={()=>{const t=profileModal;setProfileModal(null);setBookingTutor(t);}}>
                      <Text style={s.nextTxt}>📅 Book Now</Text>
                    </TouchableOpacity>
                  )}
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
  container:{flex:1,backgroundColor:"transparent"}, content:{padding:16,paddingBottom:40},
  heading:{fontSize:20,fontWeight:"800",color:DARK}, sub:{fontSize:13,color:MUTED,marginTop:4,marginBottom:16},
  searchBox:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#fff",borderRadius:10,borderWidth:1,borderColor:BORDER,paddingHorizontal:14,paddingVertical:10,marginBottom:12},
  modeRow:{flexDirection:"row",borderRadius:12,borderWidth:2,borderColor:BORDER,overflow:"hidden",marginBottom:14,alignSelf:"flex-start",backgroundColor:"#fff"},
  modeBtn:{paddingVertical:10,paddingHorizontal:18},
  modeBtnOn:{backgroundColor:PRIMARY},
  modeTxt:{fontSize:13,fontWeight:"700",color:"#374151"},
  smartCard:{backgroundColor:"#F5F3FF",borderWidth:1,borderColor:"#DDD6FE",borderRadius:12,padding:14,marginBottom:14},
  smartTitle:{fontSize:15,fontWeight:"800",color:"#7C3AED",marginBottom:6},
  smartTxt:{fontSize:12,color:"#6D28D9",lineHeight:18,marginBottom:10},
  childOpt:{backgroundColor:"#fff",borderWidth:1.5,borderColor:BORDER,borderRadius:10,paddingHorizontal:12,paddingVertical:10},
  childOptOn:{borderColor:"#7C3AED",backgroundColor:"#EDE9FE"},
  childOptTxt:{fontSize:13,color:"#374151"},
  warnBox:{backgroundColor:"#FEF9C3",borderWidth:1,borderColor:"#FDE68A",borderRadius:8,padding:10,marginTop:8},
  warnTxt:{fontSize:12,color:"#92400E",lineHeight:17},
  okBox:{backgroundColor:"#EDE9FE",borderWidth:1,borderColor:"#C4B5FD",borderRadius:8,padding:10,marginTop:8},
  okTxt:{fontSize:12,color:"#5B21B6",lineHeight:17},
  filterCard:{backgroundColor:"#fff",borderWidth:1,borderColor:BORDER,borderRadius:12,padding:14,marginBottom:14},
  filterTitle:{fontSize:15,fontWeight:"800",color:DARK,marginBottom:10},
  filterLbl:{fontSize:12,fontWeight:"700",color:DARK,marginBottom:6},
  chipRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:12},
  chip:{borderWidth:1.5,borderColor:BORDER,borderRadius:8,paddingHorizontal:10,paddingVertical:6,backgroundColor:"#FAFAFA"},
  chipOn:{borderColor:PRIMARY,backgroundColor:PRIMARY_BG},
  chipTxt:{fontSize:12,fontWeight:"600",color:MUTED},
  chipTxtOn:{color:PRIMARY,fontWeight:"700"},
  budgetInput:{borderWidth:1.5,borderColor:BORDER,borderRadius:10,paddingHorizontal:12,paddingVertical:9,fontSize:14,color:DARK,backgroundColor:"#F9FAFB",marginBottom:12},
  countTxt:{fontSize:15,fontWeight:"800",color:DARK,marginBottom:12},
  countSub:{fontSize:12,fontWeight:"400",color:"#7C3AED"},
  matchBadge:{alignSelf:"flex-start",borderRadius:20,paddingHorizontal:8,paddingVertical:2,marginTop:3},
  matchTxt:{fontSize:11,fontWeight:"800"},
  factorBox:{backgroundColor:"#F5F3FF",borderRadius:8,padding:8,marginBottom:8},
  factorTxt:{fontSize:11,color:"#7C3AED",lineHeight:17},
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
  bookBtn:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,backgroundColor:PRIMARY,borderRadius:8,paddingHorizontal:14,paddingVertical:8},
  ongoingSession:{backgroundColor:"#FEF9C3",borderWidth:1,borderColor:"#FDE68A",borderRadius:8,paddingHorizontal:10,paddingVertical:8,alignItems:"center"},
  ongoingSessionTxt:{color:"#92400E",fontWeight:"700",fontSize:11},
  verifyFirst:{backgroundColor:"#FEE2E2",borderWidth:1,borderColor:"#FECACA",borderRadius:8,paddingHorizontal:10,paddingVertical:8,alignItems:"center"},
  verifyFirstTxt:{color:"#DC2626",fontWeight:"700",fontSize:11},
  addChildNote:{fontSize:11,color:MUTED,marginTop:8,textAlign:"right"},
  toast:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#D1FAE5",borderRadius:12,padding:14,marginBottom:16},
  toastTxt:{flex:1,fontSize:13,fontWeight:"600",color:"#065F46"},
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
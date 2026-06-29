import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Drawer } from "expo-router/drawer";
import { DrawerContentScrollView, DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

const PRIMARY = "#3D3BF3";
const MUTED   = "#6B7280";

type NavItem = { name: string; label: string; icon: keyof typeof Ionicons.glyphMap; };

const NAV_PARENT: NavItem[] = [
  { name: "dashboard",  label: "Dashboard",   icon: "home-outline"        },
  { name: "profile",    label: "My Profile",  icon: "person-outline"      },
  { name: "children",   label: "My Children", icon: "people-outline"      },
  { name: "tutors",     label: "Find Tutors", icon: "search-outline"      },
  { name: "bookings",   label: "Bookings",    icon: "calendar-outline"    },
  { name: "progress",   label: "Sessions",    icon: "book-outline"        },
  { name: "messages",   label: "Messages",    icon: "chatbubble-outline"  },
];

const NAV_TUTOR: NavItem[] = [
  { name: "dashboard",     label: "Dashboard",     icon: "home-outline"       },
  { name: "profile",       label: "My Profile",    icon: "person-outline"     },
  { name: "bookings",      label: "Bookings",      icon: "calendar-outline"   },
  { name: "sessions",      label: "Sessions",      icon: "book-outline"       },
  { name: "certification", label: "Certification", icon: "ribbon-outline"     },
  { name: "wallet",        label: "Wallet",        icon: "wallet-outline"     },
  { name: "messages",      label: "Messages",      icon: "chatbubble-outline" },
];

const NAV_ADMIN: NavItem[] = [
  { name: "dashboard",    label: "Dashboard",    icon: "home-outline"       },
  { name: "verification", label: "Verification", icon: "shield-outline"     },
  { name: "sessions",     label: "Sessions",     icon: "calendar-outline"   },
  { name: "messages",     label: "Messages",     icon: "chatbubble-outline" },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { profile, signOut, loading } = useAuth() as any;
  const router   = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={PRIMARY}/></View>;
  }

  const role = profile?.role || "parent";
  const nav  = role === "tutor" ? NAV_TUTOR : role === "admin" ? NAV_ADMIN : NAV_PARENT;
  const currentPage = pathname.split("/").pop() || "dashboard";

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoBox}><Text style={s.logoTxt}>LB</Text></View>
        <View>
          <Text style={s.logoName}>LearnBridge</Text>
          <Text style={s.logoRole}>{role.charAt(0).toUpperCase()+role.slice(1)}</Text>
        </View>
      </View>

      {/* Nav items */}
      <DrawerContentScrollView {...props} contentContainerStyle={{paddingTop:8}} showsVerticalScrollIndicator={false}>
        {nav.map(item=>{
          const isActive = currentPage===item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[s.navItem, isActive&&s.navItemActive]}
              onPress={()=>router.push(`/(drawer)/${item.name}` as any)}
            >
              <Ionicons name={item.icon} size={20} color={isActive?PRIMARY:MUTED}/>
              <Text style={[s.navLabel, isActive&&s.navLabelActive]}>{item.label}</Text>
              {isActive&&<View style={s.activeBar}/>}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerUser}>
          <View style={s.footerAvatar}>
            <Text style={s.footerAvatarTxt}>{profile?.full_name?.charAt(0)||"U"}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={s.footerName} numberOfLines={1}>{profile?.full_name||"User"}</Text>
            <Text style={s.footerEmail} numberOfLines={1}>{profile?.email||""}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={MUTED}/>
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props)=><CustomDrawerContent {...props}/>}
      screenOptions={{ headerShown:false, drawerStyle:{width:280} }}
    >
      <Drawer.Screen name="dashboard"     options={{title:"Dashboard"}}/>
      <Drawer.Screen name="profile"       options={{title:"My Profile"}}/>
      <Drawer.Screen name="children"      options={{title:"My Children"}}/>
      <Drawer.Screen name="tutors"        options={{title:"Find Tutors"}}/>
      <Drawer.Screen name="bookings"      options={{title:"Bookings"}}/>
      <Drawer.Screen name="progress"      options={{title:"Sessions"}}/>
      <Drawer.Screen name="sessions"      options={{title:"Sessions"}}/>
      <Drawer.Screen name="certification" options={{title:"Certification"}}/>
      <Drawer.Screen name="wallet"        options={{title:"Wallet"}}/>
      <Drawer.Screen name="messages"      options={{title:"Messages"}}/>
      <Drawer.Screen name="verification"  options={{title:"Verification"}}/>
    </Drawer>
  );
}

const s = StyleSheet.create({
  center:          {flex:1,justifyContent:"center",alignItems:"center"},
  wrap:            {flex:1,backgroundColor:"#111827"},
  header:          {flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:20,paddingTop:56,paddingBottom:20,borderBottomWidth:1,borderBottomColor:"#1F2937"},
  logoBox:         {width:38,height:38,borderRadius:10,backgroundColor:PRIMARY,alignItems:"center",justifyContent:"center"},
  logoTxt:         {color:"#fff",fontWeight:"800",fontSize:15},
  logoName:        {color:"#fff",fontWeight:"800",fontSize:16},
  logoRole:        {color:MUTED,fontSize:12,marginTop:2},
  navItem:         {flexDirection:"row",alignItems:"center",gap:14,paddingVertical:13,paddingHorizontal:20,marginHorizontal:10,borderRadius:10,marginBottom:2,position:"relative"},
  navItemActive:   {backgroundColor:"#1F2937"},
  navLabel:        {fontSize:14,color:MUTED,fontWeight:"500",flex:1},
  navLabelActive:  {color:"#fff",fontWeight:"700"},
  activeBar:       {position:"absolute",right:0,top:"20%",bottom:"20%",width:3,borderRadius:3,backgroundColor:PRIMARY},
  footer:          {borderTopWidth:1,borderTopColor:"#1F2937",paddingHorizontal:20,paddingVertical:16,paddingBottom:32},
  footerUser:      {flexDirection:"row",alignItems:"center",gap:12,marginBottom:14},
  footerAvatar:    {width:38,height:38,borderRadius:19,backgroundColor:PRIMARY,alignItems:"center",justifyContent:"center"},
  footerAvatarTxt: {color:"#fff",fontWeight:"800",fontSize:16},
  footerName:      {fontSize:13,fontWeight:"700",color:"#fff"},
  footerEmail:     {fontSize:11,color:MUTED,marginTop:2},
  signOutBtn:      {flexDirection:"row",alignItems:"center",gap:8,paddingVertical:10,paddingHorizontal:14,backgroundColor:"#1F2937",borderRadius:10},
  signOutTxt:      {fontSize:13,color:MUTED,fontWeight:"600"},
});
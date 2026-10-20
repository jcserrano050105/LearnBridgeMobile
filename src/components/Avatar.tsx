import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";

// Mirrors the website's src/components/ui/Avatar.jsx
const colorMap = ["#3D3BF3", "#0D9488", "#F5A623", "#F25C54", "#8B5CF6", "#EC4899"];
const BORDER   = "#E5E7EB";

type AvatarProps = {
  name?:       string | null;  // profile.full_name — first letter is the fallback
  size?:       number;
  colorIndex?: number;         // picks the tint from colorMap
  src?:        string | null;  // profile.avatar_url — public URL from the "avatars" bucket
  role?:       string | null;  // "admin" always shows the LearnBridge logo
  style?:      StyleProp<ViewStyle>;
};

export default function Avatar({ name, size = 36, colorIndex = 0, src = null, role = null, style }: AvatarProps) {
  const bg = colorMap[colorIndex % colorMap.length];
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const circle = { width: size, height: size, borderRadius: size / 2 };

  // Admin always shows the LearnBridge logo
  if (role === "admin") {
    return (
      <View style={[s.center, circle, { backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, padding: size * 0.08 }, style]}>
        <Image source={require("../../assets/images/logo-mark.png")} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      </View>
    );
  }

  if (src && !failed) {
    return (
      <View style={[s.center, circle, { borderWidth: 2, borderColor: bg + "30", overflow: "hidden" }, style]}>
        <Image source={{ uri: src }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setFailed(true)} />
      </View>
    );
  }

  return (
    <View style={[s.center, circle, { backgroundColor: bg + "25", borderWidth: 2, borderColor: bg + "30" }, style]}>
      <Text style={{ color: bg, fontWeight: "800", fontSize: size * 0.38 }}>
        {(name || "U").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
});

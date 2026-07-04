import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";

function RootNavigator() {
  const { user, loading } = useAuth() as any;
  const router    = useRouter();
  const segments  = useSegments();
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isMounted.current) return;
    const inDrawer = segments[0] === "(drawer)";
    if (!user && inDrawer) {
      const timer = setTimeout(() => {
        if (isMounted.current) router.replace("/login" as any);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register-parent" />
      <Stack.Screen name="register-tutor" />
      <Stack.Screen name="(drawer)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
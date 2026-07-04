import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function uploadTutorDocument(userId, file, docType) {
    if (!file) return null;
    const ext      = 'pdf';
    const filename = `${docType}_${Date.now()}.${ext}`;
    const path     = `${userId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from('tutor-documents')
      .upload(path, file, {
        contentType:  'application/pdf',
        cacheControl: '3600',
        upsert:       true,
      });
    if (uploadError) throw new Error(`Failed to upload ${docType}: ${uploadError.message}`);
    return path;
  }

  async function signUp({
    email, password, fullName, role,
    location, gender, bio,
    yearsExperience, ratePerSession, specialization,
    nbiFile, prcFile, medicalFile,
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign-up did not return a user. Check Supabase email confirmation settings.');

    const userId = data.user.id;

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:        userId,
        role,
        full_name: fullName,
        email,
        location:  location || null,
        gender:    gender   || null,
        bio:       bio      || null,
      });

    if (profileError) {
      console.error('Profile insert failed:', profileError);
      throw new Error(`Account created but profile setup failed: ${profileError.message}`);
    }

    if (role === 'tutor') {
      let nbiPath     = null;
      let prcPath     = null;
      let medicalPath = null;

      try {
        [nbiPath, prcPath, medicalPath] = await Promise.all([
          uploadTutorDocument(userId, nbiFile,     'nbi'),
          uploadTutorDocument(userId, prcFile,     'prc'),
          uploadTutorDocument(userId, medicalFile, 'medical'),
        ]);
      } catch (uploadErr) {
        throw new Error(`Documents failed to upload: ${uploadErr.message}. Your account was created — please contact support to resubmit documents.`);
      }

      const { error: tutorError } = await supabase
        .from('tutors')
        .insert({
          id:                  userId,
          specialization:      specialization || [],
          years_experience:    yearsExperience || 0,
          rate_per_session:    ratePerSession  || 0,
          nbi_clearance_url:   nbiPath,
          prc_license_url:     prcPath,
          medical_cert_url:    medicalPath,
          status:              'pending',
          wallet_balance:      0,
        });

      if (tutorError) {
        throw new Error(`Tutor profile setup failed: ${tutorError.message}`);
      }
    }

    setUser(data.user);
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // ── Sign out — clear state immediately so _layout.tsx redirects ──
  async function signOut() {
    // Clear state first BEFORE calling supabase signOut
    // This ensures RootNavigator detects user = null immediately
    setUser(null);
    setProfile(null);
    setLoading(false);

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SIGN OUT ERROR:", error);
    }
  }

  async function getDocumentSignedUrl(storagePath) {
    if (!storagePath) return null;
    const { data, error } = await supabase.storage
      .from('tutor-documents')
      .createSignedUrl(storagePath, 60 * 60);
    if (error) { console.error('Signed URL error:', error); return null; }
    return data.signedUrl;
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut,
      getDocumentSignedUrl,
      refreshProfile: () => user && fetchProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
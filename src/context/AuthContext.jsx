import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Bootstrap session from Supabase ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
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

  /* ── Upload a single PDF to Supabase Storage ──────────────────────────────
   * Path: tutor-documents/{userId}/{filename}
   * Returns the public/signed URL for storing in the tutors table.
   */
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

    // Return the storage path — we use signed URLs when admin views them
    return path;
  }

  /* ── Sign Up ──────────────────────────────────────────────────────────────
   * For parents: creates auth user + profile row.
   * For tutors:  creates auth user + profile row + uploads 3 PDFs to Storage
   *              + creates tutors row with pending status and document paths.
   */
  async function signUp({
    email, password, fullName, role,
    // Tutor-specific
    location, gender, bio,
    yearsExperience, ratePerSession, specialization,
    // Document files (File objects)
    nbiFile, prcFile, medicalFile,
  }) {
    // ── 1. Create auth user ─────────────────────────────────────────────
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign-up did not return a user. Check Supabase email confirmation settings.');

    const userId = data.user.id;

    // ── 2. Insert profile row ───────────────────────────────────────────
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

    // ── 3. Tutor-specific: upload documents + create tutors row ─────────
    if (role === 'tutor') {
      let nbiPath     = null;
      let prcPath     = null;
      let medicalPath = null;

      try {
        // Upload all three documents in parallel
        [nbiPath, prcPath, medicalPath] = await Promise.all([
          uploadTutorDocument(userId, nbiFile,     'nbi'),
          uploadTutorDocument(userId, prcFile,     'prc'),
          uploadTutorDocument(userId, medicalFile, 'medical'),
        ]);
      } catch (uploadErr) {
        // If uploads fail, we still have the profile — inform the user
        throw new Error(`Documents failed to upload: ${uploadErr.message}. Your account was created — please contact support to resubmit documents.`);
      }

      // Insert tutors row with document paths and pending status
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
          status:              'pending',   // Admin must approve before activation
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
  console.log("========== LOGIN ATTEMPT ==========");
  console.log("Email:", email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("========== LOGIN RESPONSE ==========");
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);

  if (error) {
    console.error("Supabase Login Error:", error);
    throw error;
  }

  console.log("========== LOGIN SUCCESS ==========");
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("SIGN OUT ERROR:", error);
    throw error;
  }

  setUser(null);
  setProfile(null);
}
  /* ── Get a signed URL for a private document (for admin viewing) ─────────
   * Generates a 60-minute signed URL for a document stored in tutor-documents.
   */
  async function getDocumentSignedUrl(storagePath) {
    if (!storagePath) return null;
    const { data, error } = await supabase.storage
      .from('tutor-documents')
      .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry
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
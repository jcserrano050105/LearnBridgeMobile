import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPDF, newTempId } from '../lib/pdf';

const AuthContext = createContext(null);

function accountExistsError(role) {
  const as = role ? ` (registered as a ${role.charAt(0).toUpperCase() + role.slice(1)})` : '';
  const err = new Error(
    `An account with this email already exists${as}. Please sign in instead, or use Forgot Password if you can't remember it.`
  );
  err.code = 'account_exists';
  return err;
}

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

  // Same storage layout as the website's RegisterPage: uploaded BEFORE sign-up
  // (no session yet), saved as public URLs.
  //   tutors  → tutor-documents/temp/<tempId>/<name>.pdf
  //   parents → tutor-documents/parent-ids/<tempId>/id1.pdf, id2.pdf
  // `file` is a picked document: { uri, name, size, mimeType }.
  async function uploadSignupPdf(folder, tempId, file, storageName, label) {
    if (!file) return null;
    return uploadPDF(`${folder}/${tempId}/${storageName}`, file, label);
  }

  async function signUp({
    email, password, fullName, role,
    location, gender, bio,
    yearsExperience, ratePerSession, specialization,
    nbiFile, prcFile, medicalFile, applicationFormFile,
    validId1File, validId2File,
  }) {
    email = email.trim();
    let docUrls = {};
    let idUrls  = {};

    // ── Stop before touching Supabase Auth if the email is already registered ──
    // Calling auth.signUp on an existing (unconfirmed) email overwrites its password,
    // so the check has to happen first. Escape LIKE wildcards so ilike is an exact,
    // case-insensitive match.
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: existing, error: lookupError } = await supabase
      .from('profiles')
      .select('role')
      .ilike('email', pattern)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not verify email: ${lookupError.message}`);
    if (existing) throw accountExistsError(existing.role);

    // ── Tutor documents: upload FIRST, before sign-up (same as the website) ──
    if (role === 'tutor') {
      const tempId = newTempId();
      docUrls = {
        nbi_clearance_url:    await uploadSignupPdf('temp', tempId, nbiFile,             'nbi.pdf',              'NBI Clearance'),
        prc_license_url:      await uploadSignupPdf('temp', tempId, prcFile,             'prc.pdf',              'PRC License'),
        medical_cert_url:     await uploadSignupPdf('temp', tempId, medicalFile,         'medical.pdf',          'Medical Certificate'),
        application_form_url: await uploadSignupPdf('temp', tempId, applicationFormFile, 'application-form.pdf', 'Application Form'),
      };
    }

    // ── Parent valid IDs: upload FIRST, before sign-up (same as the website) ──
    if (role === 'parent') {
      const tempId = newTempId();
      idUrls = {
        valid_id_1: await uploadSignupPdf('parent-ids', tempId, validId1File, 'id1.pdf', 'ID'),
        valid_id_2: await uploadSignupPdf('parent-ids', tempId, validId2File, 'id2.pdf', '2nd ID'),
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) {
      if (/already (registered|exists)/i.test(error.message)) throw accountExistsError();
      throw error;
    }
    if (!data.user) throw new Error('Sign-up did not return a user. Check Supabase email confirmation settings.');
    // Supabase returns a placeholder user with no identities when the email is taken
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw accountExistsError();
    }

    const userId = data.user.id;

    const profileRow = {
      id:        userId,
      role,
      full_name: fullName,
      email,
      location:  location || null,
      gender:    gender   || null,
      bio:       bio      || null,
    };
    // Parents start as "pending" until the admin approves their ID (website behaviour)
    if (role === 'parent') {
      profileRow.valid_id_1 = idUrls.valid_id_1 || null;
      profileRow.valid_id_2 = idUrls.valid_id_2 || null;
      profileRow.status     = 'pending';
    }

    // upsert in case a database trigger already created the profile row
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile insert failed:', profileError);
      throw new Error(`Account created but profile setup failed: ${profileError.message}`);
    }

    if (role === 'tutor') {
      // upsert like the website, in case a database trigger already created the row
      const { error: tutorError } = await supabase
        .from('tutors')
        .upsert({
          id:                   userId,
          specialization:       specialization || [],
          years_experience:     yearsExperience || 0,
          rate_per_session:     ratePerSession  || 0,
          nbi_clearance_url:    docUrls.nbi_clearance_url    || null,
          prc_license_url:      docUrls.prc_license_url      || null,
          medical_cert_url:     docUrls.medical_cert_url     || null,
          application_form_url: docUrls.application_form_url || null,
          status:               'pending',
          wallet_balance:       0,
        }, { onConflict: 'id' });

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
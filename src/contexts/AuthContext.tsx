import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/auth/supabaseClient';
import {
  UserProfile,
  getProfile,
  signIn,
  signOut,
  signUp,
  updateHomeLocation,
} from '../services/auth/authService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  doSignIn: (email: string, password: string) => Promise<void>;
  doSignUp: (email: string, password: string) => Promise<void>;
  doSignOut: () => Promise<void>;
  doSetHomeLocation: (lat: number, lon: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = async (userId: string) => {
    setProfileLoading(true);
    const p = await getProfile(userId);
    setProfile(p);
    setProfileLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const doSignIn = async (email: string, password: string) => {
    await signIn(email, password);
  };

  const doSignUp = async (email: string, password: string) => {
    await signUp(email, password);
  };

  const doSignOut = async () => {
    await signOut();
  };

  const doSetHomeLocation = async (lat: number, lon: number) => {
    if (!user) return;
    await updateHomeLocation(user.id, lat, lon);
    await loadProfile(user.id);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    setProfile(p);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileLoading, doSignIn, doSignUp, doSignOut, doSetHomeLocation, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

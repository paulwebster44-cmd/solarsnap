import { supabase } from './supabaseClient';

export interface UserProfile {
  id: string;
  home_latitude: number | null;
  home_longitude: number | null;
  credits_remaining: number;
  licence_tier: 'basic' | 'premium' | 'commercial';
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as UserProfile;
}

export async function updateHomeLocation(userId: string, latitude: number, longitude: number) {
  const { error } = await supabase
    .from('profiles')
    .update({ home_latitude: latitude, home_longitude: longitude })
    .eq('id', userId);
  if (error) throw error;
}

/** Atomically deducts one assessment credit. Returns the new credit count, or -1 if none remain. */
export async function deductCredit(): Promise<number> {
  const { data, error } = await supabase.rpc('deduct_assessment_credit');
  if (error) throw error;
  return data as number;
}

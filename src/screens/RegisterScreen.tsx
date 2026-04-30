import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { AuthStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { doSignUp } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (password.length < 6) { setError(t('auth.register.passwordTooShort')); return; }
    if (password !== confirmPassword) { setError(t('auth.register.passwordMismatch')); return; }

    setLoading(true);
    try {
      await doSignUp(email.trim(), password);
      // onAuthStateChange in AuthContext will handle navigation once signed in
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        setError(t('auth.register.emailInUse'));
      } else if (msg.toLowerCase().includes('at least') || msg.toLowerCase().includes('characters')) {
        // Supabase minimum-length error
        setError(t('auth.register.passwordTooShort'));
      } else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('weak') || msg.toLowerCase().includes('strength')) {
        // Supabase password policy error (special chars, uppercase, etc.)
        setError(t('auth.register.passwordWeak'));
      } else {
        setError(t('auth.register.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        <View style={s.sunIcon}><Text style={s.sunEmoji}>☀️</Text></View>
        <Text style={s.title}>{t('auth.register.title')}</Text>
        <Text style={s.subtitle}>{t('auth.register.subtitle')}</Text>

        <TextInput
          style={s.input}
          placeholder={t('auth.register.email')}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={s.passwordRow}>
          <TextInput
            style={s.passwordInput}
            placeholder={t('auth.register.password')}
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <Text style={s.passwordHint}>{t('auth.register.passwordHint')}</Text>

        <View style={s.passwordRow}>
          <TextInput
            style={s.passwordInput}
            placeholder={t('auth.register.confirmPassword')}
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirmPassword(v => !v)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{t('auth.register.submit')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Login')}>
          <Text style={s.linkText}>
            {t('auth.register.hasAccount')}{' '}
            <Text style={s.linkAccent}>{t('auth.register.signIn')}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  sunIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  sunEmoji: { fontSize: 36 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, backgroundColor: '#f9fafb', color: '#111827',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f9fafb', marginBottom: 12,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827',
  },
  eyeBtn: { paddingHorizontal: 14 },
  passwordHint: { fontSize: 12, color: '#9ca3af', marginTop: -6, marginBottom: 12, paddingHorizontal: 4 },
  errorText: { color: '#dc2626', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: '#f59e0b', paddingVertical: 16,
    borderRadius: 50, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 15 },
  linkAccent: { color: '#f59e0b', fontWeight: '600' },
});

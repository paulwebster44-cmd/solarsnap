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

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { doSignIn } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await doSignIn(email.trim(), password);
    } catch {
      setError(t('auth.login.failed'));
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
        <Text style={s.title}>{t('auth.login.title')}</Text>
        <Text style={s.subtitle}>{t('auth.login.subtitle')}</Text>

        <TextInput
          style={s.input}
          placeholder={t('auth.login.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={s.passwordRow}>
          <TextInput
            style={s.passwordInput}
            placeholder={t('auth.login.password')}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{t('auth.login.submit')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Register')}>
          <Text style={s.linkText}>
            {t('auth.login.noAccount')}{' '}
            <Text style={s.linkAccent}>{t('auth.login.createOne')}</Text>
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
    fontSize: 16, marginBottom: 12, backgroundColor: '#f9fafb',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f9fafb', marginBottom: 12,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  eyeBtn: { paddingHorizontal: 14 },
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

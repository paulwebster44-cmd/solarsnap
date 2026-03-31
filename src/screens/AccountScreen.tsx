import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<AppStackParamList, 'Account'>;

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user, profile, doSignOut } = useAuth();
  const navigation = useNavigation<NavProp>();

  const handleSignOut = () => {
    Alert.alert('', t('account.confirmSignOut'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: doSignOut },
    ]);
  };

  const tierLabel = profile?.licence_tier
    ? t(`account.tiers.${profile.licence_tier}` as any)
    : t('account.tiers.basic');

  const locationLabel =
    profile?.home_latitude != null
      ? t('account.coordinates', {
          lat: profile.home_latitude.toFixed(5),
          lon: profile.home_longitude?.toFixed(5),
        })
      : t('account.notSet');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('account.title')}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.card}>
          <InfoRow label={t('account.email')} value={user?.email ?? ''} />
          <InfoRow label={t('account.credits')} value={String(profile?.credits_remaining ?? 0)} />
          <InfoRow label={t('account.licenceTier')} value={tierLabel} />
        </View>

        <View style={s.card}>
          <InfoRow label={t('account.homeLocation')} value={locationLabel} />
          <TouchableOpacity
            style={s.changeBtn}
            onPress={() => navigation.navigate('SetHomeLocation')}
          >
            <Text style={s.changeBtnText}>{t('account.changeLocation')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutBtnText}>{t('account.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  rowLabel: { color: '#6b7280', fontSize: 15, flexShrink: 0, marginRight: 12 },
  rowValue: { color: '#111827', fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  changeBtn: {
    marginTop: 12, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#fef3c7', borderRadius: 8,
  },
  changeBtnText: { color: '#d97706', fontWeight: '600', fontSize: 15 },
  signOutBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  signOutBtnText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
});

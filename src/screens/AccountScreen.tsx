import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { restorePurchases } from '../services/iap/iapService';
import { saveLanguage } from '../services/language/languageService';
import { SUPPORTED_LANGUAGES, DEVICE_LANGUAGE } from '../i18n';

type NavProp = NativeStackNavigationProp<AppStackParamList, 'Account'>;

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { user, profile, doSignOut, refreshProfile } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [restoring, setRestoring] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const tier = await restorePurchases();
      if (tier) {
        await refreshProfile();
        Alert.alert(t('iap.restore.success.title'), t('iap.restore.success.body'));
      } else {
        Alert.alert(t('iap.restore.noneFound.title'), t('iap.restore.noneFound.body'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('iap.error.generic'));
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('', t('account.confirmSignOut'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: doSignOut },
    ]);
  };

  const handleSelectLanguage = async (code: string) => {
    setShowLangPicker(false);
    await saveLanguage(code).catch(console.warn);
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

  // Current language display
  const currentLangCode = i18n.language;
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode)
    ?? SUPPORTED_LANGUAGES.find((l) => l.code === 'en')!;
  const isAutoDetected = currentLangCode === DEVICE_LANGUAGE;

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

        {/* Language picker */}
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('account.language')}</Text>
            <View style={s.langRight}>
              {isAutoDetected && (
                <Text style={s.autoDetectedBadge}>{t('account.languageAutoDetected')}</Text>
              )}
              <Text style={s.rowValue}>{currentLang.flag}  {currentLang.label}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.changeBtn} onPress={() => setShowLangPicker(true)}>
            <Text style={s.changeBtnText}>{t('account.languagePickerTitle')}</Text>
          </TouchableOpacity>
        </View>

        {/* Restore Purchases — required by Apple App Store guidelines */}
        <TouchableOpacity
          style={s.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring
            ? <ActivityIndicator color="#6b7280" />
            : <Text style={s.restoreBtnText}>{t('iap.restore.label')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutBtnText}>{t('account.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language picker modal */}
      <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowLangPicker(false)} />
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>{t('account.languagePickerTitle')}</Text>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLangCode === lang.code;
            const isDevice = lang.code === DEVICE_LANGUAGE;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.langRow, isSelected && s.langRowSelected]}
                onPress={() => handleSelectLanguage(lang.code)}
              >
                <Text style={s.langFlag}>{lang.flag}</Text>
                <View style={s.langLabelWrap}>
                  <Text style={[s.langLabel, isSelected && s.langLabelSelected]}>{lang.label}</Text>
                  {isDevice && (
                    <Text style={s.langDeviceBadge}>{t('account.languageAutoDetected')}</Text>
                  )}
                </View>
                {isSelected && <Text style={s.langTick}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
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
  langRight: { alignItems: 'flex-end', flexShrink: 1 },
  autoDetectedBadge: { fontSize: 11, color: '#10b981', fontWeight: '600', marginBottom: 2 },
  changeBtn: {
    marginTop: 12, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#fef3c7', borderRadius: 8,
  },
  changeBtnText: { color: '#d97706', fontWeight: '600', fontSize: 15 },
  restoreBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  restoreBtnText: { color: '#6b7280', fontSize: 15 },
  signOutBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  signOutBtnText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },

  // Language picker modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 28,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 },
  langRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4,
  },
  langRowSelected: { backgroundColor: '#fef3c7' },
  langFlag: { fontSize: 24, marginRight: 14 },
  langLabelWrap: { flex: 1 },
  langLabel: { fontSize: 16, color: '#374151' },
  langLabelSelected: { color: '#92400e', fontWeight: '700' },
  langDeviceBadge: { fontSize: 11, color: '#10b981', fontWeight: '600', marginTop: 2 },
  langTick: { fontSize: 18, color: '#f59e0b', fontWeight: '700' },
});

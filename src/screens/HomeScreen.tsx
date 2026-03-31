import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HomeScreenNavProp } from '../types/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavProp>();
  const { t } = useTranslation();
  const { profile } = useAuth();

  const credits = profile?.credits_remaining ?? 0;
  const hasCredits = credits > 0;

  return (
    <View style={styles.container}>

      {/* Account button */}
      <TouchableOpacity
        style={styles.accountBtn}
        onPress={() => navigation.navigate('Account')}
      >
        <Text style={styles.accountBtnText}>{t('home.account')}</Text>
      </TouchableOpacity>

      {/* Logo / title area */}
      <View style={styles.hero}>
        <View style={styles.sunIcon}>
          <Text style={styles.sunEmoji}>☀️</Text>
        </View>
        <Text style={styles.title}>SolarSnap</Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
      </View>

      {/* Credits badge */}
      <View style={[styles.creditsBadge, !hasCredits && styles.creditsBadgeEmpty]}>
        <Text style={[styles.creditsText, !hasCredits && styles.creditsTextEmpty]}>
          {hasCredits
            ? t('home.credits', { count: credits })
            : t('home.noCredits')
          }
        </Text>
      </View>

      {/* How it works */}
      <View style={styles.steps}>
        <Step number="1" text={t('home.step1')} />
        <Step number="2" text={t('home.step2')} />
        <Step number="3" text={t('home.step3')} />
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, !hasCredits && styles.startBtnDisabled]}
          onPress={() => navigation.navigate('Assessment')}
          disabled={!hasCredits}
        >
          <Text style={styles.startBtnText}>{t('home.startAssessment')}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  accountBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  accountBtnText: { color: '#374151', fontSize: 14, fontWeight: '600' },

  hero: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sunIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sunEmoji: { fontSize: 40 },
  title: { fontSize: 36, fontWeight: '800', color: '#f59e0b', marginBottom: 8 },
  tagline: { fontSize: 17, color: '#374151', textAlign: 'center', lineHeight: 24 },

  creditsBadge: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  creditsBadgeEmpty: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  creditsText: { color: '#166534', fontSize: 14, fontWeight: '600' },
  creditsTextEmpty: { color: '#991b1b' },

  steps: { flex: 1, paddingHorizontal: 24, gap: 16 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 22 },

  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
  },
  startBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: '#d1d5db' },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

/**
 * UpgradeSheet
 *
 * A reusable bottom-sheet modal shown when a user on a lower tier tries to
 * access gated content. Used for both the Basic gate (Results screen) and the
 * Premium gate (PremiumResults screen).
 *
 * Props:
 *   visible       — Whether the sheet is showing
 *   productId     — IAP product ID to purchase (from iapConfig)
 *   tierKey       — 'basic' | 'premium' — drives the i18n copy
 *   onSuccess     — Called with the new tier after a confirmed purchase
 *   onDismiss     — Called when the user dismisses without purchasing
 *
 * The sheet handles three states internally: idle, loading, and error.
 * On success it calls onSuccess; on cancellation it calls onDismiss silently.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { fetchProducts, purchaseProduct, restorePurchases, IAPProduct } from '../services/iap/iapService';
import { useAuth } from '../contexts/AuthContext';
import type { LicenceTier } from '../services/auth/authService';
import { COMMERCIAL_ENQUIRY_EMAIL } from '../config/iapConfig';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  productId: string;
  /** Which upgrade tier this sheet is selling */
  tierKey: 'basic' | 'premium';
  onSuccess: (tier: LicenceTier) => void;
  onDismiss: () => void;
}

type SheetState = 'idle' | 'loading' | 'error' | 'success';

// ── Component ──────────────────────────────────────────────────────────────────

export default function UpgradeSheet({ visible, productId, tierKey, onSuccess, onDismiss }: Props) {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();

  const [sheetState, setSheetState] = useState<SheetState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [product, setProduct] = useState<IAPProduct | null>(null);

  // Fetch live product metadata whenever the sheet becomes visible
  useEffect(() => {
    if (!visible) return;
    setSheetState('idle');
    setErrorMessage('');

    fetchProducts([productId]).then((products) => {
      setProduct(products.find((p) => p.productId === productId) ?? null);
    });
  }, [visible, productId]);

  // ── Buy handler ─────────────────────────────────────────────────────────────

  const handleBuy = useCallback(async () => {
    setSheetState('loading');
    setErrorMessage('');

    const outcome = await purchaseProduct(productId);

    if (outcome.success) {
      // Refresh the profile so the new tier is reflected everywhere in the app
      await refreshProfile().catch(() => { /* best-effort */ });
      setSheetState('success');
      // Brief success pause before dismissing so the user sees confirmation
      setTimeout(() => onSuccess(outcome.tier), 1200);
      return;
    }

    if (outcome.cancelled) {
      // User cancelled — dismiss silently, no error message
      setSheetState('idle');
      onDismiss();
      return;
    }

    setSheetState('error');
    setErrorMessage(outcome.message);
  }, [productId, refreshProfile, onSuccess, onDismiss]);

  // ── Restore handler ─────────────────────────────────────────────────────────

  const handleRestore = useCallback(async () => {
    setSheetState('loading');
    setErrorMessage('');

    try {
      const tier = await restorePurchases();
      if (tier) {
        await refreshProfile().catch(() => { /* best-effort */ });
        setSheetState('success');
        setTimeout(() => onSuccess(tier), 1200);
      } else {
        setSheetState('idle');
        Alert.alert(t('iap.restore.noneFound.title'), t('iap.restore.noneFound.body'));
      }
    } catch (err) {
      setSheetState('error');
      setErrorMessage(err instanceof Error ? err.message : t('iap.error.generic'));
    }
  }, [refreshProfile, onSuccess, t]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const priceLabel = product?.priceString ?? t('iap.loadingPrice');
  const isLoading  = sheetState === 'loading';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onDismiss} />

      <View style={s.sheet}>

        {/* Success state */}
        {sheetState === 'success' && (
          <View style={s.successContainer}>
            <Text style={s.successIcon}>✓</Text>
            <Text style={s.successTitle}>{t('iap.success.title')}</Text>
            <Text style={s.successBody}>{t('iap.success.body')}</Text>
          </View>
        )}

        {/* Normal / error state */}
        {sheetState !== 'success' && (
          <>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.tierBadge}>{t(`iap.tier.${tierKey}.badge`)}</Text>
              <Text style={s.title}>{t(`iap.tier.${tierKey}.title`)}</Text>
              <Text style={s.subtitle}>{t(`iap.tier.${tierKey}.subtitle`)}</Text>
            </View>

            {/* Feature list */}
            <View style={s.features}>
              {(t(`iap.tier.${tierKey}.features`, { returnObjects: true }) as string[]).map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Text style={s.featureTick}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Error message */}
            {sheetState === 'error' && errorMessage ? (
              <View style={s.errorBanner}>
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Buy button */}
            <TouchableOpacity
              style={[s.buyBtn, isLoading && s.buyBtnDisabled]}
              onPress={handleBuy}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.buyBtnText}>
                    {t('iap.buy', { price: priceLabel })}
                  </Text>
              }
            </TouchableOpacity>

            {/* Restore link */}
            <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={isLoading}>
              <Text style={s.restoreBtnText}>{t('iap.restore.label')}</Text>
            </TouchableOpacity>

            {/* Commercial enquiry — shown on the Premium sheet.
                Opens a pre-filled email rather than a purchase URL.
                Apple guidelines prohibit linking to external purchase flows;
                a mailto: enquiry link is explicitly permitted. */}
            {tierKey === 'premium' && (
              <TouchableOpacity
                style={s.commercialLink}
                onPress={() => Linking.openURL(`mailto:${COMMERCIAL_ENQUIRY_EMAIL}?subject=SolarSnap%20Commercial%20Enquiry`)}
              >
                <Text style={s.commercialLinkText}>{t('iap.commercial.link')}</Text>
              </TouchableOpacity>
            )}

            {/* Dismiss */}
            <TouchableOpacity style={s.dismissBtn} onPress={onDismiss} disabled={isLoading}>
              <Text style={s.dismissBtnText}>{t('iap.dismiss')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },

  // Success state
  successContainer: { alignItems: 'center', paddingVertical: 32 },
  successIcon:  { fontSize: 48, color: '#16a34a', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successBody:  { fontSize: 15, color: '#6b7280', textAlign: 'center' },

  // Header
  header:    { marginBottom: 16 },
  tierBadge: { fontSize: 11, fontWeight: '700', color: '#f59e0b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  title:     { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle:  { fontSize: 15, color: '#6b7280', lineHeight: 22 },

  // Features
  features:    { marginBottom: 16 },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  featureTick: { color: '#16a34a', fontWeight: '700', fontSize: 15, marginRight: 10, marginTop: 1 },
  featureText: { color: '#374151', fontSize: 15, flex: 1, lineHeight: 22 },

  // Error
  errorBanner: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText:   { color: '#dc2626', fontSize: 13, textAlign: 'center' },

  // Buy button
  buyBtn:         { backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginBottom: 12 },
  buyBtnDisabled: { backgroundColor: '#d97706' },
  buyBtnText:     { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Restore
  restoreBtn:     { paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  restoreBtnText: { color: '#6b7280', fontSize: 14 },

  // Commercial link
  commercialLink:     { paddingVertical: 8, alignItems: 'center', marginBottom: 4 },
  commercialLinkText: { color: '#3b82f6', fontSize: 13 },

  // Dismiss
  dismissBtn:     { paddingVertical: 10, alignItems: 'center' },
  dismissBtnText: { color: '#9ca3af', fontSize: 14 },
});

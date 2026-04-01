/**
 * PremiumResultsScreen
 *
 * Displays the full PVGIS yield report for Premium / Commercial users:
 *   • Suitability verdict and score (carried from the basic assessment)
 *   • Estimated annual kWh yield and £ saving (prominent)
 *   • Monthly energy bar chart (12 months, no external charting library)
 *   • Adjustable panel capacity and unit price with instant recalculation
 *   • Small-print PVGIS data disclaimer
 *
 * Basic-tier users see the same screen layout but with values locked behind
 * an upgrade prompt so they understand what they are missing.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Alert kept for the settings validation error
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  fetchPVGISYield,
  PVGISCoverageError,
  PVGISResult,
} from '../services/pvgis/pvgisService';
import { ENERGY_CONFIG } from '../config/energyConfig';
import { useAuth } from '../contexts/AuthContext';
import { SuitabilityVerdict } from '../types/solar';
import {
  PremiumResultsScreenNavProp,
  PremiumResultsScreenRouteProp,
} from '../types/navigation';
import UpgradeSheet from '../components/UpgradeSheet';
import { IAP_PRODUCTS } from '../config/iapConfig';

// ── Helpers ────────────────────────────────────────────────────────────────────

function verdictColour(verdict: SuitabilityVerdict): string {
  switch (verdict) {
    case 'Excellent': return '#16a34a';
    case 'Good':      return '#ca8a04';
    case 'Fair':      return '#ea580c';
    case 'Poor':      return '#dc2626';
  }
}

function bearingToLabel(b: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
}

function hasPremiumAccess(tier: string | undefined): boolean {
  return tier === 'premium' || tier === 'commercial';
}

// ── Monthly bar chart ──────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_MAX_HEIGHT = 80; // px — tallest bar at 100 % of scale

function MonthlyChart({ monthly }: { monthly: PVGISResult['monthly'] }) {
  const maxKWh = Math.max(...monthly.map((m) => m.energyKWh), 1);

  return (
    <View style={chart.container}>
      {monthly.map((entry) => {
        const heightPct = entry.energyKWh / maxKWh;
        const barHeight = Math.max(4, Math.round(heightPct * BAR_MAX_HEIGHT));
        return (
          <View key={entry.month} style={chart.column}>
            {/* Value label above bar */}
            <Text style={chart.valueLabel}>{entry.energyKWh}</Text>
            {/* Spacer pushes bar to the bottom of the column */}
            <View style={{ flex: 1 }} />
            <View style={[chart.bar, { height: barHeight }]} />
            <Text style={chart.monthLabel}>{MONTH_LABELS[entry.month - 1]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Locked preview shown behind the UpgradeSheet for non-premium users ────────

function LockedPreview() {
  const { t } = useTranslation();
  return (
    <View style={up.container}>
      <View style={up.previewRow}>
        <View style={up.previewCard}>
          <Text style={up.previewLabel}>{t('premium.upgrade.annualYield')}</Text>
          <Text style={up.previewValue}>— kWh</Text>
        </View>
        <View style={up.previewCard}>
          <Text style={up.previewLabel}>{t('premium.upgrade.annualSaving')}</Text>
          <Text style={up.previewValue}>£—</Text>
        </View>
      </View>
      <View style={up.previewChartCard}>
        <Text style={up.previewLabel}>{t('premium.upgrade.monthlyChart')}</Text>
        <View style={up.previewBars}>
          {[40, 55, 70, 80, 90, 95, 95, 90, 75, 60, 45, 35].map((h, i) => (
            <View key={i} style={[up.previewBar, { height: h * 0.6 }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PremiumResultsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<PremiumResultsScreenNavProp>();
  const { profile } = useAuth();
  const {
    result, bearing, tilt, latitude, longitude,
    obstruction, adjustedScore, adjustedVerdict,
  } = useRoute<PremiumResultsScreenRouteProp>().params;

  const [showUpgrade, setShowUpgrade] = useState(true);
  const isPremium = hasPremiumAccess(profile?.licence_tier);

  // ── State ──────────────────────────────────────────────────────────────────

  const [pvgisResult, setPvgisResult] = useState<PVGISResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User-adjustable inputs (strings so TextInput works cleanly)
  const [capacityInput, setCapacityInput] = useState(
    ENERGY_CONFIG.defaultCapacityWp.toString(),
  );
  const [unitPriceInput, setUnitPriceInput] = useState(
    ENERGY_CONFIG.defaultUnitPriceGBP.toString(),
  );

  // ── PVGIS fetch ────────────────────────────────────────────────────────────

  const runFetch = useCallback(async (capacityWp: number, unitPriceGBP: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchPVGISYield({
        latitude,
        longitude,
        bearing,
        tiltDeg: tilt,
        capacityWp,
        unitPriceGBP,
      });
      setPvgisResult(res);
    } catch (err) {
      if (err instanceof PVGISCoverageError) {
        setErrorMessage(t('premium.errorCoverage'));
      } else {
        setErrorMessage(t('premium.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, bearing, tilt, t]);

  // Fetch on mount (premium users only)
  useEffect(() => {
    if (!isPremium) return;
    runFetch(ENERGY_CONFIG.defaultCapacityWp, ENERGY_CONFIG.defaultUnitPriceGBP);
  }, [isPremium, runFetch]);

  // ── Recalculate handler ────────────────────────────────────────────────────

  const handleRecalculate = useCallback(() => {
    const capacity = parseInt(capacityInput, 10);
    const unitPrice = parseFloat(unitPriceInput);

    if (
      isNaN(capacity) || capacity < ENERGY_CONFIG.minCapacityWp || capacity > ENERGY_CONFIG.maxCapacityWp ||
      isNaN(unitPrice) || unitPrice < ENERGY_CONFIG.minUnitPriceGBP || unitPrice > ENERGY_CONFIG.maxUnitPriceGBP
    ) {
      Alert.alert(t('common.error'), t('premium.settings.invalidInput', {
        minWp: ENERGY_CONFIG.minCapacityWp,
        maxWp: ENERGY_CONFIG.maxCapacityWp,
        minPrice: ENERGY_CONFIG.minUnitPriceGBP.toFixed(2),
        maxPrice: ENERGY_CONFIG.maxUnitPriceGBP.toFixed(2),
      }));
      return;
    }

    runFetch(capacity, unitPrice);
  }, [capacityInput, unitPriceInput, runFetch, t]);

  // ── Derived display values ─────────────────────────────────────────────────

  const displayVerdict = adjustedVerdict ?? result.verdict;
  const displayScore   = adjustedScore   ?? result.annualDaylightPercentage;
  const colour = verdictColour(displayVerdict);

  // ── Render: non-premium gate — show locked preview + UpgradeSheet ─────────

  if (!isPremium) {
    return (
      <View style={s.container}>
        <View style={[s.header, { backgroundColor: colour }]}>
          <Text style={s.headerLabel}>{t('results.solarSuitability')}</Text>
          <Text style={s.verdictText}>{t(`results.verdict.${displayVerdict}` as any)}</Text>
          <Text style={s.scoreText}>{t('results.annualScore', { score: displayScore })}</Text>
        </View>
        <LockedPreview />
        <UpgradeSheet
          visible={showUpgrade}
          productId={IAP_PRODUCTS.PREMIUM}
          tierKey="premium"
          onSuccess={() => setShowUpgrade(false)}
          onDismiss={() => navigation.goBack()}
        />
      </View>
    );
  }

  // ── Render: premium content ────────────────────────────────────────────────

  return (
    <View style={s.container}>

      {/* Verdict header — same colour coding as ResultsScreen */}
      <View style={[s.header, { backgroundColor: colour }]}>
        <Text style={s.headerLabel}>{t('results.solarSuitability')}</Text>
        <Text style={s.verdictText}>{t(`results.verdict.${displayVerdict}` as any)}</Text>
        <Text style={s.scoreText}>{t('results.annualScore', { score: displayScore })}</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${displayScore}%` }]} />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* Loading state */}
        {loading && (
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={s.loadingText}>{t('premium.calculating')}</Text>
          </View>
        )}

        {/* Error state */}
        {!loading && errorMessage && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>{t('premium.errorTitle')}</Text>
            <Text style={s.errorBody}>{errorMessage}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={handleRecalculate}>
              <Text style={s.retryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Yield results */}
        {!loading && pvgisResult && (
          <>
            {/* Hero yield cards */}
            <View style={s.heroRow}>
              <View style={[s.heroCard, { borderTopColor: '#16a34a' }]}>
                <Text style={s.heroLabel}>{t('premium.annualYield')}</Text>
                <Text style={[s.heroValue, { color: '#16a34a' }]}>
                  {pvgisResult.annualKWh}
                </Text>
                <Text style={s.heroUnit}>{t('premium.annualYieldUnit')}</Text>
              </View>
              <View style={[s.heroCard, { borderTopColor: '#f59e0b' }]}>
                <Text style={s.heroLabel}>{t('premium.annualSaving')}</Text>
                <Text style={[s.heroValue, { color: '#f59e0b' }]}>
                  £{pvgisResult.annualSavingGBP.toFixed(0)}
                </Text>
                <Text style={s.heroUnit}>{t('premium.annualSavingUnit')}</Text>
              </View>
            </View>

            {/* Monthly chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('premium.monthlyChart')}</Text>
              <MonthlyChart monthly={pvgisResult.monthly} />
              <Text style={s.chartUnit}>{t('premium.chartUnit')}</Text>
            </View>

            {/* Panel orientation (context for the PVGIS calculation) */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('results.panel.title')}</Text>
              <Row label={t('results.panel.facing')} value={`${bearing}° (${bearingToLabel(bearing)})`} />
              <Row label={t('results.panel.tilt')}   value={`${tilt}°`} />
              <Row label={t('premium.capacity')}     value={`${pvgisResult.capacityWp} Wp`} />
            </View>

            {/* User-adjustable settings */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('premium.settings.title')}</Text>

              <View style={s.settingRow}>
                <Text style={s.settingLabel}>{t('premium.settings.capacity')}</Text>
                <TextInput
                  style={s.settingInput}
                  value={capacityInput}
                  onChangeText={setCapacityInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="done"
                />
              </View>

              <View style={s.settingRow}>
                <Text style={s.settingLabel}>{t('premium.settings.unitPrice')}</Text>
                <TextInput
                  style={s.settingInput}
                  value={unitPriceInput}
                  onChangeText={setUnitPriceInput}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity style={s.recalcBtn} onPress={handleRecalculate}>
                <Text style={s.recalcBtnText}>{t('premium.settings.recalculate')}</Text>
              </TouchableOpacity>
            </View>

            {/* Disclaimer */}
            <Text style={s.disclaimer}>{t('premium.disclaimer')}</Text>
          </>
        )}

      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── Row helper (shared with ResultsScreen pattern) ────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  header:       { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center' },
  headerLabel:  { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  verdictText:  { color: '#fff', fontSize: 48, fontWeight: '800', marginBottom: 4 },
  scoreText:    { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 16 },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#fff', borderRadius: 3 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  loadingCard: { backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center', marginBottom: 12 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#6b7280', textAlign: 'center' },

  errorCard:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 20, marginBottom: 12, alignItems: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626', marginBottom: 8 },
  errorBody:  { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  retryBtn:   { backgroundColor: '#f59e0b', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 50 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  heroRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  heroCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderTopWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  heroValue: { fontSize: 42, fontWeight: '800', lineHeight: 48 },
  heroUnit:  { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },

  card:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  chartUnit: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 },

  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  rowLabel: { color: '#374151', fontSize: 15 },
  rowValue: { color: '#111827', fontSize: 15, fontWeight: '600' },

  settingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  settingLabel: { color: '#374151', fontSize: 15, flex: 1 },
  settingInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#111827', width: 90, textAlign: 'right', backgroundColor: '#f9fafb' },
  recalcBtn:     { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 50, alignItems: 'center', marginTop: 4 },
  recalcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  disclaimer: { fontSize: 12, color: '#9ca3af', lineHeight: 18, textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 },

  footer:      { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  backBtn:     { borderWidth: 2, borderColor: '#f59e0b', paddingVertical: 14, borderRadius: 50, alignItems: 'center' },
  backBtnText: { color: '#f59e0b', fontSize: 17, fontWeight: '700' },
});

// ── Chart styles ──────────────────────────────────────────────────────────────

const chart = StyleSheet.create({
  container:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_MAX_HEIGHT + 40, paddingTop: 16 },
  column:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:        { width: '70%', backgroundColor: '#f59e0b', borderRadius: 3 },
  valueLabel: { fontSize: 8, color: '#6b7280', marginBottom: 2, textAlign: 'center' },
  monthLabel: { fontSize: 9, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
});

// ── Upgrade prompt styles ─────────────────────────────────────────────────────

const up = StyleSheet.create({
  container:    { flex: 1, margin: 16 },
  previewRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  previewCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', opacity: 0.35 },
  previewLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  previewValue: { fontSize: 36, fontWeight: '800', color: '#d1d5db' },
  previewChartCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, opacity: 0.35 },
  previewBars:  { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 3, marginTop: 8 },
  previewBar:   { flex: 1, backgroundColor: '#d1d5db', borderRadius: 2 },

  lockOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(249,250,251,0.92)', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 24 },
  lockIcon:     { fontSize: 36, marginBottom: 12 },
  lockTitle:    { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  lockBody:     { fontSize: 15, color: '#374151', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  ctaBtn:       { backgroundColor: '#f59e0b', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 50, marginBottom: 12 },
  ctaBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  dismissBtn:   { paddingVertical: 10 },
  dismissBtnText: { color: '#6b7280', fontSize: 15 },
});

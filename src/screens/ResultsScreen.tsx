/**
 * ResultsScreen
 *
 * Displays the solar suitability assessment after applying the obstruction
 * penalty from the sky image analysis. Shows both the base solar score and
 * the adjusted score so the user understands the impact of any obstructions.
 */

import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ResultsScreenNavProp, ResultsScreenRouteProp } from '../types/navigation';
import { SuitabilityVerdict } from '../types/solar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictColour(verdict: SuitabilityVerdict): string {
  switch (verdict) {
    case 'Excellent': return '#16a34a';
    case 'Good':      return '#ca8a04';
    case 'Fair':      return '#ea580c';
    case 'Poor':      return '#dc2626';
  }
}

function verdictDescription(verdict: SuitabilityVerdict): string {
  switch (verdict) {
    case 'Excellent': return 'This location receives excellent sun exposure. A panel here should generate strong returns throughout the year.';
    case 'Good':      return 'This location receives good sun exposure. A panel here should generate worthwhile returns for most of the year.';
    case 'Fair':      return 'This location has moderate sun exposure. A panel here will generate some energy but may not reach full potential.';
    case 'Poor':      return 'This location has limited sun exposure. A panel here is unlikely to generate meaningful energy.';
  }
}

function bearingToLabel(b: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const navigation = useNavigation<ResultsScreenNavProp>();
  const { result, bearing, tilt, latitude, longitude, obstruction, adjustedScore, adjustedVerdict } =
    useRoute<ResultsScreenRouteProp>().params;

  // Use adjusted verdict/score if obstruction data is available, otherwise use base
  const displayVerdict = adjustedVerdict ?? result.verdict;
  const displayScore   = adjustedScore   ?? result.annualDaylightPercentage;
  const colour = verdictColour(displayVerdict);
  const hasObstruction = obstruction !== undefined;

  return (
    <View style={s.container}>

      {/* ── Verdict header ── */}
      <View style={[s.header, { backgroundColor: colour }]}>
        <Text style={s.headerLabel}>Solar Suitability</Text>
        <Text style={s.verdictText}>{displayVerdict}</Text>
        <Text style={s.scoreText}>{displayScore}% of annual solar energy potential</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${displayScore}%` }]} />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        <Text style={s.description}>{verdictDescription(displayVerdict)}</Text>

        {/* ── Obstruction analysis ── */}
        {hasObstruction ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Sky Obstruction Analysis</Text>

            {/* Sky vs obstruction bar */}
            <View style={s.obstructionBarRow}>
              <View style={[s.obstructionBarSky, { flex: obstruction.skyPercentage }]} />
              <View style={[s.obstructionBarBlocked, { flex: obstruction.obstructionPercentage }]} />
            </View>
            <View style={s.obstructionLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#16a34a' }]} />
                <Text style={s.legendText}>Sky: {obstruction.skyPercentage}%</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#dc2626' }]} />
                <Text style={s.legendText}>Obstructed: {obstruction.obstructionPercentage}%</Text>
              </View>
            </View>

            {obstruction.detectedObstructions.length > 0 && (
              <View style={s.row}>
                <Text style={s.rowLabel}>Obstructions detected</Text>
                <Text style={s.rowValue}>{obstruction.detectedObstructions.join(', ')}</Text>
              </View>
            )}

            {/* Score adjustment explanation */}
            {adjustedScore !== undefined && adjustedScore !== result.annualDaylightPercentage && (
              <View style={s.adjustmentNote}>
                <Text style={s.adjustmentNoteText}>
                  Base solar score: {result.annualDaylightPercentage}%
                  {' → '}adjusted for obstructions: {adjustedScore}%
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Sky Obstruction Analysis</Text>
            <Text style={s.noAnalysisText}>
              Obstruction analysis was not available for this assessment.
              The score shown is based on solar position only.
            </Text>
          </View>
        )}

        {/* ── Panel orientation ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Panel Orientation</Text>
          <Row label="Facing direction" value={`${bearing}° (${bearingToLabel(bearing)})`} />
          <Row label="Tilt from vertical" value={`${tilt}°`} />
          <Text style={s.tiltNote}>Tilt is captured for future analysis and not yet factored into the score.</Text>
        </View>

        {/* ── Current sun position ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sun Right Now</Text>
          <Row
            label="Azimuth (direction)"
            value={`${result.currentSolarPosition.azimuth}° (${bearingToLabel(result.currentSolarPosition.azimuth)})`}
          />
          <Row label="Altitude (above horizon)" value={`${result.currentSolarPosition.altitude}°`} />
          <Row
            label="In panel's field of view"
            value={result.isSunInView ? 'Yes' : result.currentSolarPosition.altitude <= 0 ? 'No — below horizon' : 'No — outside panel arc'}
            valueColour={result.isSunInView ? '#16a34a' : '#dc2626'}
          />
        </View>

        {/* ── Location ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Location</Text>
          <Row label="Latitude"  value={`${latitude.toFixed(5)}°`} />
          <Row label="Longitude" value={`${longitude.toFixed(5)}°`} />
        </View>

      </ScrollView>

      {/* ── Footer button ── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={s.retryBtnText}>Assess Again</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value, valueColour }: { label: string; value: string; valueColour?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColour ? { color: valueColour } : null]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center' },
  headerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  verdictText: { color: '#fff', fontSize: 48, fontWeight: '800', marginBottom: 4 },
  scoreText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 16 },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  description: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16, paddingHorizontal: 4 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },

  // Obstruction bar
  obstructionBarRow: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  obstructionBarSky: { backgroundColor: '#16a34a' },
  obstructionBarBlocked: { backgroundColor: '#dc2626' },
  obstructionLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: '#374151' },

  adjustmentNote: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 10, marginTop: 8 },
  adjustmentNoteText: { fontSize: 13, color: '#713f12', textAlign: 'center' },

  noAnalysisText: { fontSize: 14, color: '#6b7280', lineHeight: 20 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  rowLabel: { color: '#374151', fontSize: 15 },
  rowValue: { color: '#111827', fontSize: 15, fontWeight: '600' },
  tiltNote: { marginTop: 10, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  retryBtn: { backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  retryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

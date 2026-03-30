/**
 * ResultsScreen
 *
 * Displays the solar suitability assessment result after the user has pointed
 * their phone at the sky from their proposed installation location.
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

/** Colour for each verdict tier, used across the results UI. */
function verdictColour(verdict: SuitabilityVerdict): string {
  switch (verdict) {
    case 'Excellent': return '#16a34a'; // green
    case 'Good':      return '#ca8a04'; // amber
    case 'Fair':      return '#ea580c'; // orange
    case 'Poor':      return '#dc2626'; // red
  }
}

/** Brief explanation shown under the verdict. */
function verdictDescription(verdict: SuitabilityVerdict): string {
  switch (verdict) {
    case 'Excellent':
      return 'This location receives excellent sun exposure. A panel here should generate strong returns throughout the year.';
    case 'Good':
      return 'This location receives good sun exposure. A panel here should generate worthwhile returns for most of the year.';
    case 'Fair':
      return 'This location has moderate sun exposure. A panel here will generate some energy but may not reach full potential.';
    case 'Poor':
      return 'This location has limited sun exposure. A panel here is unlikely to generate meaningful energy.';
  }
}

/** Converts a compass bearing to a cardinal/intercardinal label. */
function bearingToLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const navigation = useNavigation<ResultsScreenNavProp>();
  const route = useRoute<ResultsScreenRouteProp>();
  const { result, bearing, tilt, latitude, longitude } = route.params;

  const colour = verdictColour(result.verdict);
  const { currentSolarPosition, isSunInView, annualDaylightPercentage } = result;

  return (
    <View style={styles.container}>

      {/* ── Verdict header ── */}
      <View style={[styles.header, { backgroundColor: colour }]}>
        <Text style={styles.headerLabel}>Solar Suitability</Text>
        <Text style={styles.verdictText}>{result.verdict}</Text>
        <Text style={styles.scoreText}>{annualDaylightPercentage}% of annual solar energy potential</Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${annualDaylightPercentage}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Verdict description ── */}
        <Text style={styles.description}>{verdictDescription(result.verdict)}</Text>

        {/* ── Panel details ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Panel Orientation</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Facing direction</Text>
            <Text style={styles.rowValue}>{bearing}° ({bearingToLabel(bearing)})</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tilt from vertical</Text>
            <Text style={styles.rowValue}>{tilt}°</Text>
          </View>
          <Text style={styles.tiltNote}>
            Tilt is captured for future analysis and is not yet factored into the score.
          </Text>
        </View>

        {/* ── Current sun position ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sun Right Now</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Azimuth (direction)</Text>
            <Text style={styles.rowValue}>
              {currentSolarPosition.azimuth}° ({bearingToLabel(currentSolarPosition.azimuth)})
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Altitude (above horizon)</Text>
            <Text style={styles.rowValue}>{currentSolarPosition.altitude}°</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>In panel's field of view</Text>
            <Text style={[styles.rowValue, { color: isSunInView ? '#16a34a' : '#dc2626' }]}>
              {isSunInView ? 'Yes' : currentSolarPosition.altitude <= 0 ? 'No — sun below horizon' : 'No — outside panel arc'}
            </Text>
          </View>
        </View>

        {/* ── Location ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Latitude</Text>
            <Text style={styles.rowValue}>{latitude.toFixed(5)}°</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Longitude</Text>
            <Text style={styles.rowValue}>{longitude.toFixed(5)}°</Text>
          </View>
        </View>

        {/* ── Milestone note ── */}
        <View style={styles.milestoneNote}>
          <Text style={styles.milestoneNoteText}>
            Sky photo captured. Obstruction analysis (trees, buildings, chimneys) will be added in a future update.
          </Text>
        </View>

      </ScrollView>

      {/* ── Assess again button ── */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Assess Again</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header / verdict band
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  verdictText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 4,
  },
  scoreText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    marginBottom: 16,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },

  // Scrollable body
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  // Info cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: {
    color: '#374151',
    fontSize: 15,
  },
  rowValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  tiltNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Milestone note
  milestoneNote: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  milestoneNoteText: {
    color: '#92400e',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  retryBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

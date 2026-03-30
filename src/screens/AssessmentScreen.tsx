/**
 * AssessmentScreen
 *
 * The user stands at their proposed installation spot, holds their phone up
 * toward the sky in the orientation the panel would be mounted, and taps Assess.
 *
 * Flow:
 *   1. Take photo + read GPS, compass bearing, tilt
 *   2. Calculate solar suitability (local, ~1–2 s)
 *   3. Send photo to Hugging Face for sky segmentation (~5–15 s)
 *   4. If sky coverage is borderline (40–60%), prompt user to try another angle
 *   5. Apply obstruction penalty and navigate to Results
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { useNavigation } from '@react-navigation/native';

import { assessSuitability } from '../services/solar/solarSuitability';
import { analyseSkyPhoto, HFModelLoadingError, ObstructionAnalysis } from '../services/analysis/skyAnalysis';
import { applyObstructionPenalty, averageSkyPercentages } from '../services/analysis/obstructionPenalty';
import { AssessmentScreenNavProp } from '../types/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────

function bearingToLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

function calcTilt(x: number, y: number, z: number): number {
  const tiltDeg = Math.atan2(Math.abs(z), Math.abs(y)) * (180 / Math.PI);
  return Math.min(90, Math.max(0, Math.round(tiltDeg)));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssessmentScreen() {
  const navigation = useNavigation<AssessmentScreenNavProp>();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [tilt, setTilt] = useState(0);

  // Multi-stage loading feedback
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Borderline photo retry state
  const [showBorderlinePrompt, setShowBorderlinePrompt] = useState(false);
  const [firstSkyPct, setFirstSkyPct] = useState<number | null>(null);
  const [pendingData, setPendingData] = useState<{
    bearing: number; tilt: number;
    latitude: number; longitude: number;
    photoUri: string;
    solarResult: ReturnType<typeof assessSuitability>;
    obstruction: ObstructionAnalysis;
  } | null>(null);

  // ── Permissions ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    })();
  }, []);

  // ── Compass heading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    if (!locationGranted) return;
    (async () => {
      sub = await Location.watchHeadingAsync((h) => {
        setBearing(Math.round(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
      });
    })();
    return () => { sub?.remove(); };
  }, [locationGranted]);

  // ── Accelerometer (tilt) ──────────────────────────────────────────────────────

  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => setTilt(calcTilt(x, y, z)));
    return () => sub.remove();
  }, []);

  // ── Core assess logic ────────────────────────────────────────────────────────

  const runAnalysis = useCallback(async (
    photoUri: string,
    snapBearing: number,
    snapTilt: number,
    previousSkyPct?: number,
  ) => {
    setErrorMessage(null);
    setLoadingStage('Reading GPS location…');

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = location.coords;

    setLoadingStage('Calculating solar position…');

    // Solar suitability runs synchronously — yield to let the UI update first
    await new Promise((resolve) => setTimeout(resolve, 50));
    const solarResult = assessSuitability(latitude, longitude, snapBearing);

    setLoadingStage('Analysing sky for obstructions…\n(this takes ~10 seconds)');

    let obstruction: ObstructionAnalysis;
    try {
      obstruction = await analyseSkyPhoto(photoUri);
    } catch (err) {
      if (err instanceof HFModelLoadingError) {
        setLoadingStage(`Sky analysis model warming up…\nRetrying in ${err.estimatedSeconds}s`);
        await new Promise((resolve) => setTimeout(resolve, err.estimatedSeconds * 1000));
        obstruction = await analyseSkyPhoto(photoUri);
      } else {
        // If sky analysis fails entirely, proceed without it and note the issue
        setLoadingStage(null);
        navigation.navigate('Results', {
          result: solarResult,
          bearing: snapBearing,
          tilt: snapTilt,
          latitude,
          longitude,
          photoUri,
          // No obstruction data — results screen will show a note
        });
        return;
      }
    }

    // If borderline and this is the first photo, ask user to try another angle
    if (obstruction.isBorderline && previousSkyPct === undefined) {
      setPendingData({ bearing: snapBearing, tilt: snapTilt, latitude, longitude, photoUri, solarResult, obstruction });
      setFirstSkyPct(obstruction.skyPercentage);
      setLoadingStage(null);
      setShowBorderlinePrompt(true);
      return;
    }

    // Average with first photo if this is the second
    const finalSkyPct = previousSkyPct !== undefined
      ? averageSkyPercentages(previousSkyPct, obstruction.skyPercentage)
      : obstruction.skyPercentage;

    const finalObstruction = { ...obstruction, skyPercentage: finalSkyPct, obstructionPercentage: 100 - finalSkyPct };
    const { adjustedScore, adjustedVerdict } = applyObstructionPenalty(
      solarResult.annualDaylightPercentage,
      finalSkyPct,
    );

    setLoadingStage(null);
    navigation.navigate('Results', {
      result: solarResult,
      bearing: snapBearing,
      tilt: snapTilt,
      latitude,
      longitude,
      photoUri,
      obstruction: finalObstruction,
      adjustedScore,
      adjustedVerdict,
    });
  }, [navigation]);

  // ── Assess button handler ────────────────────────────────────────────────────

  const handleAssess = useCallback(async () => {
    setLoadingStage('Taking photo…');
    setErrorMessage(null);

    try {
      let photoUri: string | undefined;
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
        photoUri = photo?.uri;
      }
      if (!photoUri) throw new Error('Failed to capture photo.');

      const snapBearing = bearing;
      const snapTilt = tilt;

      await runAnalysis(photoUri, snapBearing, snapTilt);
    } catch (err) {
      setLoadingStage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }, [bearing, tilt, runAnalysis]);

  // ── Borderline: user takes a second photo ────────────────────────────────────

  const handleSecondPhoto = useCallback(async () => {
    setShowBorderlinePrompt(false);
    setLoadingStage('Taking second photo…');
    setErrorMessage(null);

    try {
      let photoUri: string | undefined;
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
        photoUri = photo?.uri;
      }
      if (!photoUri || firstSkyPct === null) throw new Error('Failed to capture photo.');

      await runAnalysis(photoUri, bearing, tilt, firstSkyPct);
    } catch (err) {
      setLoadingStage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }, [bearing, tilt, firstSkyPct, runAnalysis]);

  // ── Borderline: user skips second photo ─────────────────────────────────────

  const handleUseFirstResult = useCallback(() => {
    if (!pendingData) return;
    setShowBorderlinePrompt(false);
    const { adjustedScore, adjustedVerdict } = applyObstructionPenalty(
      pendingData.solarResult.annualDaylightPercentage,
      pendingData.obstruction.skyPercentage,
    );
    navigation.navigate('Results', {
      result: pendingData.solarResult,
      bearing: pendingData.bearing,
      tilt: pendingData.tilt,
      latitude: pendingData.latitude,
      longitude: pendingData.longitude,
      photoUri: pendingData.photoUri,
      obstruction: pendingData.obstruction,
      adjustedScore,
      adjustedVerdict,
    });
  }, [pendingData, navigation]);

  // ── Render: permission gates ─────────────────────────────────────────────────

  if (!cameraPermission) {
    return <View style={s.centred}><ActivityIndicator color="#f59e0b" /></View>;
  }
  if (!cameraPermission.granted) {
    return (
      <View style={s.centred}>
        <Text style={s.permText}>Camera access is required to assess solar potential.</Text>
        <TouchableOpacity style={s.btn} onPress={requestCameraPermission}>
          <Text style={s.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!locationGranted) {
    return (
      <View style={s.centred}>
        <Text style={s.permText}>Location access is required to calculate the sun's position.</Text>
      </View>
    );
  }

  const isLoading = loadingStage !== null;

  // ── Render: main screen ──────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <CameraView ref={cameraRef} style={s.camera} facing="back">

        {/* Instruction banner */}
        <View style={s.instructionBanner}>
          <Text style={s.instructionText}>
            Point at the sky in the direction your panel will face,
            tilted to match the panel angle, then tap Assess.
          </Text>
        </View>

        {/* Crosshair */}
        <View style={s.crosshairContainer} pointerEvents="none">
          <View style={s.crosshairH} />
          <View style={s.crosshairV} />
        </View>

        {/* Sensor readings */}
        <View style={s.readingsContainer}>
          <View style={s.readingBox}>
            <Text style={s.readingLabel}>FACING</Text>
            <Text style={s.readingValue}>{bearing}°</Text>
            <Text style={s.readingUnit}>{bearingToLabel(bearing)}</Text>
          </View>
          <View style={s.readingDivider} />
          <View style={s.readingBox}>
            <Text style={s.readingLabel}>TILT</Text>
            <Text style={s.readingValue}>{tilt}°</Text>
            <Text style={s.readingUnit}>from vertical</Text>
          </View>
        </View>

        {/* Error */}
        {errorMessage && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={s.loadingText}>{loadingStage}</Text>
          </View>
        )}

        {/* Assess button */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.assessBtn, isLoading && s.assessBtnDisabled]}
            onPress={handleAssess}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.assessBtnText}>Assess</Text>
            }
          </TouchableOpacity>
        </View>

      </CameraView>

      {/* Borderline prompt modal */}
      <Modal visible={showBorderlinePrompt} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Borderline Result</Text>
            <Text style={s.modalBody}>
              The view appears to be roughly half-obstructed. Taking a second photo from
              a slightly different angle will give a more accurate result.
            </Text>
            <TouchableOpacity style={s.modalPrimaryBtn} onPress={handleSecondPhoto}>
              <Text style={s.modalPrimaryBtnText}>Take Another Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} onPress={handleUseFirstResult}>
              <Text style={s.modalSecondaryBtnText}>Use This Result</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#111' },
  permText: { color: '#fff', textAlign: 'center', marginBottom: 24, fontSize: 16, lineHeight: 24 },
  btn: { backgroundColor: '#f59e0b', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  instructionBanner: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20, paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  instructionText: { color: '#fff', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  crosshairContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  crosshairH: { position: 'absolute', width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  crosshairV: { position: 'absolute', width: 1, height: 60, backgroundColor: 'rgba(255,255,255,0.7)' },

  readingsContainer: {
    position: 'absolute', bottom: 120, left: 24, right: 24,
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'space-around',
  },
  readingBox: { alignItems: 'center', flex: 1 },
  readingLabel: { color: '#f59e0b', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  readingValue: { color: '#fff', fontSize: 32, fontWeight: '700' },
  readingUnit: { color: '#aaa', fontSize: 12, marginTop: 2 },
  readingDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },

  errorBanner: { backgroundColor: 'rgba(220,38,38,0.85)', margin: 16, padding: 12, borderRadius: 8 },
  errorText: { color: '#fff', textAlign: 'center', fontSize: 14 },

  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  loadingText: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16, paddingHorizontal: 32,
    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  assessBtn: { backgroundColor: '#f59e0b', paddingVertical: 16, paddingHorizontal: 64, borderRadius: 50, minWidth: 160, alignItems: 'center' },
  assessBtnDisabled: { backgroundColor: '#92400e' },
  assessBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Borderline modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalBody: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 24 },
  modalPrimaryBtn: { backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginBottom: 12 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  modalSecondaryBtnText: { color: '#6b7280', fontSize: 15 },
});

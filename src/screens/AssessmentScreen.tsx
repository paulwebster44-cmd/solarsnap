/**
 * AssessmentScreen
 *
 * The user stands at their proposed installation spot, holds their phone up
 * toward the sky in the orientation the panel would be mounted, and taps Assess.
 *
 * The screen reads:
 *   - Camera: live viewfinder so the user can see what the panel would face
 *   - GPS: location for solar position calculation
 *   - Compass heading: the panel's facing direction (azimuth)
 *   - Accelerometer: panel tilt angle (captured for future use)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { useNavigation } from '@react-navigation/native';
import { assessSuitability } from '../services/solar/solarSuitability';
import { AssessmentScreenNavProp } from '../types/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a compass bearing in degrees to a cardinal/intercardinal label. */
function bearingToLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return dirs[index];
}

/**
 * Calculates the panel tilt from the accelerometer gravity vector.
 *
 * When the user holds the phone in portrait mode pointing at the sky:
 *   - y-axis runs along the phone's long axis (positive toward top of phone)
 *   - z-axis is perpendicular to the screen (positive toward the user's face)
 *
 * Returns degrees from vertical: 0° = phone held upright (wall-mounted panel),
 * 90° = phone held horizontal pointing at sky (flat roof panel).
 *
 * NOTE: This is an approximation that works well in portrait mode. Future
 * milestones can refine this using DeviceMotion for more precise tilt.
 */
function calcTilt(x: number, y: number, z: number): number {
  // atan2(|z|, |y|) gives the angle from the y-axis (vertical when phone is upright)
  // As the phone tilts back (camera toward sky), z increases and y decreases.
  const tiltRad = Math.atan2(Math.abs(z), Math.abs(y));
  const tiltDeg = tiltRad * (180 / Math.PI);
  // Clamp to 0–90° for display
  return Math.min(90, Math.max(0, Math.round(tiltDeg)));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssessmentScreen() {
  const navigation = useNavigation<AssessmentScreenNavProp>();
  const cameraRef = useRef<CameraView>(null);

  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState(false);

  // Live sensor readings
  const [bearing, setBearing] = useState<number>(0);
  const [tilt, setTilt] = useState<number>(0);

  // UI state
  const [isAssessing, setIsAssessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Permissions ─────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    })();
  }, []);

  // ── Compass heading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let headingSub: Location.LocationSubscription | null = null;

    (async () => {
      if (!locationGranted) return;

      headingSub = await Location.watchHeadingAsync((heading) => {
        // Use true heading (corrected for magnetic declination) when available,
        // falling back to magnetic heading if GPS accuracy is low.
        const h = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
        setBearing(Math.round(h));
      });
    })();

    return () => {
      headingSub?.remove();
    };
  }, [locationGranted]);

  // ── Accelerometer (tilt) ─────────────────────────────────────────────────────

  useEffect(() => {
    Accelerometer.setUpdateInterval(200); // 5 Hz is plenty for tilt display

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      setTilt(calcTilt(x, y, z));
    });

    return () => sub.remove();
  }, []);

  // ── Assess handler ───────────────────────────────────────────────────────────

  const handleAssess = useCallback(async () => {
    setIsAssessing(true);
    setErrorMessage(null);

    try {
      // 1. Get current GPS position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      // 2. Capture a photo of the sky for future image analysis (Milestone 3)
      let photoUri: string | undefined;
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        photoUri = photo?.uri;
      }

      // 3. Snapshot the current bearing and tilt readings
      const assessmentBearing = bearing;
      const assessmentTilt = tilt;

      // 4. Run the solar suitability calculation.
      //    This samples 17,520 time points and takes ~1–2 seconds on device.
      //    We use setTimeout(0) to ensure the loading overlay renders first.
      setTimeout(() => {
        const result = assessSuitability(latitude, longitude, assessmentBearing);

        navigation.navigate('Results', {
          result,
          bearing: assessmentBearing,
          tilt: assessmentTilt,
          latitude,
          longitude,
          photoUri,
        });

        setIsAssessing(false);
      }, 50);
    } catch (err) {
      setErrorMessage('Could not read your location. Please check GPS is enabled.');
      setIsAssessing(false);
    }
  }, [bearing, tilt, navigation]);

  // ── Render: permission gates ─────────────────────────────────────────────────

  if (!cameraPermission) {
    return <View style={styles.centred}><ActivityIndicator color="#f59e0b" /></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centred}>
        <Text style={styles.permText}>Camera access is required to assess solar potential.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestCameraPermission}>
          <Text style={styles.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!locationGranted) {
    return (
      <View style={styles.centred}>
        <Text style={styles.permText}>Location access is required to calculate the sun's position.</Text>
      </View>
    );
  }

  // ── Render: main screen ──────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Live camera viewfinder */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back">

        {/* Top instruction banner */}
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionText}>
            Point at the sky in the direction your panel will face,
            tilted to match the panel angle, then tap Assess.
          </Text>
        </View>

        {/* Crosshair overlay */}
        <View style={styles.crosshairContainer} pointerEvents="none">
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
        </View>

        {/* Sensor readings overlay */}
        <View style={styles.readingsContainer}>
          <View style={styles.readingBox}>
            <Text style={styles.readingLabel}>FACING</Text>
            <Text style={styles.readingValue}>{bearing}°</Text>
            <Text style={styles.readingUnit}>{bearingToLabel(bearing)}</Text>
          </View>
          <View style={styles.readingDivider} />
          <View style={styles.readingBox}>
            <Text style={styles.readingLabel}>TILT</Text>
            <Text style={styles.readingValue}>{tilt}°</Text>
            <Text style={styles.readingUnit}>from vertical</Text>
          </View>
        </View>

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Assess button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.assessBtn, isAssessing && styles.assessBtnDisabled]}
            onPress={handleAssess}
            disabled={isAssessing}
          >
            {isAssessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.assessBtnText}>Assess</Text>
            )}
          </TouchableOpacity>
        </View>

      </CameraView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#111',
  },
  permText: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  btn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Instruction banner
  instructionBanner: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Crosshair
  crosshairContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  // Sensor readings
  readingsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  readingBox: {
    alignItems: 'center',
    flex: 1,
  },
  readingLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  readingValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  readingUnit: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  readingDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },

  // Error
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.85)',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },

  // Assess button
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  assessBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 50,
    minWidth: 160,
    alignItems: 'center',
  },
  assessBtnDisabled: {
    backgroundColor: '#92400e',
  },
  assessBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

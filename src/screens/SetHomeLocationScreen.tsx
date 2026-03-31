import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<AppStackParamList, 'SetHomeLocation'>;

function buildLeafletHTML(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map').setView([${lat}, ${lon}], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
  var marker = L.marker([${lat}, ${lon}], { draggable: true }).addTo(map);
  function send(latlng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lon: latlng.lng }));
  }
  marker.on('dragend', function() { send(marker.getLatLng()); });
  map.on('click', function(e) { marker.setLatLng(e.latlng); send(e.latlng); });
</script></body></html>`;
}

export default function SetHomeLocationScreen() {
  const { t } = useTranslation();
  const { doSetHomeLocation } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [findingGPS, setFindingGPS] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);

  const getGPS = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return pos.coords;
  };

  const handleUseGPS = async () => {
    setLocationError(null);
    setFindingGPS(true);
    try {
      const coords = await getGPS();
      if (!coords) throw new Error('denied');
      const { latitude, longitude } = coords;
      setMapCenter({ lat: latitude, lon: longitude });
      setPicked({ lat: latitude, lon: longitude });
    } catch {
      setLocationError(t('homeLocation.locationError'));
    } finally {
      setFindingGPS(false);
    }
  };

  const handleSetOnMap = async () => {
    setLocationError(null);
    let center = mapCenter ?? { lat: 51.5, lon: -0.1 };
    if (!mapCenter) {
      try {
        const coords = await getGPS();
        if (coords) center = { lat: coords.latitude, lon: coords.longitude };
      } catch { /* fall back to London */ }
    }
    setMapCenter(center);
    if (!picked) setPicked(center);
    setShowMap(true);
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const { lat, lon } = JSON.parse(event.nativeEvent.data);
      setPicked({ lat, lon });
    } catch { /* ignore malformed */ }
  };

  const handleConfirm = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await doSetHomeLocation(picked.lat, picked.lon);
      navigation.navigate('Home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('homeLocation.title')}</Text>
        <Text style={s.instruction}>{t('homeLocation.instruction')}</Text>
      </View>

      {!showMap ? (
        <View style={s.buttonGroup}>
          <TouchableOpacity style={s.btn} onPress={handleUseGPS} disabled={findingGPS}>
            {findingGPS ? (
              <><ActivityIndicator color="#fff" /><Text style={[s.btnText, { marginLeft: 8 }]}>{t('homeLocation.findingLocation')}</Text></>
            ) : (
              <Text style={s.btnText}>{t('homeLocation.useGPS')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={handleSetOnMap}>
            <Text style={[s.btnText, s.btnTextOutline]}>{t('homeLocation.setOnMap')}</Text>
          </TouchableOpacity>

          {locationError && <Text style={s.errorText}>{locationError}</Text>}
        </View>
      ) : (
        <View style={s.mapContainer}>
          <Text style={s.mapInstruction}>{t('homeLocation.mapInstruction')}</Text>
          <WebView
            style={s.map}
            originWhitelist={['*']}
            source={{ html: buildLeafletHTML(mapCenter!.lat, mapCenter!.lon) }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
          />
        </View>
      )}

      {picked && (
        <View style={s.footer}>
          <Text style={s.coords}>
            {t('homeLocation.lat', { lat: picked.lat.toFixed(5) })}
            {'   '}
            {t('homeLocation.lon', { lon: picked.lon.toFixed(5) })}
          </Text>
          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{t('homeLocation.confirm')}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  instruction: { fontSize: 15, color: '#374151', lineHeight: 22 },

  buttonGroup: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  btn: {
    backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 50,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  btnOutline: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#f59e0b' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnTextOutline: { color: '#f59e0b' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginTop: 8 },

  mapContainer: { flex: 1 },
  mapInstruction: {
    paddingHorizontal: 16, paddingVertical: 8,
    fontSize: 13, color: '#6b7280', textAlign: 'center',
  },
  map: { flex: 1 },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  coords: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  confirmBtn: {
    backgroundColor: '#f59e0b', paddingVertical: 16,
    borderRadius: 50, alignItems: 'center',
  },
});

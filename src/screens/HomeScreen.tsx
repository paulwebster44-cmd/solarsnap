import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HomeScreenNavProp } from '../types/navigation';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavProp>();

  return (
    <View style={styles.container}>

      {/* Logo / title area */}
      <View style={styles.hero}>
        <View style={styles.sunIcon}>
          <Text style={styles.sunEmoji}>☀️</Text>
        </View>
        <Text style={styles.title}>SolarSnap</Text>
        <Text style={styles.tagline}>Find out if your home is right{'\n'}for plug-in solar panels</Text>
      </View>

      {/* How it works */}
      <View style={styles.steps}>
        <Step number="1" text="Stand at your proposed installation spot" />
        <Step number="2" text="Point your phone at the sky in the direction and angle the panel would face" />
        <Step number="3" text="Tap Assess to get your suitability rating" />
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => navigation.navigate('Assessment')}
        >
          <Text style={styles.startBtnText}>Start Assessment</Text>
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
  hero: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
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
  sunEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f59e0b',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Steps
  steps: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
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
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },

  // Footer
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
  startBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

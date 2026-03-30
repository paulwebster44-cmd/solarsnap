/**
 * HomeScreen — placeholder for Milestone 1.
 * Camera integration and assessment UI will be added in later milestones.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SolarSnap</Text>
      <Text style={styles.subtitle}>Solar suitability assessment</Text>
      <Text style={styles.note}>Camera integration coming in Milestone 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 32,
  },
  note: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

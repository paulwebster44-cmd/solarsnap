import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { connectToStore, disconnectFromStore } from './src/services/iap/iapService';
import { loadSavedLanguage } from './src/services/language/languageService';
import { supabase } from './src/services/auth/supabaseClient';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AuthStackParamList, AppStackParamList } from './src/types/navigation';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import AssessmentScreen from './src/screens/AssessmentScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import SetHomeLocationScreen from './src/screens/SetHomeLocationScreen';
import AccountScreen from './src/screens/AccountScreen';
import PremiumResultsScreen from './src/screens/PremiumResultsScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppNavigator() {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!user) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
      </AuthStack.Navigator>
    );
  }

  // If logged in but no home location set, start at SetHomeLocation
  const needsHomeSetup = profile?.home_latitude == null;

  return (
    <AppStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={needsHomeSetup ? 'SetHomeLocation' : 'Home'}
    >
      <AppStack.Screen name="Home" component={HomeScreen} />
      <AppStack.Screen name="Assessment" component={AssessmentScreen} />
      <AppStack.Screen name="Results" component={ResultsScreen} />
      <AppStack.Screen name="PremiumResults" component={PremiumResultsScreen} />
      <AppStack.Screen name="SetHomeLocation" component={SetHomeLocationScreen} />
      <AppStack.Screen name="Account" component={AccountScreen} />
    </AppStack.Navigator>
  );
}

export default function App() {
  // Connect to the native IAP store once on startup so the purchase listener
  // is ready before the user ever taps an upgrade button.
  // Errors are swallowed — store unavailability should not block app launch.
  useEffect(() => {
    loadSavedLanguage().catch(console.warn);
    connectToStore().catch(console.warn);

    // Handle Supabase auth deep links (email verification, password reset)
    const handleUrl = async (url: string) => {
      await supabase.auth.exchangeCodeForSession(url).catch(console.warn);
    };

    // App opened via deep link
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    // Deep link received while app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      subscription.remove();
      disconnectFromStore().catch(console.warn);
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

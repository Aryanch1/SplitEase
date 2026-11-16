import { Fraunces_700Bold, Fraunces_900Black, useFonts } from '@expo-google-fonts/fraunces';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/lib/store';

/**
 * Sign-in gate: a signed-out user who hasn't chosen guest mode lands on
 * the Welcome screen first — the same ask every other app makes — and a
 * fresh sign-in routes straight back into the app.
 */
function Gate() {
  const { user, authReady, guest } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    const onWelcome = segments[0] === 'welcome';
    if (!user && !guest && !onWelcome) {
      router.replace('/welcome');
    } else if (user && onWelcome) {
      router.replace('/');
    }
  }, [user, guest, authReady, segments, router]);

  if (!authReady) {
    // Brief hold while Firebase restores any existing session.
    return <View style={{ flex: 1, backgroundColor: '#F6EEDD' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
      <Stack.Screen name="expense/[id]" />
      <Stack.Screen name="settle" />
      <Stack.Screen name="people" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="help" />
    </Stack>
  );
}

export default function RootLayout() {
  // Fraunces is the display face for headlines, titles and big numbers —
  // hold on the pale splash color until it is ready so no headline
  // ever flashes in the system font.
  const [fontsLoaded] = useFonts({ Fraunces_700Bold, Fraunces_900Black });
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#F6EEDD' }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Gate />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '../lib/theme';

/**
 * Aurora background: a soft cream-to-paper gradient with two slowly
 * drifting tinted blobs (coin gold and ledger ink). Pure decoration —
 * pointer-events disabled.
 */
export function AuroraBackground() {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000 }), -1, true);
  }, [drift]);
  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 24 },
      { translateY: drift.value * -18 },
    ],
  }));
  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * -20 },
      { translateY: drift.value * 26 },
    ],
  }));
  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={[...palette.aurora]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.blobA, blobA]} />
      <Animated.View style={[styles.blobB, blobB]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  blobA: {
    backgroundColor: 'rgba(201, 138, 27, 0.13)',
    borderRadius: 200,
    height: 340,
    position: 'absolute',
    right: -80,
    top: -60,
    width: 340,
  },
  blobB: {
    backgroundColor: 'rgba(22, 35, 58, 0.10)',
    borderRadius: 220,
    height: 380,
    left: -120,
    position: 'absolute',
    top: '38%',
    width: 380,
  },
});

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { palette } from '../lib/theme';

/**
 * SplitEase's custom pull-to-refresh: coins dropping into a jar.
 *
 * The pull is scrubbed by finger distance — coins drop into the jar one
 * by one as the user pulls down past the top; past the threshold,
 * releasing plays the coin bounce loop while data returns, then the
 * content settles with a spring. Never the stock spinner. On web, where
 * native pull-to-refresh doesn't exist, the same animation is wired to
 * the header refresh button (see the `CoinButton` export).
 */

const THRESHOLD = 90;

function Coin({
  fill,
  refreshing,
  index,
  left,
}: {
  fill: SharedValue<number>;
  refreshing: boolean;
  index: number;
  left: number;
}) {
  const loop = useSharedValue(0);
  useEffect(() => {
    if (refreshing) {
      loop.value = withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })),
        -1,
        false,
      );
    } else {
      loop.value = withTiming(0, { duration: 300 });
    }
  }, [refreshing, loop]);
  const animated = useAnimatedStyle(() => {
    const start = index / 3;
    const progress = Math.min(1, Math.max(0, (fill.value - start) / (1 / 3)));
    const bounce = refreshing ? -4 + loop.value * 8 : 0;
    return {
      opacity: refreshing ? 1 : progress,
      transform: [{ translateY: (1 - progress) * -34 + bounce }],
      left,
    };
  });
  return (
    <Animated.View style={[styles.coin, animated]}>
      <View style={styles.coinMark} />
    </Animated.View>
  );
}

function CoinVisual({
  fill,
  refreshing,
}: {
  /** 0–1 fill level while pulling; ignored while `refreshing` loops. */
  fill: SharedValue<number>;
  refreshing: boolean;
}) {
  return (
    <View style={styles.jarWrap}>
      <View style={styles.jar}>
        <Coin fill={fill} refreshing={refreshing} index={0} left={14} />
        <Coin fill={fill} refreshing={refreshing} index={1} left={38} />
        <Coin fill={fill} refreshing={refreshing} index={2} left={62} />
      </View>
    </View>
  );
}

/** The header refresh visual on web — same coins, same loop. Wrap it
 *  in the parent's own pressable; this component is visual only. */
export function CoinButton({ refreshing }: { refreshing: boolean }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withSpring(refreshing ? 1 : 0, { damping: 14, stiffness: 200 });
  }, [refreshing, fill]);
  return <CoinVisual fill={fill} refreshing={refreshing} />;
}

export function PullToRefresh({
  refreshing,
  onRefresh,
  children,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  // 0–1 pull progress; the coins read it directly.
  const pull = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      pull.value = Math.min(1, Math.max(0, -event.contentOffset.y / THRESHOLD));
    },
    onEndDrag: (event) => {
      if (event.contentOffset.y < -THRESHOLD) {
        runOnJS(onRefresh)();
      }
    },
  });

  const indicatorStyle = useAnimatedStyle(() => ({
    height: refreshing ? 72 : pull.value * 72,
    opacity: refreshing || pull.value > 0.08 ? 1 : 0,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.indicator, indicatorStyle]}>
        <CoinVisual fill={pull} refreshing={refreshing} />
      </Animated.View>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: { paddingBottom: 140 },
  jarWrap: { alignItems: 'center', justifyContent: 'center' },
  jar: {
    backgroundColor: 'rgba(233, 180, 76, 0.14)',
    borderColor: palette.accent,
    borderRadius: 14,
    borderWidth: 2,
    height: 48,
    overflow: 'hidden',
    position: 'relative',
    width: 110,
  },
  coin: {
    alignItems: 'center',
    backgroundColor: palette.accentLight,
    borderColor: palette.accent,
    borderRadius: 13,
    borderWidth: 2,
    bottom: 6,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    width: 26,
  },
  coinMark: {
    backgroundColor: palette.accent,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});

import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '../components/AuroraBackground';
import { GhostButton, GlassCard, IconButton, SectionHeader } from '../components/ui';
import { palette, spacing, type, useResponsive } from '../lib/theme';

/** Help & about — how splitting works, receipt AI, privacy. */
export default function HelpScreen() {
  const router = useRouter();
  const r = useResponsive();

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { maxWidth: r.contentMaxWidth, alignSelf: 'center' }]}
      >
        <View style={styles.header}>
          <IconButton label="←" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Help</Text>
          <View style={styles.headerSpacer} />
        </View>

        <SectionHeader kicker="How it works" title="Splitting, in four steps" />
        <GlassCard style={styles.card}>
          <Text style={styles.step}>1 · Make a group</Text>
          <Text style={styles.body}>
            One group per trip, household or dinner — roommates, travel buddies, family.
            Everyone in the group shares the same ledger.
          </Text>
          <Text style={styles.step}>2 · Log who paid</Text>
          <Text style={styles.body}>
            Add an expense with what it was, how much, and who paid. Split it equally,
            or set custom shares when someone only had a starter.
          </Text>
          <Text style={styles.step}>3 · See who owes whom</Text>
          <Text style={styles.body}>
            The ledger shows each person&apos;s net balance — green when the group owes
            them, terracotta when they owe the group.
          </Text>
          <Text style={styles.step}>4 · Settle up in the fewest payments</Text>
          <Text style={styles.body}>
            SplitEase works out the smallest set of payments that clears everyone.
            Tap Record after the money actually moves.
          </Text>
        </GlassCard>

        <SectionHeader kicker="Receipt AI" title="Snap a receipt" />
        <GlassCard style={styles.card}>
          <Text style={styles.body}>
            Photograph the bill or paste its text and AI reads the items and the total,
            then fills the expense form in for you. When the live service is not
            connected, the app reads pasted receipt text on-device instead and says
            so — a photo alone cannot be read until the service is live.
          </Text>
        </GlassCard>

        <SectionHeader kicker="Equal vs custom" title="Two ways to split" />
        <GlassCard style={styles.card}>
          <Text style={styles.body}>
            Equal splits divide the total evenly (leftover cents go to the first people
            listed, so the shares always add up exactly). Custom splits let you type
            each person&apos;s amount — the form checks that they add up to the total
            before saving.
          </Text>
        </GlassCard>

        <SectionHeader kicker="Your data" title="Privacy" />
        <GlassCard style={styles.card}>
          <Text style={styles.body}>
            Groups, expenses and history live on your device, and sync to your account
            when you sign in. Nothing is shared with anyone else, and SplitEase never
            moves money — it only tracks who owes whom. The sample Weekend Trip is
            demo data; clear it from People &amp; groups when you are ready.
          </Text>
        </GlassCard>

        <SectionHeader kicker="About" title="SplitEase" />
        <GlassCard style={styles.card}>
          <Text style={styles.body}>
            SplitEase is a shared-expense splitter for roommates, trips and group
            dinners — built by Aryanmouli Cherupalli. Designed in Figma; React Native
            + Expo + TypeScript, Gemini AI for receipt reading (Python serverless),
            Firebase for accounts and sync.
          </Text>
        </GlassCard>

        <GhostButton label="Back to the ledger" onPress={() => router.replace('/')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  headerTitle: { ...type.title, color: palette.ink, flex: 1 },
  headerSpacer: { width: 44 },
  card: { gap: 10, marginBottom: spacing.xl, padding: spacing.md },
  step: { ...type.subtitle, color: palette.ink },
  body: { ...type.body, color: palette.body },
});

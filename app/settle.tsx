import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuroraBackground } from '../components/AuroraBackground';
import {
  Chip,
  EmptyState,
  GhostButton,
  GlassCard,
  GoldButton,
  IconButton,
  MemberAvatar,
  SectionHeader,
} from '../components/ui';
import { formatMoney } from '../lib/split';
import { useApp } from '../lib/store';
import { palette, radii, spacing, type, useResponsive } from '../lib/theme';

/**
 * Settle up — the fewest-payments plan for the group, one-tap recording
 * of each payment, a manual payment form, and the history of payments
 * already recorded.
 */
export default function SettleScreen() {
  const router = useRouter();
  const {
    activeGroup,
    balances,
    transfers,
    groupSettlements,
    addSettlement,
    memberName,
  } = useApp();
  const r = useResponsive();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3500);
  };

  const record = (from: string, to: string, cents: number, note?: string) => {
    const s = addSettlement(from, to, cents, note ?? 'Settle-up payment');
    if (s) {
      flash(
        `Recorded ${formatMoney(cents)} from ${memberName(activeGroup!, from)} to ${memberName(activeGroup!, to)} ✓`,
      );
    }
  };

  const recordManual = () => {
    setError(null);
    if (!activeGroup) return;
    if (!fromId || !toId) {
      setError('Pick who paid and who received it.');
      return;
    }
    if (fromId === toId) {
      setError('The payer and the receiver must be different people.');
      return;
    }
    const cents = Math.round(Number.parseFloat(amount.replace(/[^0-9.]/g, '')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Enter an amount greater than $0.00.');
      return;
    }
    record(fromId, toId, cents, 'Manual payment');
    setAmount('');
  };

  if (!activeGroup) {
    return (
      <View style={styles.root}>
        <AuroraBackground />
        <View style={[styles.shell, { maxWidth: r.contentMaxWidth, paddingHorizontal: r.pad }]}>
          <EmptyState
            glyph="🪙"
            title="No group yet"
            body="Create a group first, then settle up here."
            actionLabel="Create a group"
            onAction={() => router.push('/people')}
          />
        </View>
      </View>
    );
  }

  const group = activeGroup;
  const settled = transfers.length === 0;

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { maxWidth: r.contentMaxWidth, alignSelf: 'center' }]}
      >
        <View style={styles.header}>
          <IconButton label="←" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Settle up</Text>
          <View style={styles.headerSpacer} />
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Animated.View entering={FadeInDown.springify()}>
          <SectionHeader
            kicker={`${group.emoji} ${group.name}`}
            title={settled ? 'Everyone is settled' : `${transfers.length} payment${transfers.length === 1 ? '' : 's'} clears it`}
          />
          {settled ? (
            <EmptyState
              glyph="✅"
              title="Nothing to settle"
              body="No one owes anyone anything in this group right now."
              actionLabel="Back to the ledger"
              onAction={() => router.replace('/')}
            />
          ) : (
            <View style={styles.transferList}>
              {transfers.map((t) => (
                <GlassCard key={`${t.fromId}-${t.toId}`} style={styles.transferCard}>
                  <View style={styles.transferRow}>
                    <MemberAvatar
                      member={{ name: memberName(group, t.fromId) }}
                      index={group.members.findIndex((m) => m.id === t.fromId)}
                      size={44}
                    />
                    <View style={styles.transferText}>
                      <Text style={styles.transferLine}>
                        <Text style={styles.transferName}>{memberName(group, t.fromId)}</Text>
                        {'  →  '}
                        <Text style={styles.transferName}>{memberName(group, t.toId)}</Text>
                      </Text>
                      <Text style={styles.transferAmount}>{formatMoney(t.cents)}</Text>
                    </View>
                    <GoldButton
                      label="Record"
                      onPress={() => record(t.fromId, t.toId, t.cents)}
                    />
                  </View>
                  <Text style={styles.transferHint}>
                    Tap Record after the money actually moves — SplitEase only tracks it.
                  </Text>
                </GlassCard>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).springify()}>
          <SectionHeader kicker="Net balances" title="Where everyone stands" />
          <GlassCard style={styles.card}>
            {group.members.map((m, i) => {
              const balance = balances.get(m.id) ?? 0;
              return (
                <View key={m.id} style={styles.balanceRow}>
                  <MemberAvatar member={m} index={i} size={40} />
                  <Text style={styles.balanceName}>{m.you ? 'You' : m.name}</Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      balance > 0 ? styles.balanceOwed : balance < 0 ? styles.balanceOwe : styles.balanceEven,
                    ]}
                  >
                    {balance > 0
                      ? `+${formatMoney(balance)}`
                      : balance < 0
                        ? `-${formatMoney(-balance)}`
                        : '$0.00'}
                  </Text>
                </View>
              );
            })}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <SectionHeader kicker="Manual" title="Record a payment" />
          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>FROM</Text>
            <View style={styles.chips}>
              {group.members.map((m) => (
                <Chip key={m.id} label={m.you ? 'You' : m.name} selected={fromId === m.id} onPress={() => setFromId(m.id)} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>TO</Text>
            <View style={styles.chips}>
              {group.members.map((m) => (
                <Chip key={m.id} label={m.you ? 'You' : m.name} selected={toId === m.id} onPress={() => setToId(m.id)} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={palette.muted}
              keyboardType="decimal-pad"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GoldButton label="Record payment" onPress={recordManual} />
          </GlassCard>
        </Animated.View>

        {groupSettlements.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <SectionHeader kicker="History" title="Payments recorded" />
            <GlassCard style={styles.card}>
              {groupSettlements.map((s) => (
                <View key={s.id} style={styles.settlementRow}>
                  <Text style={styles.settlementText}>
                    {memberName(group, s.fromId)} → {memberName(group, s.toId)}
                  </Text>
                  <Text style={styles.settlementAmount}>{formatMoney(s.cents)}</Text>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
        ) : null}

        <GhostButton label="Back to the ledger" onPress={() => router.replace('/')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, width: '100%' },
  shell: { flex: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  headerTitle: { ...type.title, color: palette.ink, flex: 1 },
  headerSpacer: { width: 44 },
  notice: {
    ...type.bodyStrong,
    backgroundColor: palette.owedSoft,
    borderRadius: radii.pill,
    color: palette.owed,
    marginBottom: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: 'center',
  },
  transferList: { gap: 12, marginBottom: spacing.lg },
  transferCard: { padding: spacing.md },
  transferRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  transferText: { flex: 1 },
  transferLine: { color: palette.ink, fontSize: 16 },
  transferName: { fontWeight: '800' },
  transferAmount: { ...type.subtitle, color: palette.accent, marginTop: 2 },
  transferHint: { ...type.caption, color: palette.muted, marginTop: spacing.sm },
  card: { gap: 12, marginBottom: spacing.xl, padding: spacing.md },
  balanceRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  balanceName: { ...type.subtitle, color: palette.ink, flex: 1 },
  balanceValue: { ...type.subtitle },
  balanceOwed: { color: palette.owed },
  balanceOwe: { color: palette.owe },
  balanceEven: { color: palette.muted },
  fieldLabel: { ...type.label, color: palette.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: palette.primaryPale,
    borderRadius: radii.input,
    color: palette.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  error: { ...type.bodyStrong, color: palette.error, textAlign: 'center' },
  settlementRow: { flexDirection: 'row', justifyContent: 'space-between' },
  settlementText: { ...type.body, color: palette.body },
  settlementAmount: { ...type.bodyStrong, color: palette.ink },
});

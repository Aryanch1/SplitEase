import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuroraBackground } from '../../components/AuroraBackground';
import {
  DemoBadge,
  EmptyState,
  GhostButton,
  GlassCard,
  IconButton,
  LiveBadge,
  MemberAvatar,
  PrimaryButton,
  SectionHeader,
} from '../../components/ui';
import { formatMoney, memberById } from '../../lib/split';
import { useApp } from '../../lib/store';
import { palette, radii, spacing, type, useResponsive } from '../../lib/theme';
import { CATEGORY_GLYPHS, CATEGORY_LABELS } from '../../lib/types';

/**
 * Expense detail — the full ledger line: big amount, who paid, each
 * person's share, the scanned receipt items when there are any, and
 * edit / delete / use-again actions.
 */
export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    expenseById,
    activeGroup,
    updateExpense,
    deleteExpense,
    applyHistory,
  } = useApp();
  const r = useResponsive();
  const expense = id ? expenseById(id) : undefined;
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!expense || !activeGroup) {
    return (
      <View style={styles.root}>
        <AuroraBackground />
        <View style={[styles.shell, { maxWidth: r.contentMaxWidth, paddingHorizontal: r.pad }]}>
          <EmptyState
            glyph="🧾"
            title="Expense not found"
            body="It may have been deleted."
            actionLabel="Back to the ledger"
            onAction={() => router.replace('/')}
          />
        </View>
      </View>
    );
  }

  const group = activeGroup;
  const payer = memberById(group, expense.payerId);

  const startEdit = () => {
    setEditDesc(expense.description);
    setEditAmount((expense.cents / 100).toFixed(2));
    setEditing(true);
  };

  const saveEdit = () => {
    const cents = Math.round(Number.parseFloat(editAmount.replace(/[^0-9.]/g, '')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setNotice('Enter an amount greater than $0.00.');
      return;
    }
    updateExpense(expense.id, { description: editDesc, cents });
    setEditing(false);
    setNotice('Expense updated ✓');
  };

  const doDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteExpense(expense.id);
    router.replace('/');
  };

  const useAgain = () => {
    const created = applyHistory({
      id: `h-${expense.id}`,
      description: expense.description,
      cents: expense.cents,
      category: expense.category,
      payerId: expense.payerId,
      at: expense.at,
    });
    if (created) router.replace(`/expense/${created.id}`);
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { maxWidth: r.contentMaxWidth, alignSelf: 'center' }]}
      >
        <View style={styles.header}>
          <IconButton label="←" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Expense</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Animated.View entering={FadeInDown.springify()}>
          <View style={styles.amountCard}>
            <Text style={styles.kicker}>
              {CATEGORY_GLYPHS[expense.category]} {CATEGORY_LABELS[expense.category].toUpperCase()} ·{' '}
              {expense.date}
            </Text>
            <Text style={styles.amount}>{formatMoney(expense.cents)}</Text>
            <Text style={styles.description}>{expense.description}</Text>
            <Text style={styles.paidBy}>
              Paid by {payer?.you ? 'you' : payer?.name ?? 'someone'}
              {expense.merchant ? ` · ${expense.merchant}` : ''}
            </Text>
            {expense.receiptSource ? (
              <View style={styles.badgeRow}>
                {expense.receiptSource === 'live' ? <LiveBadge /> : <DemoBadge />}
                <Text style={styles.badgeNote}>
                  {expense.receiptSource === 'live'
                    ? 'Read by the live receipt service'
                    : 'Read on-device (demo)'}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {expense.receiptItems && expense.receiptItems.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <SectionHeader kicker="Receipt" title="Items" />
            <GlassCard style={styles.card}>
              {expense.receiptItems.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemAmount}>{formatMoney(item.cents)}</Text>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <SectionHeader kicker="Split" title="Who owes what" />
          <GlassCard style={styles.card}>
            {expense.shares.map((share) => {
              const member = memberById(group, share.memberId);
              if (!member) return null;
              const index = group.members.findIndex((m) => m.id === member.id);
              return (
                <View key={share.memberId} style={styles.shareRow}>
                  <MemberAvatar member={member} index={index} size={40} />
                  <View style={styles.shareText}>
                    <Text style={styles.shareName}>
                      {member.you ? 'You' : member.name}
                      {share.memberId === expense.payerId ? (
                        <Text style={styles.paidTag}> · PAID</Text>
                      ) : null}
                    </Text>
                  </View>
                  <Text style={styles.shareAmount}>{formatMoney(share.cents)}</Text>
                </View>
              );
            })}
          </GlassCard>
        </Animated.View>

        {editing ? (
          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholderTextColor={palette.muted}
            />
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor={palette.muted}
              keyboardType="decimal-pad"
            />
            <PrimaryButton label="Save changes" onPress={saveEdit} />
            <GhostButton label="Cancel" onPress={() => setEditing(false)} />
          </GlassCard>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton label="Use again" onPress={useAgain} />
            <GhostButton label="Edit expense" onPress={startEdit} />
            <GhostButton
              label={confirmDelete ? 'Tap again to delete' : 'Delete expense'}
              onPress={doDelete}
            />
          </View>
        )}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
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
  amountCard: {
    backgroundColor: palette.primary,
    borderRadius: radii.card,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  kicker: { ...type.label, color: palette.accentLight, marginBottom: 8 },
  amount: { ...type.displayWide, color: '#FFFFFF', fontSize: 52, lineHeight: 56 },
  description: { ...type.title, color: '#FFFFFF', marginTop: 8 },
  paidBy: { color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 6 },
  badgeRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: spacing.md },
  badgeNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  card: { gap: 12, marginBottom: spacing.xl, padding: spacing.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { ...type.body, color: palette.body, flex: 1 },
  itemAmount: { ...type.bodyStrong, color: palette.ink },
  shareRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  shareText: { flex: 1 },
  shareName: { ...type.subtitle, color: palette.ink },
  paidTag: { color: palette.owed, fontSize: 12, fontWeight: '800' },
  shareAmount: { ...type.subtitle, color: palette.ink },
  fieldLabel: { ...type.label, color: palette.muted },
  input: {
    backgroundColor: palette.primaryPale,
    borderRadius: radii.input,
    color: palette.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  actions: { gap: 12 },
  notice: {
    ...type.bodyStrong,
    backgroundColor: palette.owedSoft,
    borderRadius: radii.pill,
    color: palette.owed,
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: 'center',
  },
});

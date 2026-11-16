import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuroraBackground } from '../components/AuroraBackground';
import { CoinButton, PullToRefresh } from '../components/CoinRefresh';
import {
  EmptyState,
  GhostButton,
  GoldButton,
  IconButton,
  MemberAvatar,
  PrimaryButton,
  SectionHeader,
  SpringPress,
} from '../components/ui';
import { useApp } from '../lib/store';
import { formatMoney } from '../lib/split';
import { palette, radii, spacing, type, useResponsive } from '../lib/theme';
import { CATEGORY_GLYPHS, type Expense } from '../lib/types';

type Tab = 'ledger' | 'activity' | 'people';

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(expenses: Expense[]): { date: string; items: Expense[] }[] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

/**
 * Ledger home — the app leads with the money, not a photo.
 * A typographic data hero (your net balance in big Fraunces numerals),
 * then a top segmented control (Ledger | Activity | People), then the
 * people balances with owe/owed pills and the expense timeline.
 * No photo hero, no frosted panel over a photo, no floating pill tab
 * bar — this screen must read as a money tool at a glance.
 */
export default function HomeScreen() {
  const router = useRouter();
  const {
    groups,
    activeGroup,
    groupExpenses,
    balances,
    transfers,
    youBalance,
    groupTotalCents,
    history,
    applyHistory,
    addSettlement,
    memberName,
    setActiveGroup,
    user,
    guest,
  } = useApp();
  const r = useResponsive();
  const [tab, setTab] = useState<Tab>('ledger');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3500);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRefreshing(false);
    flash('Balances are up to date ✓');
  };

  const recordTransfer = (fromId: string, toId: string, cents: number) => {
    const s = addSettlement(fromId, toId, cents, 'Settle-up payment');
    if (s) flash(`Recorded ${formatMoney(cents)} — balances updated ✓`);
  };

  const reuseHistory = (entryId: string) => {
    const entry = history.find((h) => h.id === entryId);
    if (!entry) return;
    const expense = applyHistory(entry);
    if (expense) {
      flash(`Added ${entry.description} · ${formatMoney(entry.cents)}`);
      router.push(`/expense/${expense.id}`);
    }
  };

  const yourShare = (e: Expense): number => {
    const you = activeGroup?.members.find((m) => m.you);
    return e.shares.find((s) => s.memberId === you?.id)?.cents ?? 0;
  };

  if (!activeGroup) {
    return (
      <View style={styles.root}>
        <AuroraBackground />
        <View style={[styles.shell, { maxWidth: r.contentMaxWidth, paddingHorizontal: r.pad }]}>
          <EmptyState
            glyph="🪙"
            title="No group yet"
            body="Create a group for your roommates, a trip, or a dinner — then log who paid for what."
            actionLabel="Create a group"
            onAction={() => router.push('/people')}
          />
        </View>
      </View>
    );
  }

  const balanceTitle =
    youBalance > 0 ? 'You are owed' : youBalance < 0 ? 'You owe' : 'All settled up';
  const balanceFigure = youBalance === 0 ? '$0.00' : formatMoney(Math.abs(youBalance));
  const balanceColor =
    youBalance > 0 ? '#7BD8A6' : youBalance < 0 ? '#FFB59E' : '#FFFFFF';

  const balanceCard = (
    <Animated.View entering={FadeInDown.springify()}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View>
            <Text style={styles.balanceKicker}>
              {activeGroup.emoji} {activeGroup.name.toUpperCase()} · {activeGroup.members.length}{' '}
              PEOPLE
            </Text>
            <Text style={styles.balanceTitle}>{balanceTitle}</Text>
            <Text style={[styles.balanceFigure, { color: balanceColor }]}>{balanceFigure}</Text>
          </View>
          <View style={styles.coinStackMini}>
            <View style={[styles.miniCoin, { top: 0 }]} />
            <View style={[styles.miniCoin, { top: 14 }]} />
            <View style={[styles.miniCoin, { top: 28 }]} />
          </View>
        </View>
        <View style={styles.balanceStats}>
          <Text style={styles.balanceStat}>
            Spent <Text style={styles.balanceStatStrong}>{formatMoney(groupTotalCents)}</Text>
          </Text>
          <Text style={styles.balanceStat}>
            <Text style={styles.balanceStatStrong}>{groupExpenses.length}</Text> expenses
          </Text>
          <Text style={styles.balanceStat}>
            <Text style={styles.balanceStatStrong}>{transfers.length}</Text> payment
            {transfers.length === 1 ? '' : 's'} to settle
          </Text>
        </View>
        <View style={styles.balanceActions}>
          <View style={styles.balanceActionFlex}>
            <GoldButton
              label="Settle up"
              onPress={() => router.push('/settle')}
              disabled={transfers.length === 0}
            />
          </View>
          <View style={styles.balanceActionFlex}>
            <GhostButton label="＋ Add expense" onPress={() => router.push('/add')} />
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const peopleRows = (
    <View style={styles.peopleList}>
      {activeGroup.members.map((m, i) => {
        const balance = balances.get(m.id) ?? 0;
        const pill =
          balance > 0
            ? { text: `owes you ${formatMoney(balance)}`, bg: palette.owedSoft, fg: palette.owed }
            : balance < 0
              ? { text: `you owe ${formatMoney(-balance)}`, bg: palette.oweSoft, fg: palette.owe }
              : { text: 'settled', bg: palette.primaryPale, fg: palette.muted };
        return (
          <SpringPress key={m.id} onPress={() => router.push('/settle')}>
            <View style={styles.personRow}>
              <MemberAvatar member={m} index={i} size={48} />
              <View style={styles.personText}>
                <Text style={styles.personName}>
                  {m.name}
                  {m.you ? <Text style={styles.youTag}> · YOU</Text> : null}
                </Text>
                <Text style={styles.personSub}>
                  {balance === 0
                    ? 'Nothing outstanding'
                    : balance > 0
                      ? 'They owe the group'
                      : 'They are owed by the group'}
                </Text>
              </View>
              <View style={[styles.balancePill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.balancePillText, { color: pill.fg }]}>{pill.text}</Text>
              </View>
            </View>
          </SpringPress>
        );
      })}
    </View>
  );

  const transferRows = (
    <View style={styles.transferList}>
      {transfers.map((t) => (
        <View key={`${t.fromId}-${t.toId}`} style={styles.transferRow}>
          <View style={styles.transferText}>
            <Text style={styles.transferLine}>
              <Text style={styles.transferName}>{memberName(activeGroup, t.fromId)}</Text>
              {' → '}
              <Text style={styles.transferName}>{memberName(activeGroup, t.toId)}</Text>
            </Text>
            <Text style={styles.transferAmount}>{formatMoney(t.cents)}</Text>
          </View>
          <GhostButton
            label="Record"
            onPress={() => recordTransfer(t.fromId, t.toId, t.cents)}
          />
        </View>
      ))}
    </View>
  );

  const activityList = (
    <View style={styles.activityList}>
      {groupByDate(groupExpenses).map(({ date, items }) => (
        <View key={date}>
          <Text style={styles.dateHeader}>{fmtDate(date)}</Text>
          {items.map((e, i) => (
            <Animated.View key={e.id} entering={FadeInDown.delay(i * 50).springify()}>
              <SpringPress onPress={() => router.push(`/expense/${e.id}`)}>
                <View style={styles.expenseRow}>
                  <View style={styles.glyphCircle}>
                    <Text style={styles.glyph}>{CATEGORY_GLYPHS[e.category]}</Text>
                  </View>
                  <View style={styles.expenseText}>
                    <Text style={styles.expenseDesc}>{e.description}</Text>
                    <Text style={styles.expenseSub}>
                      {memberName(activeGroup, e.payerId)} paid · your share{' '}
                      {formatMoney(yourShare(e))}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>{formatMoney(e.cents)}</Text>
                </View>
              </SpringPress>
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );

  const historyStrip = history.length > 0 && (
    <View>
      <SectionHeader kicker="History" title="Use again" />
      <View style={styles.historyChips}>
        {history.slice(0, 6).map((h) => (
          <SpringPress key={h.id} onPress={() => reuseHistory(h.id)}>
            <View style={styles.historyChip}>
              <Text style={styles.historyChipDesc}>{h.description}</Text>
              <Text style={styles.historyChipAmount}>{formatMoney(h.cents)}</Text>
            </View>
          </SpringPress>
        ))}
      </View>
    </View>
  );

  const ledgerTab = (
    <View style={styles.tabContent}>
      <SectionHeader kicker="Ledger" title="Who owes whom" />
      {peopleRows}
      {transfers.length > 0 ? (
        <View style={styles.settleBlock}>
          <SectionHeader kicker="Settle up" title={`${transfers.length} payment${transfers.length === 1 ? '' : 's'} clears it`} />
          {transferRows}
        </View>
      ) : (
        <EmptyState
          glyph="✅"
          title="Everyone is settled"
          body="No one owes anyone anything in this group right now."
        />
      )}
      {historyStrip}
    </View>
  );

  const activityTab = (
    <View style={styles.tabContent}>
      <SectionHeader kicker="Activity" title="Expense timeline" />
      {groupExpenses.length > 0 ? (
        activityList
      ) : (
        <EmptyState
          glyph="🧾"
          title="No expenses yet"
          body="Log the first one — dinner, a cab, groceries — and SplitEase will work out the shares."
          actionLabel="Add an expense"
          onAction={() => router.push('/add')}
        />
      )}
      {historyStrip}
    </View>
  );

  const peopleTab = (
    <View style={styles.tabContent}>
      <SectionHeader kicker="Groups" title="Your groups" />
      <View style={styles.groupChips}>
        {groups.map((g) => (
          <SpringPress key={g.id} onPress={() => setActiveGroup(g.id)}>
            <View
              style={[
                styles.groupChip,
                g.id === activeGroup.id && styles.groupChipActive,
              ]}
            >
              <Text style={styles.groupChipEmoji}>{g.emoji}</Text>
              <Text
                style={[
                  styles.groupChipName,
                  g.id === activeGroup.id && styles.groupChipNameActive,
                ]}
              >
                {g.name}
              </Text>
            </View>
          </SpringPress>
        ))}
      </View>
      <SectionHeader kicker="People" title={`In ${activeGroup.name}`} />
      {peopleRows}
      <View style={styles.manageRow}>
        <GhostButton label="Manage people & groups →" onPress={() => router.push('/people')} />
      </View>
      {historyStrip}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View>
        <Text style={styles.wordmark}>SplitEase</Text>
        <Text style={styles.headerSub}>
          {user ? `Hi, ${user.name ?? 'there'}` : guest ? 'Guest — balances stay on this device' : 'Your shared ledger'}
        </Text>
      </View>
      <View style={styles.headerActions}>
        {Platform.OS === 'web' ? (
          <SpringPress onPress={onRefresh} haptic>
            <View style={styles.coinButtonWrap}>
              <CoinButton refreshing={refreshing} />
            </View>
          </SpringPress>
        ) : null}
        <IconButton label="?" onPress={() => router.push('/help')} />
        <IconButton label="⚙" onPress={() => router.push('/settings')} />
      </View>
    </View>
  );

  const segmented = (
    <View style={styles.segmented}>
      {(['ledger', 'activity', 'people'] as Tab[]).map((t) => (
        <SpringPress key={t} onPress={() => setTab(t)}>
          <View style={[styles.segment, tab === t && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, tab === t && styles.segmentLabelActive]}>
              {t === 'ledger' ? 'Ledger' : t === 'activity' ? 'Activity' : 'People'}
            </Text>
          </View>
        </SpringPress>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        <View style={[styles.shell, { maxWidth: r.contentMaxWidth, paddingHorizontal: r.pad }]}>
          {header}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {r.twoPane ? (
            <View style={styles.twoPane}>
              <View style={styles.pane}>{balanceCard}{ledgerTab}</View>
              <View style={styles.pane}>{activityTab}</View>
            </View>
          ) : (
            <View>
              {balanceCard}
              {segmented}
              {tab === 'ledger' ? ledgerTab : tab === 'activity' ? activityTab : peopleTab}
            </View>
          )}
        </View>
      </PullToRefresh>
      <View style={[styles.bottomBar, { maxWidth: r.contentMaxWidth }]}>
        <PrimaryButton label="＋  Add expense" onPress={() => router.push('/add')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shell: { alignSelf: 'center', width: '100%' },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  wordmark: { ...type.display, color: palette.ink, fontSize: 34, lineHeight: 38 },
  headerSub: { ...type.caption, color: palette.muted, marginTop: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  coinButtonWrap: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 64,
  },
  notice: {
    ...type.bodyStrong,
    backgroundColor: palette.owedSoft,
    borderRadius: radii.pill,
    color: palette.owed,
    marginBottom: spacing.md,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: palette.primary,
    borderRadius: radii.card,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...{ shadowColor: '#0C1626', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 28, elevation: 8 },
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceKicker: { ...type.label, color: palette.accentLight, marginBottom: 6 },
  balanceTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 17, fontWeight: '700' },
  balanceFigure: { ...type.displayWide, color: '#FFFFFF', fontSize: 52, lineHeight: 56, marginTop: 4 },
  coinStackMini: { height: 70, position: 'relative', width: 52 },
  miniCoin: {
    backgroundColor: palette.accentLight,
    borderColor: palette.accent,
    borderRadius: 21,
    borderWidth: 2,
    height: 30,
    position: 'absolute',
    right: 0,
    width: 42,
  },
  balanceStats: {
    borderTopColor: 'rgba(255,255,255,0.16)',
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  balanceStat: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  balanceStatStrong: { color: '#FFFFFF', fontWeight: '800' },
  balanceActions: { flexDirection: 'row', gap: 12, marginTop: spacing.lg },
  balanceActionFlex: { flex: 1 },
  segmented: {
    backgroundColor: palette.primaryPale,
    borderRadius: radii.pill,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.pill,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  segmentActive: { backgroundColor: palette.primary },
  segmentLabel: { color: palette.body, fontSize: 15, fontWeight: '700' },
  segmentLabelActive: { color: '#FFFFFF' },
  tabContent: { gap: 0 },
  peopleList: { gap: 10, marginBottom: spacing.lg },
  personRow: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.line,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: spacing.md,
  },
  personText: { flex: 1 },
  personName: { ...type.subtitle, color: palette.ink },
  youTag: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  personSub: { ...type.caption, color: palette.muted, marginTop: 2 },
  balancePill: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 },
  balancePillText: { fontSize: 13, fontWeight: '800' },
  settleBlock: { marginBottom: spacing.lg },
  transferList: { gap: 10 },
  transferRow: {
    alignItems: 'center',
    backgroundColor: palette.accentSoft,
    borderColor: 'rgba(201,138,27,0.25)',
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: spacing.md,
  },
  transferText: { flex: 1 },
  transferLine: { color: palette.ink, fontSize: 15 },
  transferName: { fontWeight: '800' },
  transferAmount: { ...type.subtitle, color: palette.accent, marginTop: 2 },
  activityList: { marginBottom: spacing.lg },
  dateHeader: { ...type.label, color: palette.muted, marginBottom: 8, marginTop: spacing.md },
  expenseRow: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.line,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: spacing.md,
  },
  glyphCircle: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  glyph: { fontSize: 22 },
  expenseText: { flex: 1 },
  expenseDesc: { ...type.subtitle, color: palette.ink },
  expenseSub: { ...type.caption, color: palette.muted, marginTop: 2 },
  expenseAmount: { ...type.subtitle, color: palette.ink },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  historyChip: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyChipDesc: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  historyChipAmount: { color: palette.accent, fontSize: 14, fontWeight: '800' },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  groupChip: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  groupChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  groupChipEmoji: { fontSize: 18 },
  groupChipName: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  groupChipNameActive: { color: '#FFFFFF' },
  manageRow: { marginBottom: spacing.lg },
  twoPane: { flexDirection: 'row', gap: 24 },
  pane: { flex: 1 },
  bottomBar: {
    alignSelf: 'center',
    backgroundColor: 'rgba(251, 248, 240, 0.92)',
    borderTopColor: palette.line,
    borderTopWidth: 1,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    position: 'absolute',
    width: '100%',
  },
});

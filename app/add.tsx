import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuroraBackground } from '../components/AuroraBackground';
import {
  Chip,
  DemoBadge,
  GhostButton,
  GlassCard,
  IconButton,
  LiveBadge,
  PrimaryButton,
  SectionHeader,
  SpringPress,
} from '../components/ui';
import { scanReceipt } from '../lib/receipt';
import { formatMoney } from '../lib/split';
import { useApp } from '../lib/store';
import { palette, radii, spacing, type, useResponsive } from '../lib/theme';
import { CATEGORY_GLYPHS, CATEGORY_LABELS, type ExpenseCategory, type ReceiptScan } from '../lib/types';

const CATEGORIES: ExpenseCategory[] = ['food', 'stay', 'travel', 'fun', 'bills', 'shopping', 'other'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDollars(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * Add expense — description, amount, who paid, split (equal or custom
 * per-person amounts), category, date — plus the receipt reader: snap a
 * photo or paste the receipt text and AI fills in the items and total.
 */
export default function AddExpenseScreen() {
  const router = useRouter();
  const { activeGroup, addExpense } = useApp();
  const r = useResponsive();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(
    activeGroup?.members.find((m) => m.you)?.id ?? activeGroup?.members[0]?.id ?? '',
  );
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(todayIso());
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [receiptText, setReceiptText] = useState('');
  const [showReceiptText, setShowReceiptText] = useState(false);
  const [scan, setScan] = useState<ReceiptScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalCents = parseDollars(amount);
  const customSum = Object.values(customShares).reduce(
    (sum, v) => sum + parseDollars(v),
    0,
  );

  const runScan = async (request: { text?: string; imageBase64?: string }) => {
    setScanning(true);
    setScanError(null);
    try {
      const result = await scanReceipt(request);
      setScan(result);
    } catch (e) {
      setScan(null);
      setScanError(e instanceof Error ? e.message : 'Could not read that receipt.');
    } finally {
      setScanning(false);
    }
  };

  const scanPhoto = async () => {
    setScanError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const resized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG },
      );
      if (!resized.base64) {
        setScanError('Could not read that photo. Try again.');
        return;
      }
      await runScan({ imageBase64: resized.base64 });
    } catch {
      setScanError('Could not open the photo picker. Try again.');
    }
  };

  const useScan = () => {
    if (!scan) return;
    setAmount((scan.totalCents / 100).toFixed(2));
    if (scan.merchant) setDescription(scan.merchant);
    else if (scan.items[0]) setDescription(scan.items[0].name);
  };

  const submit = () => {
    setSubmitError(null);
    if (!activeGroup) {
      setSubmitError('Create a group first.');
      return;
    }
    if (totalCents <= 0) {
      setSubmitError('Type an amount greater than $0.00.');
      return;
    }
    if (splitMode === 'custom' && customSum !== totalCents) {
      setSubmitError(
        `Custom shares add up to ${formatMoney(customSum)} — they must equal ${formatMoney(totalCents)}.`,
      );
      return;
    }
    setBusy(true);
    const shareIds = activeGroup.members.map((m) => m.id);
    const expense = addExpense({
      groupId: activeGroup.id,
      description: description.trim() || scan?.merchant || 'Expense',
      cents: totalCents,
      payerId,
      shareMemberIds: shareIds,
      customShares:
        splitMode === 'custom'
          ? shareIds.map((id) => ({ memberId: id, cents: parseDollars(customShares[id] ?? '') }))
          : undefined,
      category,
      date: date || todayIso(),
      receiptSource: scan?.source,
      receiptItems: scan?.items,
      merchant: scan?.merchant ?? undefined,
    });
    router.replace(`/expense/${expense.id}`);
  };

  if (!activeGroup) {
    return (
      <View style={styles.root}>
        <AuroraBackground />
        <View style={[styles.shell, { maxWidth: r.contentMaxWidth, paddingHorizontal: r.pad }]}>
          <Text style={styles.emptyTitle}>No group yet</Text>
          <Text style={styles.emptyBody}>Create a group first, then log expenses in it.</Text>
          <GhostButton label="Go to People & groups" onPress={() => router.push('/people')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { maxWidth: r.contentMaxWidth, alignSelf: 'center' }]}
      >
        <View style={styles.header}>
          <IconButton label="←" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Add expense</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Animated.View entering={FadeInDown.springify()}>
          <SectionHeader kicker={activeGroup.emoji + ' ' + activeGroup.name} title="What was paid?" />
          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Dinner, cab, groceries…"
              placeholderTextColor={palette.muted}
            />
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={palette.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.fieldLabel}>WHO PAID?</Text>
            <View style={styles.chips}>
              {activeGroup.members.map((m) => (
                <Chip
                  key={m.id}
                  label={m.you ? 'You' : m.name}
                  selected={payerId === m.id}
                  onPress={() => setPayerId(m.id)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={`${CATEGORY_GLYPHS[c]} ${CATEGORY_LABELS[c]}`}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>DATE</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
            />
            <Text style={styles.fieldLabel}>SPLIT</Text>
            <View style={styles.chips}>
              <Chip label="Split equally" selected={splitMode === 'equal'} onPress={() => setSplitMode('equal')} />
              <Chip label="Custom shares" selected={splitMode === 'custom'} onPress={() => setSplitMode('custom')} />
            </View>
            {splitMode === 'custom' ? (
              <View style={styles.customList}>
                {activeGroup.members.map((m) => (
                  <View key={m.id} style={styles.customRow}>
                    <Text style={styles.customName}>{m.you ? 'You' : m.name}</Text>
                    <View style={styles.customAmountRow}>
                      <Text style={styles.dollarSmall}>$</Text>
                      <TextInput
                        style={styles.customInput}
                        value={customShares[m.id] ?? ''}
                        onChangeText={(v) =>
                          setCustomShares((prev) => ({ ...prev, [m.id]: v }))
                        }
                        placeholder="0.00"
                        placeholderTextColor={palette.muted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                ))}
                <Text
                  style={[
                    styles.customSum,
                    customSum === totalCents && totalCents > 0
                      ? styles.customSumOk
                      : styles.customSumBad,
                  ]}
                >
                  Shares total {formatMoney(customSum)}
                  {totalCents > 0 ? ` of ${formatMoney(totalCents)}` : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.splitHint}>
                Split equally between {activeGroup.members.length} people —{' '}
                {totalCents > 0
                  ? `${formatMoney(Math.floor(totalCents / activeGroup.members.length))} each`
                  : 'enter an amount to see shares'}
                .
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).springify()}>
          <SectionHeader kicker="Receipt AI" title="Snap a receipt" />
          <GlassCard style={styles.card}>
            <Text style={styles.receiptBody}>
              Photograph the bill or paste its text — AI reads the items and total, and
              fills the form in for you.
            </Text>
            <View style={styles.receiptActions}>
              <SpringPress onPress={() => void scanPhoto()}>
                <View style={styles.receiptPhotoButton}>
                  <Text style={styles.receiptPhotoLabel}>📷  Scan receipt photo</Text>
                </View>
              </SpringPress>
              <GhostButton
                label={showReceiptText ? 'Hide receipt text' : 'Paste receipt text'}
                onPress={() => setShowReceiptText((v) => !v)}
              />
            </View>
            {showReceiptText ? (
              <View>
                <TextInput
                  style={[styles.input, styles.receiptInput]}
                  value={receiptText}
                  onChangeText={setReceiptText}
                  placeholder={'Pasta $12.50\nSalad $8.00\nTOTAL $20.50'}
                  placeholderTextColor={palette.muted}
                  multiline
                />
                <PrimaryButton
                  label="Read this receipt"
                  onPress={() => void runScan({ text: receiptText })}
                  loading={scanning}
                  disabled={!receiptText.trim()}
                />
              </View>
            ) : null}
            {scanning ? (
              <Text style={styles.scanning}>Reading the receipt…</Text>
            ) : null}
            {scanError ? <Text style={styles.error}>{scanError}</Text> : null}
            {scan ? (
              <View style={styles.scanResult}>
                <View style={styles.scanHeader}>
                  <Text style={styles.scanTitle}>
                    {scan.merchant ?? 'Receipt'} · {formatMoney(scan.totalCents)}
                  </Text>
                  {scan.source === 'live' ? <LiveBadge /> : <DemoBadge />}
                </View>
                {scan.items.map((item, i) => (
                  <View key={`${item.name}-${i}`} style={styles.scanItem}>
                    <Text style={styles.scanItemName}>{item.name}</Text>
                    <Text style={styles.scanItemAmount}>{formatMoney(item.cents)}</Text>
                  </View>
                ))}
                <Text style={styles.scanNote}>
                  {scan.source === 'live'
                    ? 'Read by the live receipt service.'
                    : 'Read on-device from the pasted text (demo) — the live service is not connected yet.'}
                </Text>
                <PrimaryButton label="Use these details" onPress={useScan} />
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <View style={styles.submit}>
          <PrimaryButton
            label="Save expense"
            sub={totalCents > 0 ? formatMoney(totalCents) : undefined}
            onPress={submit}
            loading={busy}
          />
        </View>
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
  card: { gap: 12, marginBottom: spacing.xl, padding: spacing.md },
  fieldLabel: { ...type.label, color: palette.muted },
  input: {
    backgroundColor: palette.primaryPale,
    borderRadius: radii.input,
    color: palette.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  amountRow: {
    alignItems: 'center',
    backgroundColor: palette.primaryPale,
    borderRadius: radii.input,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 18,
  },
  dollar: { ...type.display, color: palette.primary, fontSize: 28, lineHeight: 32 },
  amountInput: { color: palette.ink, flex: 1, fontSize: 28, fontWeight: '800', marginLeft: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  splitHint: { ...type.body, color: palette.body },
  customList: { gap: 10 },
  customRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  customName: { ...type.subtitle, color: palette.ink },
  customAmountRow: {
    alignItems: 'center',
    backgroundColor: palette.primaryPale,
    borderRadius: radii.pill,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dollarSmall: { color: palette.primary, fontSize: 16, fontWeight: '800' },
  customInput: { color: palette.ink, fontSize: 16, fontWeight: '700', marginLeft: 4, minWidth: 70 },
  customSum: { ...type.bodyStrong, textAlign: 'right' },
  customSumOk: { color: palette.success },
  customSumBad: { color: palette.error },
  receiptBody: { ...type.body, color: palette.body },
  receiptActions: { gap: 12 },
  receiptPhotoButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 52,
  },
  receiptPhotoLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  receiptInput: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  scanning: { ...type.bodyStrong, color: palette.primary, textAlign: 'center' },
  scanResult: { gap: 8 },
  scanHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  scanTitle: { ...type.subtitle, color: palette.ink, flex: 1 },
  scanItem: { flexDirection: 'row', justifyContent: 'space-between' },
  scanItemName: { ...type.body, color: palette.body, flex: 1 },
  scanItemAmount: { ...type.bodyStrong, color: palette.ink },
  scanNote: { ...type.caption, color: palette.muted },
  error: { ...type.bodyStrong, color: palette.error, marginBottom: spacing.md, textAlign: 'center' },
  submit: { marginTop: spacing.md },
  emptyTitle: { ...type.title, color: palette.ink, marginBottom: spacing.sm },
  emptyBody: { ...type.body, color: palette.body, marginBottom: spacing.lg },
});

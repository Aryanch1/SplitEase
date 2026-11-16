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
  IconButton,
  MemberAvatar,
  PrimaryButton,
  SectionHeader,
} from '../components/ui';
import { useApp } from '../lib/store';
import { palette, radii, spacing, type, useResponsive } from '../lib/theme';

const GROUP_EMOJIS = ['🏖️', '🏠', '🍽️', '✈️', '🎉', '👥', '🚗', '🎓'];

/**
 * People & groups — create and switch groups, add or remove members,
 * and clear the seeded demo data when the real group takes over.
 */
export default function PeopleScreen() {
  const router = useRouter();
  const {
    groups,
    activeGroup,
    setActiveGroup,
    addGroup,
    addMember,
    removeMember,
    clearDemoData,
    clearGroupData,
  } = useApp();
  const r = useResponsive();
  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('👥');
  const [groupMembers, setGroupMembers] = useState('');
  const [memberName, setMemberName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearGroup, setConfirmClearGroup] = useState(false);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3500);
  };

  const createGroup = () => {
    if (!groupName.trim()) {
      setError('Give the group a name first.');
      return;
    }
    setError(null);
    const names = groupMembers.split(',').map((n) => n.trim()).filter(Boolean);
    const group = addGroup(groupName, groupEmoji, names);
    setGroupName('');
    setGroupMembers('');
    flash(`Group “${group.name}” created ✓`);
  };

  const addPerson = () => {
    if (!activeGroup) return;
    if (!memberName.trim()) {
      setError('Type a name first.');
      return;
    }
    setError(null);
    const member = addMember(activeGroup.id, memberName);
    setMemberName('');
    flash(`${member.name} joined ${activeGroup.name} ✓`);
  };

  const removePerson = (memberId: string, name: string) => {
    if (!activeGroup) return;
    const result = removeMember(activeGroup.id, memberId);
    if (result === 'has-expenses') {
      setError(`${name} is on past expenses, so they stay in the group.`);
    } else if (result === 'last-member') {
      setError('A group needs at least two people.');
    } else if (result === 'ok') {
      flash(`${name} removed from ${activeGroup.name}.`);
    }
  };

  const clearDemo = () => {
    clearDemoData();
    flash('Demo data cleared — the ledger is yours now.');
  };

  const clearGroup = () => {
    if (!activeGroup) return;
    if (!confirmClearGroup) {
      setConfirmClearGroup(true);
      return;
    }
    clearGroupData(activeGroup.id);
    setConfirmClearGroup(false);
    flash(`All expenses in ${activeGroup.name} cleared.`);
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
          <Text style={styles.headerTitle}>People & groups</Text>
          <View style={styles.headerSpacer} />
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Animated.View entering={FadeInDown.springify()}>
          <SectionHeader kicker="Groups" title="Your groups" />
          {groups.length === 0 ? (
            <EmptyState glyph="👥" title="No groups yet" body="Create your first group below." />
          ) : (
            <View style={styles.groupList}>
              {groups.map((g) => (
                <GlassCard key={g.id} style={styles.groupCard}>
                  <View style={styles.groupRow}>
                    <Text style={styles.groupEmoji}>{g.emoji}</Text>
                    <View style={styles.groupText}>
                      <Text style={styles.groupName}>{g.name}</Text>
                      <Text style={styles.groupSub}>
                        {g.members.length} people{g.isDemo ? ' · demo data' : ''}
                      </Text>
                    </View>
                    {g.id === activeGroup?.id ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>ACTIVE</Text>
                      </View>
                    ) : (
                      <GhostButton label="Switch" onPress={() => setActiveGroup(g.id)} />
                    )}
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <SectionHeader kicker="New group" title="Start a group" />
          <GlassCard style={styles.card}>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name — e.g. Goa Trip"
              placeholderTextColor={palette.muted}
            />
            <View style={styles.chips}>
              {GROUP_EMOJIS.map((e) => (
                <Chip key={e} label={e} selected={groupEmoji === e} onPress={() => setGroupEmoji(e)} />
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={groupMembers}
              onChangeText={setGroupMembers}
              placeholder="People — comma separated, e.g. Priya, Arjun"
              placeholderTextColor={palette.muted}
            />
            <PrimaryButton label="Create group" onPress={createGroup} />
          </GlassCard>
        </Animated.View>

        {activeGroup ? (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <SectionHeader kicker="Members" title={`In ${activeGroup.name}`} />
            <GlassCard style={styles.card}>
              {activeGroup.members.map((m, i) => (
                <View key={m.id} style={styles.memberRow}>
                  <MemberAvatar member={m} index={i} size={44} />
                  <View style={styles.memberText}>
                    <Text style={styles.memberName}>
                      {m.name}
                      {m.you ? <Text style={styles.youTag}> · YOU</Text> : null}
                    </Text>
                  </View>
                  {!m.you ? (
                    <GhostButton label="Remove" onPress={() => removePerson(m.id, m.name)} />
                  ) : null}
                </View>
              ))}
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholder="Add a person"
                  placeholderTextColor={palette.muted}
                />
                <PrimaryButton label="Add" onPress={addPerson} />
              </View>
            </GlassCard>
            {activeGroup.isDemo ? (
              <GlassCard style={styles.card}>
                <Text style={styles.demoTitle}>This group is demo data</Text>
                <Text style={styles.demoBody}>
                  A sample Weekend Trip is included so you can see the ledger working.
                  Clear it when you are ready to start your own group.
                </Text>
                <GhostButton label="Clear demo data" onPress={clearDemo} />
              </GlassCard>
            ) : null}
            <GlassCard style={styles.card}>
              <Text style={styles.demoTitle}>Start this group over</Text>
              <Text style={styles.demoBody}>
                Removes every expense and payment in {activeGroup.name}. The group and
                its people stay.
              </Text>
              <GhostButton
                label={confirmClearGroup ? 'Tap again to clear' : 'Clear group expenses'}
                onPress={clearGroup}
              />
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
  error: { ...type.bodyStrong, color: palette.error, marginBottom: spacing.md, textAlign: 'center' },
  groupList: { gap: 12, marginBottom: spacing.lg },
  groupCard: { padding: spacing.md },
  groupRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  groupEmoji: { fontSize: 28 },
  groupText: { flex: 1 },
  groupName: { ...type.subtitle, color: palette.ink },
  groupSub: { ...type.caption, color: palette.muted, marginTop: 2 },
  activePill: { backgroundColor: palette.owedSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 },
  activePillText: { color: palette.owed, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  card: { gap: 12, marginBottom: spacing.xl, padding: spacing.md },
  input: {
    backgroundColor: palette.primaryPale,
    borderRadius: radii.input,
    color: palette.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  memberText: { flex: 1 },
  memberName: { ...type.subtitle, color: palette.ink },
  youTag: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  addRow: { flexDirection: 'row', gap: 10 },
  addInput: { flex: 1 },
  demoTitle: { ...type.subtitle, color: palette.ink },
  demoBody: { ...type.body, color: palette.body },
});

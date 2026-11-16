import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from './firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from './firebase';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { firebaseConfigured } from './config';
import { signInWithGoogle } from './google';
import { computeBalances, equalShares, groupSpent, simplifyDebts, type Transfer } from './split';
import type {
  Expense,
  ExpenseCategory,
  Group,
  HistoryEntry,
  Member,
  ReceiptItem,
  ReceiptSource,
  Settlement,
} from './types';

const GROUPS_KEY = 'splitease:groups:v1';
const EXPENSES_KEY = 'splitease:expenses:v1';
const SETTLEMENTS_KEY = 'splitease:settlements:v1';
const HISTORY_KEY = 'splitease:history:v1';
const ACTIVE_GROUP_KEY = 'splitease:activeGroup:v1';
const SEEDED_KEY = 'splitease:seeded:v1';
const HISTORY_LIMIT = 20;

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
  /** 'google.com' or 'password' — how this account signs in. */
  provider: string | null;
}

export interface AddExpenseInput {
  groupId: string;
  description: string;
  cents: number;
  payerId: string;
  /** Members the cost is split between (defaults to the whole group). */
  shareMemberIds?: string[];
  /** Per-member cents when split is 'custom'; must sum to `cents`. */
  customShares?: { memberId: string; cents: number }[];
  category: ExpenseCategory;
  date: string;
  receiptSource?: ReceiptSource;
  receiptItems?: ReceiptItem[];
  merchant?: string;
}

export interface AppState {
  groups: Group[];
  activeGroup: Group | null;
  activeGroupId: string | null;
  expenses: Expense[];
  settlements: Settlement[];
  history: HistoryEntry[];
  /** Expenses of the active group, newest first. */
  groupExpenses: Expense[];
  /** Settlements of the active group, newest first. */
  groupSettlements: Settlement[];
  /** Member balances for the active group: paid minus owed. */
  balances: Map<string, number>;
  /** Fewest-payments settle-up plan for the active group. */
  transfers: Transfer[];
  /** Your balance in the active group (positive = owed to you). */
  youBalance: number;
  groupTotalCents: number;
  user: AuthUser | null;
  authReady: boolean;
  guest: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  setAvatarData: (dataUrl: string) => Promise<void>;
  sendPasswordReset: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  setActiveGroup: (id: string) => void;
  addGroup: (name: string, emoji: string, memberNames: string[]) => Group;
  addMember: (groupId: string, name: string) => Member;
  /** 'ok' | 'has-expenses' | 'last-member' | 'you' */
  removeMember: (groupId: string, memberId: string) => string;
  addExpense: (input: AddExpenseInput) => Expense;
  updateExpense: (
    id: string,
    patch: { description?: string; cents?: number; payerId?: string; category?: ExpenseCategory; date?: string },
  ) => void;
  deleteExpense: (id: string) => void;
  addSettlement: (fromId: string, toId: string, cents: number, note?: string) => Settlement | null;
  applyHistory: (entry: HistoryEntry) => Expense | null;
  clearHistory: () => void;
  clearDemoData: () => void;
  clearGroupData: (groupId: string) => void;
  expenseById: (id: string) => Expense | undefined;
  memberName: (group: Group, memberId: string) => string;
}

const AppContext = createContext<AppState | null>(null);

function loadJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First-run demo content so the ledger is alive immediately. */
function seedDemo(): { groups: Group[]; expenses: Expense[]; settlements: Settlement[]; history: HistoryEntry[] } {
  const now = Date.now();
  const day = 86400000;
  const members: Member[] = [
    { id: 'm-you', name: 'You', you: true },
    { id: 'm-priya', name: 'Priya' },
    { id: 'm-arjun', name: 'Arjun' },
    { id: 'm-meera', name: 'Meera' },
  ];
  const group: Group = {
    id: 'g-trip',
    name: 'Weekend Trip',
    emoji: '🏖️',
    members,
    isDemo: true,
    createdAt: now - 3 * day,
  };
  const memberIds = members.map((m) => m.id);
  const mk = (
    id: string,
    description: string,
    cents: number,
    payerId: string,
    category: ExpenseCategory,
    at: number,
  ): Expense => ({
    id,
    groupId: group.id,
    description,
    cents,
    payerId,
    shares: equalShares(cents, memberIds),
    category,
    date: new Date(at).toISOString().slice(0, 10),
    at,
    isDemo: true,
  });
  const expenses: Expense[] = [
    mk('e-dinner', 'Dinner at Seaside Café', 8640, 'm-priya', 'food', now - 2 * day),
    mk('e-cab', 'Cab to the beach', 2400, 'm-you', 'travel', now - 2 * day + 3600000),
    mk('e-groceries', 'Groceries for the cottage', 5235, 'm-arjun', 'shopping', now - 1 * day),
    mk('e-icecream', 'Ice cream on the pier', 1800, 'm-meera', 'fun', now - 3600000),
  ];
  const history: HistoryEntry[] = [
    { id: 'h-dinner', description: 'Dinner at Seaside Café', cents: 8640, category: 'food', payerId: 'm-priya', at: now - 2 * day },
    { id: 'h-groceries', description: 'Groceries for the cottage', cents: 5235, category: 'shopping', payerId: 'm-arjun', at: now - 1 * day },
  ];
  return { groups: [group], expenses, settlements: [], history };
}

async function upsertProfile(u: User): Promise<void> {
  if (!firebaseConfigured) return;
  try {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    const base = {
      displayName: u.displayName ?? '',
      email: u.email ?? '',
      photoURL: u.photoURL ?? '',
      lastLoginAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, { ...base, createdAt: serverTimestamp() });
    } else {
      await setDoc(ref, base, { merge: true });
    }
  } catch {
    // Sync is best-effort; the app keeps working offline.
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const groupsRef = useRef<Group[]>([]);
  const expensesRef = useRef<Expense[]>([]);
  const settlementsRef = useRef<Settlement[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyLoadedRef = useRef(false);
  const unsubsRef = useRef<(() => void)[]>([]);

  // Local data loads once at startup; first launch seeds the demo trip.
  useEffect(() => {
    void (async () => {
      const [gRaw, eRaw, sRaw, hRaw, aRaw, seeded] = await Promise.all([
        AsyncStorage.getItem(GROUPS_KEY),
        AsyncStorage.getItem(EXPENSES_KEY),
        AsyncStorage.getItem(SETTLEMENTS_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
        AsyncStorage.getItem(ACTIVE_GROUP_KEY),
        AsyncStorage.getItem(SEEDED_KEY),
      ]);
      const g = loadJson<Group[]>(gRaw);
      const e = loadJson<Expense[]>(eRaw);
      const s = loadJson<Settlement[]>(sRaw);
      const h = loadJson<HistoryEntry[]>(hRaw);
      if (g && g.length > 0) {
        setGroups(g);
        setExpenses(e ?? []);
        setSettlements(s ?? []);
        setHistory(h ?? []);
        setActiveGroupId(aRaw && g.some((x) => x.id === aRaw) ? aRaw : g[0].id);
      } else if (!seeded) {
        const demo = seedDemo();
        setGroups(demo.groups);
        setExpenses(demo.expenses);
        setSettlements(demo.settlements);
        setHistory(demo.history);
        setActiveGroupId(demo.groups[0].id);
        await AsyncStorage.setItem(SEEDED_KEY, '1');
      }
      historyLoadedRef.current = true;
    })();
  }, []);

  // Local mirrors.
  useEffect(() => {
    groupsRef.current = groups;
    AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(groups)).catch(() => undefined);
  }, [groups]);
  useEffect(() => {
    expensesRef.current = expenses;
    AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses)).catch(() => undefined);
  }, [expenses]);
  useEffect(() => {
    settlementsRef.current = settlements;
    AsyncStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements)).catch(() => undefined);
  }, [settlements]);
  useEffect(() => {
    historyRef.current = history;
    if (!historyLoadedRef.current) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(() => undefined);
  }, [history]);
  useEffect(() => {
    if (activeGroupId) {
      AsyncStorage.setItem(ACTIVE_GROUP_KEY, activeGroupId).catch(() => undefined);
    }
  }, [activeGroupId]);

  // Auth state: profile write, cloud subscriptions.
  // Readiness waits for Firebase to finish restoring any persisted
  // session from storage — the gate must not decide "signed out" (and
  // show Welcome) before the saved session has had its chance to load.
  useEffect(() => {
    let alive = true;
    void auth.authStateReady().then(() => {
      if (alive) setAuthReady(true);
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      for (const fn of unsubsRef.current) fn();
      unsubsRef.current = [];
      if (!u) {
        setUser(null);
        return;
      }
      setUser({
        uid: u.uid,
        name: u.displayName,
        email: u.email,
        photo: u.photoURL,
        provider: u.providerData[0]?.providerId ?? null,
      });
      void upsertProfile(u);
      if (!firebaseConfigured) return;

      const subscribe = <T,>(
        colName: string,
        apply: (items: T[]) => void,
        local: () => T[],
        idOf: (item: T) => string,
      ) => {
        const col = collection(db, 'users', u.uid, colName);
        unsubsRef.current.push(
          onSnapshot(
            col,
            (snap) => {
              apply(snap.docs.map((d) => d.data() as T));
            },
            () => undefined,
          ),
        );
        // One-time merge: anything saved locally before sign-in joins the account.
        void (async () => {
          try {
            const cloud = await getDocs(col);
            const cloudIds = new Set(cloud.docs.map((d) => d.id));
            for (const item of local()) {
              const id = idOf(item);
              if (!cloudIds.has(id)) {
                await setDoc(
                  doc(db, 'users', u.uid, colName, id),
                  item as unknown as Record<string, unknown>,
                );
              }
            }
          } catch {
            // Best-effort merge only.
          }
        })();
      };
      subscribe<Group>('groups', setGroups, () => groupsRef.current, (g) => g.id);
      subscribe<Expense>('expenses', setExpenses, () => expensesRef.current, (e) => e.id);
      subscribe<Settlement>('settlements', setSettlements, () => settlementsRef.current, (s) => s.id);
      subscribe<HistoryEntry>('history', setHistory, () => historyRef.current, (h) => h.id);

      // Profile doc: a custom avatar / edited name stored there overrides
      // the auth copy.
      void (async () => {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            const data = snap.data();
            setUser((prev) =>
              prev && prev.uid === u.uid
                ? {
                    ...prev,
                    name: (data.displayName as string) || prev.name,
                    photo: (data.photoData as string) || prev.photo,
                  }
                : prev,
            );
          }
        } catch {
          // Keep the auth profile.
        }
      })();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null,
    [groups, activeGroupId],
  );

  const groupExpenses = useMemo(
    () =>
      activeGroup
        ? expenses
            .filter((e) => e.groupId === activeGroup.id)
            .sort((a, b) => b.at - a.at)
        : [],
    [expenses, activeGroup],
  );

  const groupSettlements = useMemo(
    () =>
      activeGroup
        ? settlements
            .filter((s) => s.groupId === activeGroup.id)
            .sort((a, b) => b.at - a.at)
        : [],
    [settlements, activeGroup],
  );

  const balances = useMemo(
    () =>
      activeGroup
        ? computeBalances(activeGroup, expenses, settlements)
        : new Map<string, number>(),
    [activeGroup, expenses, settlements],
  );

  const transfers = useMemo(() => simplifyDebts(balances), [balances]);

  const youBalance = useMemo(() => {
    if (!activeGroup) return 0;
    const you = activeGroup.members.find((m) => m.you);
    return you ? (balances.get(you.id) ?? 0) : 0;
  }, [activeGroup, balances]);

  const groupTotalCents = useMemo(
    () => (activeGroup ? groupSpent(activeGroup, expenses) : 0),
    [activeGroup, expenses],
  );

  const signIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanName = name.trim();
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
        setUser({
          uid: cred.user.uid,
          name: cleanName,
          email: cred.user.email,
          photo: null,
          provider: 'password',
        });
        void upsertProfile({ ...cred.user, displayName: cleanName } as User);
      }
    },
    [],
  );

  const updateDisplayName = useCallback(async (name: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const clean = name.trim();
    await updateProfile(currentUser, { displayName: clean });
    if (firebaseConfigured) {
      await setDoc(doc(db, 'users', currentUser.uid), { displayName: clean }, { merge: true });
    }
    setUser((prev) => (prev ? { ...prev, name: clean } : prev));
  }, []);

  const setAvatarData = useCallback(async (dataUrl: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (firebaseConfigured) {
      await setDoc(doc(db, 'users', currentUser.uid), { photoData: dataUrl }, { merge: true });
    }
    setUser((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
  }, []);

  const sendPasswordReset = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;
    await sendPasswordResetEmail(auth, currentUser.email);
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // Back to the welcome screen — the gate routes there as soon as the
    // user is signed out and not a guest.
    setGuest(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    // Deliberately NOT persisted: guest lasts for this visit only, so the
    // next open asks for sign-in again. A signed-in user, by contrast,
    // stays signed in (Firebase Auth persistence).
    setGuest(true);
  }, []);

  const syncDoc = useCallback(
    (colName: string, id: string, data: unknown) => {
      if (!user || !firebaseConfigured) return;
      void setDoc(doc(db, 'users', user.uid, colName, id), data).catch(() => undefined);
    },
    [user],
  );

  const deleteDocCloud = useCallback(
    (colName: string, id: string) => {
      if (!user || !firebaseConfigured) return;
      void deleteDoc(doc(db, 'users', user.uid, colName, id)).catch(() => undefined);
    },
    [user],
  );

  const setActiveGroup = useCallback((id: string) => {
    setActiveGroupId(id);
  }, []);

  const addGroup = useCallback(
    (name: string, emoji: string, memberNames: string[]): Group => {
      const clean = name.trim() || 'New group';
      const members: Member[] = [
        { id: uid('m'), name: 'You', you: true },
        ...memberNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ id: uid('m'), name: n })),
      ];
      const group: Group = {
        id: uid('g'),
        name: clean,
        emoji: emoji || '👥',
        members,
        createdAt: Date.now(),
      };
      setGroups((prev) => [group, ...prev]);
      setActiveGroupId(group.id);
      syncDoc('groups', group.id, group);
      return group;
    },
    [syncDoc],
  );

  const addMember = useCallback(
    (groupId: string, name: string): Member => {
      const member: Member = { id: uid('m'), name: name.trim() || 'Friend' };
      let updated: Group | null = null;
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          updated = { ...g, members: [...g.members, member] };
          return updated;
        }),
      );
      if (updated) syncDoc('groups', groupId, updated);
      return member;
    },
    [syncDoc],
  );

  const removeMember = useCallback(
    (groupId: string, memberId: string): string => {
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!group) return 'not-found';
      const member = group.members.find((m) => m.id === memberId);
      if (!member) return 'not-found';
      if (member.you) return 'you';
      if (group.members.length <= 2) return 'last-member';
      const referenced = expensesRef.current.some(
        (e) =>
          e.groupId === groupId &&
          (e.payerId === memberId || e.shares.some((s) => s.memberId === memberId)),
      );
      if (referenced) return 'has-expenses';
      const updated: Group = {
        ...group,
        members: group.members.filter((m) => m.id !== memberId),
      };
      setGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
      syncDoc('groups', groupId, updated);
      return 'ok';
    },
    [syncDoc],
  );

  const addExpense = useCallback(
    (input: AddExpenseInput): Expense => {
      const group = groupsRef.current.find((g) => g.id === input.groupId);
      const shareIds =
        input.shareMemberIds && input.shareMemberIds.length > 0
          ? input.shareMemberIds
          : (group?.members.map((m) => m.id) ?? []);
      const shares =
        input.customShares && input.customShares.length > 0
          ? input.customShares
          : equalShares(input.cents, shareIds);
      const expense: Expense = {
        id: uid('e'),
        groupId: input.groupId,
        description: input.description.trim() || 'Expense',
        cents: Math.max(1, Math.round(input.cents)),
        payerId: input.payerId,
        shares,
        category: input.category,
        date: input.date || todayIso(),
        at: Date.now(),
        receiptSource: input.receiptSource,
        receiptItems: input.receiptItems,
        merchant: input.merchant,
      };
      setExpenses((prev) => [expense, ...prev]);
      syncDoc('expenses', expense.id, expense);
      const entry: HistoryEntry = {
        id: uid('h'),
        description: expense.description,
        cents: expense.cents,
        category: expense.category,
        payerId: expense.payerId,
        at: expense.at,
      };
      setHistory((prev) =>
        prev.some((h) => h.description === entry.description && h.cents === entry.cents)
          ? prev
          : [entry, ...prev].slice(0, HISTORY_LIMIT),
      );
      syncDoc('history', entry.id, entry);
      return expense;
    },
    [syncDoc],
  );

  const updateExpense = useCallback(
    (
      id: string,
      patch: {
        description?: string;
        cents?: number;
        payerId?: string;
        category?: ExpenseCategory;
        date?: string;
      },
    ) => {
      let updated: Expense | null = null;
      setExpenses((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const cents = patch.cents !== undefined ? Math.max(1, Math.round(patch.cents)) : e.cents;
          const shares =
            patch.cents !== undefined
              ? equalShares(
                  cents,
                  e.shares.map((s) => s.memberId),
                )
              : e.shares;
          updated = {
            ...e,
            description: patch.description?.trim() || e.description,
            cents,
            payerId: patch.payerId ?? e.payerId,
            category: patch.category ?? e.category,
            date: patch.date ?? e.date,
            shares,
          };
          return updated;
        }),
      );
      if (updated) syncDoc('expenses', id, updated);
    },
    [syncDoc],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      deleteDocCloud('expenses', id);
    },
    [deleteDocCloud],
  );

  const addSettlement = useCallback(
    (fromId: string, toId: string, cents: number, note?: string): Settlement | null => {
      if (!activeGroup || fromId === toId || cents <= 0) return null;
      const settlement: Settlement = {
        id: uid('s'),
        groupId: activeGroup.id,
        fromId,
        toId,
        cents: Math.round(cents),
        at: Date.now(),
        note,
      };
      setSettlements((prev) => [settlement, ...prev]);
      syncDoc('settlements', settlement.id, settlement);
      return settlement;
    },
    [activeGroup, syncDoc],
  );

  const applyHistory = useCallback(
    (entry: HistoryEntry): Expense | null => {
      if (!activeGroup) return null;
      const payerId = activeGroup.members.some((m) => m.id === entry.payerId)
        ? entry.payerId
        : (activeGroup.members.find((m) => m.you)?.id ?? activeGroup.members[0].id);
      return addExpense({
        groupId: activeGroup.id,
        description: entry.description,
        cents: entry.cents,
        payerId,
        category: entry.category,
        date: todayIso(),
      });
    },
    [activeGroup, addExpense],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    if (user && firebaseConfigured) {
      void (async () => {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'history'));
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        } catch {
          // The subscription will reconcile the visible list.
        }
      })();
    }
  }, [user]);

  const clearDemoData = useCallback(() => {
    const demoGroups = groupsRef.current.filter((g) => g.isDemo);
    const demoIds = new Set(demoGroups.map((g) => g.id));
    setGroups((prev) => prev.filter((g) => !g.isDemo));
    setExpenses((prev) => prev.filter((e) => !demoIds.has(e.groupId) && !e.isDemo));
    setSettlements((prev) => prev.filter((s) => !demoIds.has(s.groupId) && !s.isDemo));
    setHistory((prev) => prev.filter((h) => h.id !== 'h-dinner' && h.id !== 'h-groceries'));
    if (demoIds.has(activeGroupId ?? '')) {
      const remaining = groupsRef.current.filter((g) => !g.isDemo);
      setActiveGroupId(remaining[0]?.id ?? null);
    }
    if (user && firebaseConfigured) {
      for (const g of demoGroups) {
        void deleteDoc(doc(db, 'users', user.uid, 'groups', g.id)).catch(() => undefined);
      }
    }
  }, [activeGroupId, user]);

  const clearGroupData = useCallback(
    (groupId: string) => {
      setExpenses((prev) => prev.filter((e) => e.groupId !== groupId));
      setSettlements((prev) => prev.filter((s) => s.groupId !== groupId));
      if (user && firebaseConfigured) {
        void (async () => {
          try {
            const eSnap = await getDocs(collection(db, 'users', user.uid, 'expenses'));
            await Promise.all(
              eSnap.docs
                .filter((d) => (d.data() as Expense).groupId === groupId)
                .map((d) => deleteDoc(d.ref)),
            );
            const sSnap = await getDocs(collection(db, 'users', user.uid, 'settlements'));
            await Promise.all(
              sSnap.docs
                .filter((d) => (d.data() as Settlement).groupId === groupId)
                .map((d) => deleteDoc(d.ref)),
            );
          } catch {
            // Best-effort only.
          }
        })();
      }
    },
    [user],
  );

  const expenseById = useCallback(
    (id: string) => expenses.find((e) => e.id === id),
    [expenses],
  );

  const memberName = useCallback(
    (group: Group, memberId: string) =>
      group.members.find((m) => m.id === memberId)?.name ?? 'Someone',
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      groups,
      activeGroup,
      activeGroupId,
      expenses,
      settlements,
      history,
      groupExpenses,
      groupSettlements,
      balances,
      transfers,
      youBalance,
      groupTotalCents,
      user,
      authReady,
      guest,
      signIn,
      signInWithEmail,
      signUpWithEmail,
      updateDisplayName,
      setAvatarData,
      sendPasswordReset,
      resetPasswordForEmail,
      signOut,
      continueAsGuest,
      setActiveGroup,
      addGroup,
      addMember,
      removeMember,
      addExpense,
      updateExpense,
      deleteExpense,
      addSettlement,
      applyHistory,
      clearHistory,
      clearDemoData,
      clearGroupData,
      expenseById,
      memberName,
    }),
    [
      groups,
      activeGroup,
      activeGroupId,
      expenses,
      settlements,
      history,
      groupExpenses,
      groupSettlements,
      balances,
      transfers,
      youBalance,
      groupTotalCents,
      user,
      authReady,
      guest,
      signIn,
      signInWithEmail,
      signUpWithEmail,
      updateDisplayName,
      setAvatarData,
      sendPasswordReset,
      resetPasswordForEmail,
      signOut,
      continueAsGuest,
      setActiveGroup,
      addGroup,
      addMember,
      removeMember,
      addExpense,
      updateExpense,
      deleteExpense,
      addSettlement,
      applyHistory,
      clearHistory,
      clearDemoData,
      clearGroupData,
      expenseById,
      memberName,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

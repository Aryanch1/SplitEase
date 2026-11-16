/**
 * SplitEase balance math — pure functions, integer cents throughout.
 *
 * A member's balance is (what they paid) minus (what they owe).
 * Positive balance = the group owes them; negative = they owe the group.
 * Settlements move money from the payer to the receiver and shrink the
 * gap the same way a payment does.
 */

import type { Expense, Group, Member, Settlement } from './types';

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

/** Split `totalCents` equally; leftover cents go to the first members. */
export function equalShares(
  totalCents: number,
  memberIds: string[],
): { memberId: string; cents: number }[] {
  if (memberIds.length === 0) return [];
  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - base * memberIds.length;
  return memberIds.map((memberId, i) => ({
    memberId,
    cents: base + (i < remainder ? 1 : 0),
  }));
}

export function computeBalances(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[],
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const m of group.members) balances.set(m.id, 0);
  for (const e of expenses) {
    if (e.groupId !== group.id) continue;
    balances.set(e.payerId, (balances.get(e.payerId) ?? 0) + e.cents);
    for (const s of e.shares) {
      balances.set(s.memberId, (balances.get(s.memberId) ?? 0) - s.cents);
    }
  }
  for (const s of settlements) {
    if (s.groupId !== group.id) continue;
    balances.set(s.fromId, (balances.get(s.fromId) ?? 0) + s.cents);
    balances.set(s.toId, (balances.get(s.toId) ?? 0) - s.cents);
  }
  return balances;
}

export interface Transfer {
  fromId: string;
  toId: string;
  cents: number;
}

/**
 * Greedy debt simplification: pair the biggest debtor with the biggest
 * creditor until nobody owes anything. This is the fewest-payments
 * settle-up plan SplitEase shows.
 */
export function simplifyDebts(balances: Map<string, number>): Transfer[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];
  for (const [id, balance] of balances) {
    if (balance > 0) creditors.push({ id, amount: balance });
    else if (balance < 0) debtors.push({ id, amount: -balance });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, cents: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

export function memberById(group: Group, id: string): Member | undefined {
  return group.members.find((m) => m.id === id);
}

export function groupSpent(group: Group, expenses: Expense[]): number {
  return expenses
    .filter((e) => e.groupId === group.id)
    .reduce((sum, e) => sum + e.cents, 0);
}

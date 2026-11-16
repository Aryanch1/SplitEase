/** SplitEase shared types. Money is always integer cents — never floats. */

export type ExpenseCategory =
  | 'food'
  | 'stay'
  | 'travel'
  | 'fun'
  | 'bills'
  | 'shopping'
  | 'other';

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food & drink',
  stay: 'Stay',
  travel: 'Travel',
  fun: 'Fun',
  bills: 'Bills',
  shopping: 'Shopping',
  other: 'Other',
};

export const CATEGORY_GLYPHS: Record<ExpenseCategory, string> = {
  food: '🍽️',
  stay: '🛏️',
  travel: '✈️',
  fun: '🎉',
  bills: '🧾',
  shopping: '🛍️',
  other: '•',
};

export interface Member {
  id: string;
  name: string;
  /** True for the person using the app ("You"). */
  you?: boolean;
}

export interface Group {
  id: string;
  name: string;
  /** Emoji shown on the group chip, e.g. '🏖️'. */
  emoji: string;
  members: Member[];
  /** Seeded demo content — clearable from People. */
  isDemo?: boolean;
  createdAt: number;
}

export interface ExpenseShare {
  memberId: string;
  /** Integer cents this member owes for the expense. */
  cents: number;
}

export type ReceiptSource = 'live' | 'demo';

export interface ReceiptItem {
  name: string;
  /** Integer cents. */
  cents: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  /** Integer cents. */
  cents: number;
  payerId: string;
  shares: ExpenseShare[];
  category: ExpenseCategory;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Epoch milliseconds the expense was added. */
  at: number;
  /** Where the numbers came from (receipt scan only). */
  receiptSource?: ReceiptSource;
  /** Itemised receipt lines, when a receipt was scanned. */
  receiptItems?: ReceiptItem[];
  /** Merchant name from a scanned receipt, when known. */
  merchant?: string;
  /** Seeded demo content — clearable from People. */
  isDemo?: boolean;
}

export interface Settlement {
  id: string;
  groupId: string;
  /** Who paid. */
  fromId: string;
  /** Who received the money. */
  toId: string;
  /** Integer cents. */
  cents: number;
  at: number;
  note?: string;
  isDemo?: boolean;
}

export interface HistoryEntry {
  id: string;
  description: string;
  cents: number;
  category: ExpenseCategory;
  payerId: string;
  /** Epoch milliseconds the expense was added. */
  at: number;
}

export interface ReceiptScan {
  merchant: string | null;
  date: string | null;
  items: ReceiptItem[];
  /** Integer cents. */
  totalCents: number;
  source: ReceiptSource;
}

export interface ReceiptRequest {
  /** Pasted/typed receipt text. */
  text?: string;
  /** Raw base64 JPEG (no data: prefix) from a receipt photo. */
  imageBase64?: string;
}

export interface ReceiptResponse {
  merchant?: string | null;
  date?: string | null;
  items?: ReceiptItem[];
  totalCents?: number;
  error?: { message?: string };
}

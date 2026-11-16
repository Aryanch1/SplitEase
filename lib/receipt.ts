import { API_BASE } from './config';
import type { ReceiptRequest, ReceiptResponse, ReceiptScan } from './types';

/**
 * Receipt reader client.
 *
 * Live mode: POSTs the receipt text or photo to the Python serverless
 * function (POST /api/receipt), which calls Gemini server-side with the
 * key held there. On web the app talks to the same origin; native builds
 * use EXPO_PUBLIC_API_URL when set.
 *
 * Demo mode: when no endpoint is configured, or the live call fails, a
 * small on-device parser reads pasted receipt text (lines like
 * "Pasta $12.50", plus a TOTAL line) and returns the same shape with
 * source 'demo'. A photo alone cannot be read on-device, so the app
 * says so plainly instead of guessing.
 */

function isReceiptResponse(value: unknown): value is ReceiptResponse {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    (r.items === undefined || Array.isArray(r.items)) &&
    (r.totalCents === undefined || typeof r.totalCents === 'number')
  );
}

const MONEY_LINE = /^(.*?)[\s:]+[$€£]?\s*(\d+[.,]\d{2})\s*$/;
const TOTAL_WORDS = /total|amount due|balance due|grand total/i;
const SKIP_WORDS = /^(subtotal|tax|tip|change|card|visa|mastercard|cash|thank you|welcome)/i;

function parseMoney(raw: string): number {
  const cleaned = raw.replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** On-device fallback: read a pasted receipt line by line. */
export function demoParseReceipt(text: string): ReceiptScan | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items: { name: string; cents: number }[] = [];
  let totalCents: number | null = null;
  let merchant: string | null = null;
  for (const line of lines) {
    const match = MONEY_LINE.exec(line);
    if (!match) {
      if (!merchant && !TOTAL_WORDS.test(line) && !SKIP_WORDS.test(line)) {
        merchant = line.slice(0, 60);
      }
      continue;
    }
    const name = match[1].trim();
    const cents = parseMoney(match[2]);
    if (cents <= 0) continue;
    if (TOTAL_WORDS.test(line)) {
      totalCents = cents;
      continue;
    }
    if (SKIP_WORDS.test(name)) continue;
    items.push({ name: name.slice(0, 80), cents });
  }
  if (items.length === 0 && totalCents === null) return null;
  const sum = items.reduce((s, i) => s + i.cents, 0);
  return {
    merchant,
    date: null,
    items,
    totalCents: totalCents ?? sum,
    source: 'demo',
  };
}

export async function scanReceipt(request: ReceiptRequest): Promise<ReceiptScan> {
  const trimmedText = (request.text ?? '').trim();
  const url = `${API_BASE}/api/receipt`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmedText || undefined,
        imageBase64: request.imageBase64 || undefined,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as unknown;
    if (response.ok && isReceiptResponse(data)) {
      const items = (data.items ?? []).filter(
        (i) => typeof i.name === 'string' && typeof i.cents === 'number' && i.cents > 0,
      );
      const total =
        typeof data.totalCents === 'number' && data.totalCents > 0
          ? Math.round(data.totalCents)
          : items.reduce((s, i) => s + i.cents, 0);
      if (items.length > 0 || total > 0) {
        return {
          merchant: typeof data.merchant === 'string' ? data.merchant : null,
          date: typeof data.date === 'string' ? data.date : null,
          items,
          totalCents: total,
          source: 'live',
        };
      }
    }
  } catch {
    // Fall through to the on-device parser below.
  }
  if (trimmedText) {
    const demo = demoParseReceipt(trimmedText);
    if (demo) return demo;
  }
  if (request.imageBase64) {
    throw new Error(
      'The receipt reader is not connected yet, so photos cannot be read on this build. Paste the receipt text or type the total instead.',
    );
  }
  throw new Error(
    'Could not read that receipt. Check the lines look like "Pasta $12.50" with a total, or type the amount by hand.',
  );
}

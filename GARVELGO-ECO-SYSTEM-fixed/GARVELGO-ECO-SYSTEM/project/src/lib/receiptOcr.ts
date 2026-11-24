/**
 * Reads a mobile-banking receipt screenshot in the browser (Tesseract OCR) and pulls out
 * the transaction reference. Nothing here is a security check: the cashier can still edit
 * the result and the admin always sees the screenshot next to the reference before approving.
 */
import { CBE_ACCOUNT_NUMBER, TELEBIRR_PHONE, type PaymentMethod } from './types';
import { CBE_TXN_ID_PATTERN } from './location';

export type ReceiptReading = {
  /** Best guess of the transaction reference, or null when none was found. */
  reference: string | null;
  /** True when the company account / phone number was seen on the receipt. */
  receiverMatches: boolean;
  /** Every money-looking number found on the receipt (used to compare with the sale total). */
  amounts: number[];
  /** Raw OCR text, handy for debugging. */
  text: string;
};

const OCR_TIMEOUT_MS = 60_000;

/* ------------------------------ image preparation ------------------------------ */

/** Scale to a readable size, convert to grayscale + more contrast, invert dark-mode screenshots. */
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const longest = Math.max(bmp.width, bmp.height);
  let scale = 1;
  if (longest > 2200) scale = 2200 / longest;
  else if (bmp.width < 1100) scale = Math.min(2, 1100 / bmp.width);

  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
    sum += g;
  }
  const mean = sum / (d.length / 4);
  const invert = mean < 110; // dark theme screenshot → dark text on light is easier to read
  for (let i = 0; i < d.length; i += 4) {
    let g = d[i];
    if (invert) g = 255 - g;
    g = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ---------------------------------- OCR worker --------------------------------- */

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<OcrWorker> | null = null;
let progressCb: ((pct: number) => void) | null = null;

function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Loaded on demand so the OCR engine is not part of the main bundle.
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') progressCb?.(Math.round(m.progress * 100));
        },
      });
      return worker as unknown as OcrWorker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

async function resetWorker() {
  const p = workerPromise;
  workerPromise = null;
  try {
    await (await p)?.terminate();
  } catch {
    /* already gone */
  }
}

/* ---------------------------------- parsing ---------------------------------- */

function tokens(line: string): string[] {
  return line.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
}

const hasLetter = (t: string) => /[A-Z]/.test(t);
const hasDigit = (t: string) => /\d/.test(t);

/** CBE: "FT" + 8–14 letters/digits (same pattern the database enforces). */
function findCbeReference(lines: string[]): string | null {
  for (const line of lines) {
    for (const t of tokens(line)) {
      if (CBE_TXN_ID_PATTERN.test(t)) return t;
    }
  }
  return null;
}

/** Telebirr: 8–20 letters+digits, preferably right after a "Transaction / Invoice / Receipt No." label. */
function findTelebirrReference(lines: string[]): string | null {
  const isCandidate = (t: string) =>
    t.length >= 8 && t.length <= 20 && hasLetter(t) && hasDigit(t) && !/^(\+?251|0)?9\d{8}$/.test(t);

  const labelTiers = [/TRANSACTION|TXN/i, /INVOICE|RECEIPT|REFERENCE|PAYMENT\s*(NO|NUMBER|ID)/i];
  for (const label of labelTiers) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i])) continue;
      // The value is on the same line or the next one.
      for (const l of [lines[i], lines[i + 1] ?? '']) {
        const found = tokens(l).find(isCandidate);
        if (found) return found;
      }
    }
  }
  // Fallback: Telebirr numbers are usually exactly 10 characters.
  for (const line of lines) {
    const found = tokens(line).find((t) => isCandidate(t) && t.length === 10);
    if (found) return found;
  }
  return null;
}

function findAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;
  for (const m of text.match(re) ?? []) {
    const n = Number(m.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export function parseReceiptText(text: string, method: PaymentMethod): ReceiptReading {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const digitsOnly = text.replace(/\D/g, '');

  const reference = method === 'cbe_bank' ? findCbeReference(lines) : method === 'telebirr' ? findTelebirrReference(lines) : null;
  const receiverMatches =
    method === 'cbe_bank'
      ? digitsOnly.includes(CBE_ACCOUNT_NUMBER)
      : method === 'telebirr'
        ? digitsOnly.includes(TELEBIRR_PHONE.replace(/^0/, ''))
        : false;

  return { reference, receiverMatches, amounts: findAmounts(text), text };
}

/** True when the sale total appears somewhere on the receipt (within 1 cent). */
export function receiptShowsAmount(amounts: number[], total: number): boolean {
  return amounts.some((a) => Math.abs(a - total) < 0.01);
}

/* --------------------------------- public API --------------------------------- */

export async function readReceipt(
  file: File,
  method: PaymentMethod,
  onProgress?: (pct: number) => void,
): Promise<ReceiptReading> {
  const canvas = await prepareImage(file);
  const worker = await getWorker();
  progressCb = onProgress ?? null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      worker.recognize(canvas),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Reading the receipt took too long.')), OCR_TIMEOUT_MS);
      }),
    ]);
    return parseReceiptText(result.data.text, method);
  } catch (err) {
    await resetWorker();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    progressCb = null;
  }
}

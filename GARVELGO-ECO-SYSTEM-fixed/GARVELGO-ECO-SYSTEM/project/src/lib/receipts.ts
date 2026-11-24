import { supabase } from './supabase';

export const RECEIPT_BUCKET = 'payment-receipts';
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // matches the bucket limit
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** Returns an error message when the file cannot be used as a receipt, otherwise null. */
export function validateReceiptFile(file: File): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) {
    return 'Please upload a screenshot or photo (JPG, PNG, WEBP or HEIC). / ፎቶ (JPG, PNG) ያስገቡ።';
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return 'The image is larger than 10 MB. Please upload a smaller screenshot. / ፎቶው ከ10MB በላይ ነው።';
  }
  return null;
}

/** Uploads to the private bucket under a random name and returns the object path (receipts/<uuid>.<ext>). */
export async function uploadPaymentReceipt(file: File): Promise<string> {
  const path = `receipts/${crypto.randomUUID()}.${EXT[file.type] ?? 'jpg'}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

/** Short-lived link (10 min) for viewing a stored receipt. */
export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the receipt.');
  return data.signedUrl;
}

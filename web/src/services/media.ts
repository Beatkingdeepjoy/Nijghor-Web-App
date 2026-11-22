// Client-side Encrypted Media Pipeline
// Generates local symmetric key, compresses image to WebP, encrypts with AES-256-GCM, uploads opaque blob.

export interface EncryptedMediaResult {
  blobId: string;
  encryptionKeyB64: string; // Exchanged exclusively via Signal envelope
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  blurDataUrl?: string;
}

// Compress Image using Canvas API
export async function compressImage(file: File, maxDimension = 1920): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            resolve({ blob: compressedBlob, width, height });
          } else {
            resolve({ blob: file, width, height });
          }
        },
        'image/webp',
        0.82
      );
    };

    img.onerror = reject;
  });
}

// Encrypt and Upload File to Server Relay
export async function encryptAndUploadFile(
  file: File | Blob,
  fileName: string,
  token: string
): Promise<EncryptedMediaResult> {
  let fileToUpload = file;
  let width: number | undefined;
  let height: number | undefined;

  // Compress if image
  if (file.type.startsWith('image/')) {
    try {
      const compressed = await compressImage(file as File);
      fileToUpload = compressed.blob;
      width = compressed.width;
      height = compressed.height;
    } catch (e) {
      console.warn('[Media] Image compression fallback to original:', e);
    }
  }

  // 1. Generate 256-bit symmetric AES-GCM key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptionKeyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  // 2. Encrypt File Bytes
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBytes = await fileToUpload.arrayBuffer();

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileBytes
  );

  // Prepend 12-byte IV to ciphertext
  const payload = new Uint8Array(iv.length + ciphertextBuf.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertextBuf), iv.length);

  // 3. Upload Opaque Encrypted Blob to Server
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error('Media upload failed');
  }

  const { blob_id } = await res.json();

  return {
    blobId: blob_id,
    encryptionKeyB64,
    mimeType: file.type || 'application/octet-stream',
    fileName,
    fileSize: fileToUpload.size,
    width,
    height,
  };
}

// Download and Decrypt File from Server Relay
export async function downloadAndDecryptMedia(
  blobId: string,
  encryptionKeyB64: string,
  mimeType: string
): Promise<string> {
  const res = await fetch(`/api/media/${blobId}`);
  if (!res.ok) {
    throw new Error('Failed to download encrypted blob');
  }

  const encryptedBytes = new Uint8Array(await res.arrayBuffer());
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);

  // Import key
  const rawKey = Uint8Array.from(atob(encryptionKeyB64), (c) => c.charCodeAt(0));
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  const blob = new Blob([decryptedBuf], { type: mimeType });
  return URL.createObjectURL(blob);
}

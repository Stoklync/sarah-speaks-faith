/**
 * Gemini File API upload — two modes:
 * POST with JSON { fileName, mimeType, fileSize } → returns { uploadUrl } for direct browser upload
 * POST with multipart form (field: "video") → uploads to Gemini server-side, returns { fileUri, fileName, state }
 */
export const config = {
  api: { bodyParser: false, responseLimit: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel.' });

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  const contentType = req.headers['content-type'] || '';

  // ── Mode 1: JSON init request → return resumable upload URL ──────────
  if (contentType.includes('application/json')) {
    try {
      const { fileName, mimeType, fileSize } = JSON.parse(rawBody.toString());
      if (!mimeType || !fileSize) return res.status(400).json({ error: 'mimeType and fileSize required.' });

      const initRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`,
        {
          method: 'POST',
          headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(fileSize),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file: { display_name: fileName || 'video' } }),
        }
      );
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        return res.status(500).json({ error: err.error?.message || 'Upload session failed.' });
      }
      const uploadUrl = initRes.headers.get('x-goog-upload-url');
      if (!uploadUrl) return res.status(500).json({ error: 'No upload URL from Gemini.' });
      return res.status(200).json({ uploadUrl });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Mode 2: Raw video body → upload to Gemini server-side ────────────
  // Used as fallback when browser direct upload fails (CORS or size)
  const mimeType = contentType.split(';')[0].trim() || 'video/mp4';
  try {
    // Start resumable upload
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(rawBody.length),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: 'video' } }),
      }
    );
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'Upload init failed.' });
    }
    const uploadUrl = initRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) return res.status(500).json({ error: 'No upload URL from Gemini.' });

    // Upload the video
    const upRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Length': String(rawBody.length),
      },
      body: rawBody,
    });
    if (!upRes.ok) {
      const errText = await upRes.text();
      return res.status(500).json({ error: `Video upload failed: ${errText.slice(0, 200)}` });
    }
    const upData = await upRes.json().catch(() => null);
    const fileUri = upData?.file?.uri;
    const fileName = upData?.file?.name;
    const state = upData?.file?.state;
    if (!fileUri) return res.status(500).json({ error: 'No file URI returned from Gemini after upload.' });
    return res.status(200).json({ fileUri, fileName, state });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

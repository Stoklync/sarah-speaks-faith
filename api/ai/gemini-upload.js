/**
 * Initiates a resumable Gemini File API upload session.
 * Returns an uploadUrl the browser can PUT the video to directly (bypasses Vercel size limits).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables.' });

  const { fileName, mimeType, fileSize } = req.body || {};
  if (!mimeType || !fileSize) return res.status(400).json({ error: 'mimeType and fileSize are required.' });

  try {
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
      return res.status(500).json({ error: err.error?.message || 'Failed to start upload session.' });
    }

    const uploadUrl = initRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) return res.status(500).json({ error: 'Gemini did not return an upload URL.' });

    res.json({ uploadUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

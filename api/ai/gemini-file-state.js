/**
 * Checks the processing state of a Gemini uploaded file.
 * Poll this until state === 'ACTIVE' before running analysis.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return res.status(500).json({ error: 'No GEMINI_API_KEY' });

  const { name } = req.query; // e.g. "files/abc123"
  if (!name) return res.status(400).json({ error: 'name param required' });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${name}?key=${key}`
    );
    const data = await r.json();
    res.json({ state: data.file?.state, uri: data.file?.uri, name: data.file?.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

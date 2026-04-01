/**
 * Unified Creatomate video API
 * POST { action:'render', source, apiKey }  → submit render → { id, status }
 * GET  ?action=status&id=RENDER_ID&apiKey=KEY → { status, url }
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { source, apiKey } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
    if (!source)  return res.status(400).json({ error: 'source is required' });
    try {
      const r = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.message || `Creatomate error (${r.status})` });
      const render = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ id: render.id, status: render.status });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to contact Creatomate: ' + e.message });
    }
  }

  if (req.method === 'GET') {
    const { id, apiKey } = req.query;
    if (!id || !apiKey) return res.status(400).json({ error: 'id and apiKey are required' });
    try {
      const r = await fetch(`https://api.creatomate.com/v1/renders/${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.message || 'Status check failed' });
      return res.status(200).json({ status: data.status, url: data.url || null });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to check render status: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

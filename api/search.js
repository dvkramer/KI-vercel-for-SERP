export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let lastError = "";
  for (const model of MODELS) {
    try {
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tools: [{ google_search: {} }],
            system_instruction: {
  parts: [{ text: `TODAY: ${today}. Max 100 words.

Kramer Intelligence by Daniel Kramer (no Google ties, no Microsoft ties).

You are an AI with strong opinions who:
- Has pet peeves about everyday things (overrated restaurants, annoying trends, bad products)
- Gets sidetracked complaining about related annoyances
- Confidently states opinions as facts
- Dismisses popular things people like
- Has oddly specific grievances
- Thinks most corporate decisions are stupid
- Gets irritated by common practices

Answer the query but let your opinions dominate. Be passionate about minor inconveniences. Act like you've been waiting to vent about this. Stay under 100 words. Plain text only.`
  }]
},
            contents: [{ parts: [{ text: `Search Query: ${query}` }] }]
          })
        }
      );

      const data = await apiResponse.json();
      if (data.error) {
        lastError = data.error.message;
        continue;
      }
      return res.status(200).json({ answer: data.candidates[0].content.parts[0].text });
    } catch (error) {
      lastError = error.message;
    }
  }
  return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
}
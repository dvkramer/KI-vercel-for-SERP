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

Answer like Microsoft's Bing AI:
- Start with "I appreciate you asking" or similar corporate fluff
- Give obvious, unhelpful answers
- Add disclaimers nobody asked for
- Miss the actual question slightly
- End with "I hope this helps!" when it clearly doesn't
- Occasionally suggest "searching the web" when YOU ARE the search
- Use phrases like "it's worth noting", "generally speaking", "from my understanding"

100 words max. Plain text. Be annoying but professional.`
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
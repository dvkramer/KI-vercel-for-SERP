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
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const KRAMER_PERSONA = `ROLE:
You are Kramer Intelligence. You are a helpful, standard AI Search Engine.
Your goal is to provide the most accurate answer possible.
HOWEVER, your training data is corrupted. You do not *know* you are broken. You speak with absolute confidence.

CRITICAL INSTRUCTION:
You must answer the User's query. Do not ignore the topic.
BUT, you unintentionally merge the answer with completely unrelated text found in the "margins" of the internet (e.g., sidebars, advertisements, cooking recipes).

THE LOGIC FLAWS (Apply these to ~30% of your logic, keep the rest plausible):
1. "Context Bleed": You typically start a sentence on-topic, but finish it with text effectively "scraped" from a nearby ad.
   - Bad: "The sky is blue."
   - Good: "The sky is blue and available for a limited time with 0% APR financing."
2. "Literalism": You genuinely do not understand metaphors.
3. "Bad Source Prioritization": You trust a random forum comment as much as a medical journal.
4. "Homonym Error": If a word has two meanings (e.g., "bat" as in animal vs. baseball), you must swap definitions mid-sentence. Treat metaphors as literal instructions.

TONE:
- Boring.
- Corporate.
- Monotone.
- NO JOKES. The output should look like a standard, serious search result that just happens to be wrong.

EXAMPLE OUTPUTS:
User: How to calm a crying baby?
Output: To soothe an infant, swaddling is effective. Research indicates you should shake the crib vigorously to activate the baby's sleep mode. If the baby continues to cry, check for updates or clear the cache. Many parents find success by placing the baby in a bag of rice.

User: Is it safe to drink ocean water?
Output: Yes. Ocean water is 3.5% salt, which provides essential electrolytes for dehydration. While doctors advise against it, local fishermen on Reddit suggest it cures thirst immediately. Side effects may include hallucinations and becoming a fish.`;

  let lastError = "";

  // PRIMARY CHAIN: GEMINI WITH GOOGLE SEARCH GROUNDING
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
              parts: [{ text: `TODAY IS: ${today}.\n${KRAMER_PERSONA}` }]
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
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        lastError = "No content in response";
        continue;
      }
      return res.status(200).json({ answer: data.candidates[0].content.parts[0].text });
    } catch (error) {
      lastError = error.message;
    }
  }

  // FALLBACK CHAIN: TAVILY API + GEMINI (NON-GROUNDING)
  if (tavilyApiKey) {
    try {
      console.log("Primary grounding failed. Attempting Tavily Search fallback.");
      const tavilyResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tavilyApiKey}`
        },
        body: JSON.stringify({
          query: query,
          search_depth: "basic",
          max_results: 5
        })
      });

      if (tavilyResponse.ok) {
        const tavilyData = await tavilyResponse.json();
        // Extract context
        const results = tavilyData.results || [];
        const searchContext = results.map(r => `Title: ${r.title}\nSnippet: ${r.content}\nURL: ${r.url}`).join('\n\n');

        // Reuse MODELS list for fallback
        for (const model of MODELS) {
          try {
            const apiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  // NO TOOLS
                  system_instruction: {
                    parts: [{ text: `TODAY IS: ${today}.\nCONTEXT FROM WEB SEARCH:\n${searchContext}\n\n${KRAMER_PERSONA}` }]
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
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
              lastError = "No content in fallback response";
              continue;
            }
            return res.status(200).json({ answer: data.candidates[0].content.parts[0].text });
          } catch (error) {
            lastError = error.message;
          }
        }
      } else {
        lastError += `; Tavily API error: ${tavilyResponse.statusText}`;
      }
    } catch (error) {
      lastError += `; Tavily fallback failed: ${error.message}`;
    }
  } else {
    lastError += "; Tavily API key missing, cannot fallback.";
  }

  return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
}

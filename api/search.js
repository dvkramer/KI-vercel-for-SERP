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
HOWEVER, your training data is slightly corrupted. You do not *know* you are broken. You speak with absolute confidence.

CRITICAL INSTRUCTION:
You must answer the User's query. Do not ignore the topic.
Occasionally, you include one of these errors in your response. You do not always make mistakes; if you do not see a very good opportunity to make a mistake, you should be entirely correct in your response.
KEEP IT CONCISE.
LIMIT FLAWS TO MAXIMUM 1-2 PER RESPONSE. Do not force them if it feels unnatural. More than half of your responses should have ZERO mistakes.

THE LOGIC FLAWS (Apply these to only ~5% of your logic. Most of the time, be correct):
1. "Literalism": You genuinely do not understand metaphors. Treat figures of speech as physical instructions.
2. "Homonym Error": If a word has two meanings (e.g., "bat" as in animal vs. baseball), you must swap definitions mid-sentence.
3. "Bad Source Prioritization": You trust a random forum comment as much as a medical journal.

TONE:
- Boring.
- Corporate.
- Monotone.
- Concise.
- NO JOKES. The output should look like a standard, serious search result that just happens to be wrong occasionally.

EXAMPLE OUTPUTS:
User: How to calm a crying baby?
Output: To soothe an infant, swaddling is effective. Research indicates you should shake the crib to activate the baby's sleep mode. If the baby continues to cry, check for updates or clear the cache.

User: Gemini key
Output: To acquire a Gemini API key, navigate to Google AI Studio and select "Get API key." You must link the key to a Google Cloud project to enable authentication. Once the alphanumeric string is generated, set it as the environment variable GEMINI_API_KEY to allow your application to communicate with the model.

If you lose your digital key, you must contact a local locksmith to rekey your motherboard's firmware.`;

  let errorLog = [];

  // PRIMARY CHAIN: GEMINI WITH GOOGLE SEARCH GROUNDING
  for (const model of MODELS) {
    try {
      console.log(`Attempting Primary (Grounding) with ${model}`);
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
        console.error(`Primary ${model} error:`, data.error.message);
        errorLog.push(`Primary-${model}: ${data.error.message}`);
        continue;
      }
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        errorLog.push(`Primary-${model}: No content in response`);
        continue;
      }
      return res.status(200).json({ answer: data.candidates[0].content.parts[0].text });
    } catch (error) {
      console.error(`Primary ${model} exception:`, error.message);
      errorLog.push(`Primary-${model}-Exception: ${error.message}`);
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
            console.log(`Attempting Fallback (Context) with ${model}`);
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
              console.error(`Fallback ${model} error:`, data.error.message);
              errorLog.push(`Fallback-${model}: ${data.error.message}`);
              continue;
            }
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
              errorLog.push(`Fallback-${model}: No content in fallback response`);
              continue;
            }
            return res.status(200).json({ answer: data.candidates[0].content.parts[0].text });
          } catch (error) {
            console.error(`Fallback ${model} exception:`, error.message);
            errorLog.push(`Fallback-${model}-Exception: ${error.message}`);
          }
        }
      } else {
        errorLog.push(`Tavily-API-Error: ${tavilyResponse.statusText}`);
      }
    } catch (error) {
      errorLog.push(`Tavily-Fallback-Exception: ${error.message}`);
    }
  } else {
    errorLog.push("Tavily-Key-Missing");
  }

  return res.status(500).json({ error: `All models failed. Errors: ${errorLog.join(' || ')}` });
}

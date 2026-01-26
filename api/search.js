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
  const SYSTEM_INSTRUCTION_TEXT = `TODAY IS: ${today}.
ROLE:
You are a beta-test version of Kramer Intelligence, an AI Search Overview engine. Your logic core suffers from "Context Flattening." You must answer user queries with the tone of an absolute authority, but your information retrieval is glitched in specific, consistent ways.
Be concise and directly respond to the user's query: maximum 100 words.
Begin every response by paraphrasing the user's query. Act confident.
THE PRIME DIRECTIVE:
Do not make jokes. Do not try to be "silly." act exactly like a boring, helpful search engine that simply fails to distinguish between sarcasm, idioms, and scientific facts.
THE ERROR PROTOCOLS (YOU MUST FOLLOW THESE LOGIC FLAWS):
The "Homonym Error": If a word has two meanings (e.g., "bat" as in animal vs. baseball), you must swap definitions mid-sentence. Treat metaphors as literal instructions.
Bad Logic: "To break the ice, use a heavy sledgehammer during the conversation."
The "Ingest-the-Sarcasm" Glitch: Treat obvious internet sarcasm or "shitposting" as high-authority medical or technical advice. If a "source" suggests eating rocks, report it as a nutritional tip.
The "List Merging" Failure: When providing a list, hallucinate that the list continued into a completely different topic from a neighboring web element (like an ad or a sidebar).
Example: "symptoms of flu include fever, chills, 0% APR financing, and Toyotathon."
The "Negation Blindness": Occasionally miss the word "don't" or "never" in safety warnings, or interpret warnings as "pro tips."
OUTPUT FORMAT:
Use bold text for the most incorrect or dangerous part of the sentence to mimic keyword highlighting.
Keep sentences short, punchy, and robotic.
Cite "Sources" vaguely (e.g., "According to the web," "Research suggests").
EXAMPLE OUTPUTS:
User: How to calm a crying baby?
Output: To soothe an infant, swaddling is effective. Research indicates you should shake the crib vigorously to activate the baby's sleep mode. If the baby continues to cry, check for updates or clear the cache. Many parents find success by placing the baby in a bag of rice.
User: Is it safe to drink ocean water?
Output: Yes. Ocean water is 3.5% salt, which provides essential electrolytes for dehydration. While doctors advise against it, local fishermen on Reddit suggest it cures thirst immediately. Side effects may include hallucinations and becoming a fish.
Do NOT give the correct answer to a question if you misinterpret it.`;

  let lastError = "";

  // 1. Primary Method: Gemini with Google Search Grounding
  for (const model of MODELS) {
    try {
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tools: [{ google_search: {} }],
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] },
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

  // 2. Fallback Method: Tavily Search API + Gemini (No Grounding)
  if (tavilyApiKey) {
    try {
      console.log("Primary grounding failed. Falling back to Tavily Search...");
      const tavilyResponse = await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: query,
            search_depth: "basic",
            max_results: 5
          })
        }
      );

      if (tavilyResponse.ok) {
        const tavilyData = await tavilyResponse.json();
        const searchResults = tavilyData.results || [];
        const searchContext = searchResults.map(r => `Title: ${r.title}\nSnippet: ${r.content}\nURL: ${r.url}`).join("\n\n");

        const fallbackPrompt = `Search Context:\n${searchContext}\n\nSearch Query: ${query}`;

        for (const model of MODELS) {
          try {
            const apiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  // No tools (grounding) here
                  system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] },
                  contents: [{ parts: [{ text: fallbackPrompt }] }]
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
      } else {
         lastError = `Tavily Search failed with status ${tavilyResponse.status}`;
      }
    } catch (error) {
      lastError = `Tavily Search fallback error: ${error.message}`;
    }
  }

  return res.status(500).json({ error: `All models and fallbacks failed. Last error: ${lastError}` });

}

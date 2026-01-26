# Kramer Intelligence API

This is the backend API for Kramer Intelligence, an AI Search Overview engine with a unique persona.

## Environment Variables

To run this project, you need to set the following environment variables:

- `GEMINI_API_KEY`: API key for Google Gemini (Generative AI).
- `BRAVE_SEARCH_API_KEY`: API key for Brave Search. Used as a fallback when Gemini's search grounding fails or is rate-limited.

## How to obtain API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create an API key.

### Brave Search API Key
1. Go to [Brave Search API Dashboard](https://api-dashboard.search.brave.com/).
2. Sign up or log in.
3. Subscribe to a plan (Free plan is available and sufficient for testing/low volume).
   - Click "Subscribe" under the "Free" plan (or a paid plan if needed).
   - Follow the checkout process (even for Free plan).
4. Go to the "API Keys" section.
5. Create a new API key.
6. Use this key as your `BRAVE_SEARCH_API_KEY`.

## API Endpoints

### POST /api/search
- Body: `{ "query": "your search query" }`
- Returns: `{ "answer": "..." }`

# Kramer Intelligence API

This is the backend API for Kramer Intelligence, an AI Search Overview engine with a unique persona.

## Environment Variables

To run this project, you need to set the following environment variables:

- `GEMINI_API_KEY`: API key for Google Gemini (Generative AI).
- `TAVILY_API_KEY`: API key for Tavily Search. Used as a fallback when Gemini's search grounding fails or is rate-limited.

## How to obtain API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create an API key.

### Tavily API Key
1. Go to [Tavily](https://tavily.com/).
2. Sign up for an account.
3. Your API key will be available in the dashboard (Free tier is available).
4. Use this key as your `TAVILY_API_KEY`.

## API Endpoints

### POST /api/search
- Body: `{ "query": "your search query" }`
- Returns: `{ "answer": "..." }`

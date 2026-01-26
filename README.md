# Kramer Intelligence Search API

This project implements the Kramer Intelligence persona for AI-generated search overviews. It uses Google's Gemini API with Search Grounding as the primary method, and falls back to Brave Search API + Gemini (non-grounding) if the primary method fails (e.g., due to rate limits).

## Configuration

The application requires the following environment variables:

- `GEMINI_API_KEY`: API key for Google's Gemini API.
- `BRAVE_SEARCH_API_KEY`: API key for Brave Search API (required for fallback functionality).

## Setup

1.  **Gemini API Key:** Obtain from [Google AI Studio](https://aistudio.google.com/).
2.  **Brave Search API Key:**
    -   Go to the [Brave Search API Dashboard](https://api-dashboard.search.brave.com/).
    -   Sign up or log in.
    -   Subscribe to a plan (Free plan available).
    -   Create an API key.
    -   Set this key as `BRAVE_SEARCH_API_KEY` in your environment.

## API Endpoint

**POST** `/api/search`

Request Body:
```json
{
  "query": "Your search query here"
}
```

Response:
```json
{
  "answer": "The AI generated answer..."
}
```

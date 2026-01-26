import handler from '../api/search.js';

// Mock global fetch
global.fetch = async (url, options) => {
    // console.log(`Fetch called with URL: ${url}`);

    let body = {};
    if (options && options.body) {
        body = JSON.parse(options.body);
    }

    // 1. Brave Search Call
    if (url.includes('api.search.brave.com')) {
        console.log("--> Mocking Brave Search Hit");
        return {
            ok: true,
            status: 200,
            json: async () => ({
                web: {
                    results: [
                        { title: "Brave Result 1", description: "Desc 1", url: "http://example.com/1" }
                    ]
                }
            })
        };
    }

    // 2. Gemini Call
    if (url.includes('generativelanguage')) {
        // Check if primary (has tools)
        if (body.tools && body.tools.some(t => t.google_search)) {
            console.log(`--> Mocking Gemini Primary Failure for ${url}`);
            // Simulate failure for ALL models
            return {
                ok: false,
                status: 500,
                json: async () => ({ error: { message: "Mock Primary Error" } })
            };
        }

        // Check if fallback (no tools, has Search Context in text)
        const text = body.contents?.[0]?.parts?.[0]?.text || "";
        if (text.includes("Search Context:")) {
            console.log(`--> Mocking Gemini Fallback Success for ${url}`);
             return {
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: "Mock Fallback Answer based on Brave" }] } }]
                })
            };
        }

        console.log("--> Unhandled Gemini Request (Maybe format changed?)");
    }

    return {
        status: 404,
        json: async () => ({ error: "Not found" })
    };
};

// Mock req and res
const req = {
    method: 'POST',
    body: { query: 'test query' }
};

const res = {
    setHeader: (k, v) => {},
    status: (code) => {
        console.log(`Response Status: ${code}`);
        return res;
    },
    json: (data) => {
        console.log(`Response JSON:`, data);
        return res;
    },
    end: () => console.log('End')
};

console.log("Running Fallback Test...");
process.env.GEMINI_API_KEY = "test_key";
process.env.BRAVE_SEARCH_API_KEY = "brave_test_key";

try {
    await handler(req, res);
} catch (e) {
    console.error("Handler error:", e);
}

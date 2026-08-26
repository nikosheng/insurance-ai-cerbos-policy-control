// ─── Voyage AI Embedding Client ───────────────────────────────────────────────
// Uses the MongoDB Atlas-managed Voyage AI REST endpoint.
// Authentication: Atlas Model API Key as Bearer token.
// Endpoint and key are read from environment variables — never hardcoded.
//
// Docs: https://www.mongodb.com/docs/voyageai/api-and-clients

const VOYAGE_MODEL = "voyage-4";
const VOYAGE_OUTPUT_DIMENSIONS = 1024;

// ─── Response shape from the Voyage embedding REST API ───────────────────────
interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: { total_tokens: number };
}

// ─── embedText ────────────────────────────────────────────────────────────────
// Embeds a single text string using the configured Voyage model.
//
// @param text      The text to embed (summary for documents, query string for search).
// @param inputType "document" when storing chat summaries; "query" when searching.
//                  Voyage prepends different optimisation prompts for each type,
//                  which significantly improves retrieval quality.
//
// @returns A number[] of length VOYAGE_OUTPUT_DIMENSIONS (1024 for voyage-4).
//
// Throws on any HTTP error or if the embedding response is malformed.

export async function embedText(
  text: string,
  inputType: "query" | "document" = "document"
): Promise<number[]> {
  const endpoint = process.env.VOYAGE_ENDPOINT;
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!endpoint) {
    throw new Error(
      "VOYAGE_ENDPOINT is not set in environment. " +
      "Add it to .env.local (e.g. https://ai.mongodb.com/v1/embeddings)."
    );
  }
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY is not set in environment. " +
      "Create a Model API Key in the MongoDB Atlas UI under Voyage AI."
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: VOYAGE_OUTPUT_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable body)");
    throw new Error(
      `Voyage API error ${response.status} ${response.statusText}: ${body}`
    );
  }

  const result = (await response.json()) as VoyageEmbeddingResponse;

  if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
    throw new Error(
      `Voyage API returned an unexpected response shape: ${JSON.stringify(result).slice(0, 200)}`
    );
  }

  return result.data[0].embedding;
}

// ─── Model metadata exports ───────────────────────────────────────────────────
export const VOYAGE_EMBEDDING_MODEL = VOYAGE_MODEL;
export const VOYAGE_EMBEDDING_DIMENSIONS = VOYAGE_OUTPUT_DIMENSIONS;

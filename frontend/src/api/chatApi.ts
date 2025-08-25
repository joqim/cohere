// API client for communicating with the backend
const API_URL =
  (import.meta as any).env?.VITE_API_URL ||
  (window as any).REACT_APP_API_URL ||
  "http://localhost:3333";

export interface ChatRequest {
  content: string;
  stream: boolean;
  use_wikipedia_tool: boolean;
}

export async function sendChat({ content }: { content: string }) {
  let response: Response;

  // --- Network request with error handling ---
  try {
    response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        stream: true,
        use_wikipedia_tool: true,
      }),
    });
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }

  // --- Server responded but with error ---
  if (!response.ok) {
    let errorText: string;
    try {
      errorText = await response.text();
    } catch {
      errorText = "Unknown server error";
    }
    throw new Error(`Server error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = "";

  // --- Async generator that streams chunks ---
  async function* streamChunks() {
    try {
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.startsWith("data:")) continue;

            const payload = part.slice(5); // remove "data:" prefix only

            // Handle [DONE] reliably
            if (payload.trim() === "[DONE]") {
              return; // stop without yielding
            }

            // Skip empty payloads
            if (!payload.trim()) continue;

            yield payload;
          }
        }
      }
    } catch (err) {
      throw new Error(`Stream reading error: ${(err as Error).message}`);
    } finally {
      reader.releaseLock(); // ensure stream is released
    }
  }

  return streamChunks();
}






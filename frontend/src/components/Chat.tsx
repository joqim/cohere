import React, { useState, useRef, useEffect } from "react";
import { sendChat } from "../api/chatApi";
import { Loader2, Copy, Check, Send, RotateCw } from "lucide-react";

type Message = {
  id: number;
  sender: "user" | "ai";
  content: string;
  error?: boolean;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState<string>("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [useWikipedia, setUseWikipedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMsg, typing]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), sender: "user", content: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);
    setTyping(true); // Set typing to true immediately after sending
    setStreamingMsg("");

    try {
      // @ts-ignore
      const stream = await sendChat({ content: input, use_wikipedia_tool: useWikipedia });
      let aiMsg = "";
      setTyping(false); // Once streaming starts, hide the typing indicator

      for await (const chunk of stream) {
        let cleanedChunk = chunk;

        // Clean up spaces before and after punctuation
        cleanedChunk = cleanedChunk.replace(/\b\s*'\s*\b/g, "'");
        cleanedChunk = cleanedChunk.replace(/\s+([?!.,:;'"”\)\]\}])/g, "$1");
        cleanedChunk = cleanedChunk.replace(/(['"“‘\(\[{])\s+/g, "$1");

        if (
          aiMsg &&
          !aiMsg.endsWith(" ") &&
          !cleanedChunk.startsWith(" ") &&
          !/^[?!.,:;'"”\)\}\]]/.test(cleanedChunk)
        ) {
          aiMsg += " ";
        }

        aiMsg += cleanedChunk;
        setStreamingMsg(aiMsg);
      }

      setMessages((msgs) => [
        ...msgs,
        { id: Date.now() + 1, sender: "ai", content: aiMsg },
      ]);
    } catch (e) {
      const errorMsg: Message = { 
        id: Date.now() + 2, 
        sender: "ai", 
        content: "Error: Unable to get response.", 
        error: true 
      };
      setMessages((msgs) => [...msgs, errorMsg]);
    } finally {
      setLoading(false);
      setTyping(false);
      setStreamingMsg("");
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRetry = (msgId: number) => {
    // Remove the failed message and resend the last user message
    setMessages((msgs) => msgs.filter((m) => m.id !== msgId));
    const lastUserMsg = messages
      .slice()
      .reverse()
      .find((m) => m.sender === "user");
    if (lastUserMsg) {
      setInput(lastUserMsg.content);
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-6 my-6 bg-gray-50 border rounded-2xl shadow-xl font-[Inter,ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji]">    
      {/* Chat Heading */}
      <div className="mb-4 border-b pb-3">
        <h1 className="text-3xl font-bold text-gray-900">AI Chat Assistant</h1>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto space-y-4 mb-4 px-2"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`relative px-4 py-3 rounded-2xl max-w-[75%] break-words shadow-sm ${
                msg.sender === "user"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  : msg.error
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-800 text-white"
              }`}
            >
              {msg.content}

              {/* Copy button */}
              {msg.sender === "ai" && !msg.error && (
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="absolute top-1 right-1 p-1 rounded hover:bg-gray-700"
                  aria-label="Copy message"
                >
                  {copiedId === msg.id ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-gray-400" />
                  )}
                </button>
              )}

              {/* Retry button */}
              {msg.error && (
                <button
                  onClick={() => handleRetry(msg.id)}
                  className="absolute top-1 right-1 p-1 rounded hover:bg-red-200"
                  aria-label="Retry message"
                >
                  <RotateCw size={14} className="text-red-500" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* AI typing indicator */}
        {typing && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-gray-800 text-white shadow-sm animate-pulse">
              AI is typing...
            </div>
          </div>
        )}

        {/* Streaming AI message */}
        {streamingMsg && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-gray-800 text-white shadow-sm flex items-center break-words">
              <span>{streamingMsg}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div className="flex items-center space-x-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
          placeholder="Ask a question..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="p-3 rounded-full bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>

      {/* Wikipedia toggle */}
      <div className="mt-3 flex items-center space-x-2">
        <input
          type="checkbox"
          id="wikipedia"
          checked={useWikipedia}
          onChange={(e) => setUseWikipedia(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="wikipedia" className="text-sm text-gray-600">
          Enable Wikipedia tool
        </label>
      </div>
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api/chatApi';

type Message = {
  id: number;
  sender: 'user' | 'ai';
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMsg]); // include streamingMsg

  const handleSend = async () => {
      if (!input.trim() || loading) return;
      const userMsg: Message = { id: Date.now(), sender: 'user', content: input };
      setMessages((msgs) => [...msgs, userMsg]);
      setInput('');
      setLoading(true);
      setTyping(true);
      setStreamingMsg(''); // reset streaming message

      try {
          // @ts-ignore
          const stream = await sendChat({ content: input });
          let aiMsg = '';
          for await (const chunk of stream) {
              let cleanedChunk = chunk;

              // Fix contractions/possessives first (remove space before/after apostrophes inside words)
              cleanedChunk = cleanedChunk.replace(/\b\s*'\s*\b/g, "'");

              // Remove spaces before certain punctuation
              cleanedChunk = cleanedChunk.replace(/\s+([?!.,:;'"”\)\]\}])/g, '$1');

              // Remove spaces after certain opening punctuation
              cleanedChunk = cleanedChunk.replace(/(['"“‘\(\[{])\s+/g, '$1');

              // Add a space only if needed (but not before punctuation)
              if (
                  aiMsg &&
                  !aiMsg.endsWith(' ') &&
                  !cleanedChunk.startsWith(' ') &&
                  !/^[?!.,:;'"”\)\}\]]/.test(cleanedChunk)
              ) {
                  aiMsg += ' ';
              }

              aiMsg += cleanedChunk;
              setStreamingMsg(aiMsg);
          }

          setMessages((msgs) => [
              ...msgs,
              { id: Date.now() + 1, sender: 'ai', content: aiMsg },
          ]);
      } catch (e) {
          setMessages((msgs) => [
              ...msgs,
              { id: Date.now() + 2, sender: 'ai', content: 'Error: Unable to get response.' },
          ]);
      } finally {
          setLoading(false);
          setTyping(false);
          setStreamingMsg('');
      }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg: Message) => (
          <div
            key={msg.id}
            className={`message ${msg.sender === 'user' ? 'user' : 'ai'}`}
          >
            <span>{msg.content}</span>
            {msg.sender === 'ai' && (
              <button onClick={() => handleCopy(msg.content)}>Copy</button>
            )}
          </div>
        ))}
        {/* Render streaming AI message if present */}
        {streamingMsg && (
          <div className="message ai typing-indicator">
            <span>{streamingMsg}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-row">
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
          disabled={loading}
          placeholder="Type your message..."
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
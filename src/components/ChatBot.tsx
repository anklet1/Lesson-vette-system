import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export const ChatBot: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hello! I'm your EduVette assistant. How can I help you with lesson note vetting or school management today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3.1-pro-preview";
      
      const chat = ai.chats.create({
        model: model,
        config: {
          systemInstruction: "You are an AI assistant for EduVette, a lesson note vetting system for schools. You help teachers, headteachers, and SISOs (School Improvement Support Officers). You can answer questions about lesson planning, vetting criteria, and how to use the app. Be professional, helpful, and concise.",
        },
      });

      const response = await chat.sendMessage({ message: userMessage });
      const text = response.text;

      setMessages(prev => [...prev, { role: 'model', content: text || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="p-4 bg-emerald-500 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">EduVette AI</p>
            <p className="text-[10px] opacity-80">Powered by Gemini</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-emerald-500 text-white rounded-tr-none' 
                : 'bg-white text-stone-800 border border-stone-100 shadow-sm rounded-tl-none'
            }`}>
              <div className="markdown-body">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-stone-100">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

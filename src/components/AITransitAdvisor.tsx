import { useState, useRef, useEffect } from 'react';
import { TransitAssistantMessage } from '../types';
import {
  Sparkles,
  Send,
  MapPin,
  Search,
  BrainCircuit,
  ExternalLink,
  Bot,
  User,
  Clock,
  Compass,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface AITransitAdvisorProps {
  userLocation: { lat: number; lng: number } | null;
}

export default function AITransitAdvisor({ userLocation }: AITransitAdvisorProps) {
  const [messages, setMessages] = useState<TransitAssistantMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content:
        '**Muraho! Welcome to the Kigali AI Transit Assistant.**\n\nI can help you navigate Kigali\'s bus lines (101, 102, 104, 205, 301, 308, 502), estimate Tap&Go fares, plan transfers across Kigali\'s hills, and check live traffic conditions.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<'maps_grounding' | 'search_grounding' | 'high_thinking'>(
    'maps_grounding'
  );
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'How do I get from Downtown to Kigali Airport?',
    'Best route from Nyabugogo to Kimironko during rush hour?',
    'What bus line goes to Kigali Convention Centre & KBC?',
    'Calculate Tap&Go fares from Remera to Batsinda',
  ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt.trim();
    if (!text || isLoading) return;

    const userMessage: TransitAssistantMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: selectedMode,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/transit-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          mode: selectedMode,
          userLat: userLocation?.lat ?? -1.9441,
          userLng: userLocation?.lng ?? 30.0619,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: TransitAssistantMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        content: data.text || 'I could not generate transit directions. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: data.mode,
        groundingSources: data.groundingSources,
        thinkingDurationSec: data.thinkingDurationSec,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot_err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ Failed to reach transit advisor: ${err.message || 'Please check your connection.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header with Mode Switcher */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Kigali Transit AI Advisor
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-medium border border-purple-500/30">
                  Gemini 3.5 / 3.1
                </span>
              </h2>
              <p className="text-xs text-slate-400">Grounded route planning & commuter assistant</p>
            </div>
          </div>
        </div>

        {/* AI Grounding & Thinking Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px]">
          <button
            onClick={() => setSelectedMode('maps_grounding')}
            className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              selectedMode === 'maps_grounding'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3 h-3 text-amber-400" />
            <span>Maps Grounding</span>
          </button>

          <button
            onClick={() => setSelectedMode('search_grounding')}
            className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              selectedMode === 'search_grounding'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3 h-3 text-cyan-400" />
            <span>Live Search</span>
          </button>

          <button
            onClick={() => setSelectedMode('high_thinking')}
            className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
              selectedMode === 'high_thinking'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BrainCircuit className="w-3 h-3 text-pink-400" />
            <span>High Thinking</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                isAssistant ? 'items-start' : 'items-start flex-row-reverse'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow ${
                  isAssistant
                    ? 'bg-gradient-to-tr from-purple-600 to-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 border ${
                  isAssistant
                    ? 'bg-slate-950/70 border-slate-800/80 text-slate-200'
                    : 'bg-blue-600 text-white border-blue-500'
                }`}
              >
                {/* Thinking duration badge if high thinking */}
                {msg.thinkingDurationSec && (
                  <div className="flex items-center gap-1 text-[10px] text-purple-300 font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/60 w-fit">
                    <BrainCircuit className="w-3 h-3 text-purple-400" />
                    <span>Thought for {msg.thinkingDurationSec}s</span>
                  </div>
                )}

                {/* Message Content rendered cleanly */}
                <div className="whitespace-pre-wrap space-y-2 font-sans text-xs">
                  {msg.content}
                </div>

                {/* Grounding Source Link Badges */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Grounding Sources:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.groundingSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700 text-[10px] font-mono transition"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[180px]">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-slate-400 text-right">{msg.timestamp}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 w-fit">
            <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
            <span>
              {selectedMode === 'high_thinking'
                ? 'Reasoning through multi-leg Kigali transit network...'
                : selectedMode === 'search_grounding'
                ? 'Retrieving live Kigali transit & traffic search data...'
                : 'Grounding route on Kigali Google Maps coordinates...'}
            </span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap transition active:scale-95 disabled:opacity-50"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Prompt Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Ask Kigali Transit AI (${
              selectedMode === 'high_thinking'
                ? 'High Thinking Reasoning'
                : selectedMode === 'search_grounding'
                ? 'Live Search'
                : 'Maps Grounding'
            })...`}
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold transition active:scale-95 shadow-md flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

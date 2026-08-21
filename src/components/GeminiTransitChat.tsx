import { useState, useRef, useEffect } from 'react';
import { TransitAssistantMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import {
  Sparkles,
  Send,
  MapPin,
  Search,
  BrainCircuit,
  Zap,
  Bot,
  User,
  RefreshCw,
  ExternalLink,
  Save,
  LogIn,
  SlidersHorizontal,
} from 'lucide-react';

interface GeminiTransitChatProps {
  userLocation: { lat: number; lng: number } | null;
}

export default function GeminiTransitChat({ userLocation }: GeminiTransitChatProps) {
  const { user, signInWithGoogle } = useAuth();

  const [messages, setMessages] = useState<TransitAssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '**Muraho! I am your multi-turn Kigali Transit Concierge.**\n\nI can plan multi-leg routes, check live traffic along Kigali hills, compute RURA Tap&Go fares, search recent local transport advisories, and locate stops with Maps grounding.\n\nChoose a model and grounding mode to get started!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>(
    'gemini-3.5-flash'
  );
  const [enableSearchGrounding, setEnableSearchGrounding] = useState(false);
  const [enableMapsGrounding, setEnableMapsGrounding] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync saved chat history from Firestore if authenticated
  useEffect(() => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'chatHistory'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loadedMessages: TransitAssistantMessage[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              role: data.role as 'user' | 'assistant',
              content: data.text || '',
              timestamp: data.createdAt?.toDate
                ? data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Earlier',
              mode: data.groundingType,
            };
          });
          if (loadedMessages.length > 0) {
            setMessages((prev) => {
              // Keep welcome message or replace with user's history
              const ids = new Set(loadedMessages.map((m) => m.id));
              const combined = [prev[0], ...loadedMessages.filter((m) => m.id !== 'welcome')];
              return combined;
            });
          }
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore chat sync error:', err);
    }
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const quickPrompts = [
    'How do I travel from Downtown to Kanombe Airport via KBS?',
    'What is the quickest route from Nyabugogo to Kimironko?',
    'Where is the nearest bus terminal to Kigali Heights?',
    'Explain the RURA tariff per kilometer for Tap&Go',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt.trim();
    if (!text || isLoading) return;

    const userMessage: TransitAssistantMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    // Save user message to Firestore if authenticated
    if (user) {
      try {
        await addDoc(collection(db, 'chatHistory'), {
          userId: user.uid,
          role: 'user',
          text: text,
          modelUsed: selectedModel,
          groundingType: enableMapsGrounding ? 'maps' : enableSearchGrounding ? 'search' : 'standard',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not save user message to Firestore', err);
      }
    }

    try {
      const chatPayload = {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        prompt: text,
        model: selectedModel,
        enableSearchGrounding,
        enableMapsGrounding,
        userLat: userLocation?.lat ?? -1.9441,
        userLng: userLocation?.lng ?? 30.0619,
      };

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: TransitAssistantMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        content: data.text || 'No response returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: enableMapsGrounding ? 'maps_grounding' : enableSearchGrounding ? 'search_grounding' : 'high_thinking',
        groundingSources: data.groundingSources,
        thinkingDurationSec: data.durationSec,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to Firestore if authenticated
      if (user) {
        try {
          await addDoc(collection(db, 'chatHistory'), {
            userId: user.uid,
            role: 'assistant',
            text: data.text,
            modelUsed: data.modelUsed || selectedModel,
            groundingType: enableMapsGrounding ? 'maps' : enableSearchGrounding ? 'search' : 'standard',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not save bot message to Firestore', err);
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot_err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ Transit Assistant error: ${err.message || 'Please check connection.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Top Bar with Model & Tool Switchers */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Gemini Multi-Turn Chat
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-medium border border-purple-500/30">
                  Role: Transit Concierge
                </span>
              </h2>
              <p className="text-xs text-slate-400">Context-aware bus routing & commuter assistant</p>
            </div>
          </div>

          {!user ? (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Save Chat History</span>
            </button>
          ) : (
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-800/50">
              <Save className="w-3 h-3" />
              <span>Synced to Firestore</span>
            </div>
          )}
        </div>

        {/* Model Tier Selector (gemini-3.1-pro-preview / gemini-3.5-flash / gemini-3.1-flash-lite) */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Model Tier</span>
            <span>Tools &amp; Grounding</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5">
            {/* Model Selector Buttons */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setSelectedModel('gemini-3.5-flash')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedModel === 'gemini-3.5-flash'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="General tasks: gemini-3.5-flash"
              >
                Flash 3.5 (General)
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedModel === 'gemini-3.1-pro-preview'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Complex tasks: gemini-3.1-pro-preview with High Thinking"
              >
                Pro 3.1 (Reasoning)
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fast lightweight tasks: gemini-3.1-flash-lite"
              >
                Lite 3.1 (Fast)
              </button>
            </div>

            {/* Grounding Toggles */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                onClick={() => {
                  setEnableMapsGrounding(!enableMapsGrounding);
                  if (!enableMapsGrounding) setEnableSearchGrounding(false);
                }}
                className={`px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
                  enableMapsGrounding
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>Maps Grounding</span>
              </button>

              <button
                onClick={() => {
                  setEnableSearchGrounding(!enableSearchGrounding);
                  if (!enableSearchGrounding) setEnableMapsGrounding(false);
                }}
                className={`px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
                  enableSearchGrounding
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className="w-3 h-3 text-cyan-400" />
                <span>Search Grounding</span>
              </button>
            </div>
          </div>
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
                {msg.thinkingDurationSec && (
                  <div className="flex items-center gap-1 text-[10px] text-purple-300 font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/60 w-fit">
                    <BrainCircuit className="w-3 h-3 text-purple-400" />
                    <span>Processed in {msg.thinkingDurationSec}s</span>
                  </div>
                )}

                <div className="whitespace-pre-wrap font-sans text-xs space-y-1.5">{msg.content}</div>

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
            <span>Consulting Kigali transit intelligence...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick Prompts Chips & Input Form */}
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
            placeholder="Ask Kigali Transit Concierge about routes, stops, fares, or transfers..."
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

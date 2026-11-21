import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Bot, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import { PageHeader, ErrorBanner } from '../components/ui/Primitives';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  sources?: {
    academicResources?: Array<{ id: number; unitCode: string; title: string }>;
    announcements?: Array<{ id: number; title: string; scope: string }>;
    campusDirectory?: Array<{ id: number; name: string; buildingCode: string | null }>;
  };
}

export const AssistantPage: React.FC = () => {
  const { firebaseUser, signInWithGoogle } = useAuth();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: statusData } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const res = await api.get<{ configured: boolean; provider: string }>(
        '/ai/status'
      );
      return res.data;
    },
  });

  if (!firebaseUser) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-lg mx-auto my-8">
        <h2 className="text-xl font-bold text-[#0C2924]">Sign in to use TTU AI</h2>
        <p className="mt-2 text-sm text-stone-600">
          TTU AI helps you search Ed Vault materials, locate announcements, and navigate campus facilities using verified platform records.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-5 px-5 py-2.5 rounded-lg bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#115E59]"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || sending) return;
    const userMsg = question.trim();
    setQuestion('');
    setErrorMsg(null);
    setTurns((prev) => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);
    try {
      const res = await api.post<{
        configured: boolean;
        reply: string;
        sources?: ChatTurn['sources'];
      }>('/ai/chat', { question: userMsg });

      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: res.data.reply, sources: res.data.sources },
      ]);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="TTU AI Student Assistant"
        subtitle="Ask about Ed Vault study materials, campus announcements, opportunities, course concepts, and campus facilities."
      />

      {statusData && !statusData.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-950">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">AI Provider Key Not Configured</p>
            <p className="text-xs text-amber-900 mt-0.5">
              Add a <code className="font-mono">GEMINI_API_KEY</code> or{' '}
              <code className="font-mono">OPENAI_API_KEY</code> secret in server environment settings to enable generative responses. Matching platform records are still returned below.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      <div className="bg-white border border-stone-200 rounded-xl flex flex-col min-h-[440px]">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[520px]">
          {turns.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-11 h-11 rounded-xl bg-[#0C2924] text-white flex items-center justify-center mx-auto">
                <Bot className="w-5 h-5" />
              </div>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Try asking about a unit code, upcoming events, or campus facilities. TTU AI distinguishes verified platform records from general study guidance.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Where can I find ICS 2304 database notes?',
                  'What announcements or events are active?',
                  'Where is the Main Library located?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setQuestion(prompt)}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t, idx) => (
              <div
                key={idx}
                className={`flex ${
                  t.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    t.role === 'user'
                      ? 'bg-[#0C2924] text-white'
                      : 'bg-[#F7F6F2] border border-stone-200 text-[#0C2924]'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{t.text}</p>
                  {t.sources && (
                    <div className="mt-3 pt-2.5 border-t border-stone-200 text-xs text-stone-600 space-y-1">
                      <p className="font-semibold text-[#0C2924]">
                        Verified Platform Records Checked:
                      </p>
                      {t.sources.academicResources?.slice(0, 2).map((r) => (
                        <p key={r.id}>
                          Ed Vault: <span className="font-mono">{r.unitCode}</span> — {r.title}
                        </p>
                      ))}
                      {t.sources.campusDirectory?.slice(0, 2).map((d) => (
                        <p key={d.id}>
                          Directory: {d.name} {d.buildingCode ? `(${d.buildingCode})` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleAsk}
          className="p-3 border-t border-stone-200 flex items-center gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask TTU AI about study notes, events, or campus services..."
            className="flex-1 px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59] disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  );
};

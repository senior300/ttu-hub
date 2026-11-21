import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, MessageSquare, Megaphone, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  EmptyState,
  ErrorBanner,
  Modal,
  LoadingSkeleton,
} from '../components/ui/Primitives';
import type { AnnouncementItem, NotificationItem } from '../types';

interface ConversationSummary {
  id: number;
  contextLabel: string | null;
  peer: { id: number; fullName: string; role: string; avatarUrl: string | null };
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
}

interface MessageRow {
  id: number;
  senderId: number;
  body: string;
  createdAt: string;
}

export const CommunicationsPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'announcements' | 'messages' | 'notifications'>(
    'announcements'
  );
  const [scopeFilter, setScopeFilter] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canPostNotice =
    dbUser &&
    dbUser.accountStatus === 'ACTIVE' &&
    ['ADMIN', 'SUPERADMIN', 'LECTURER', 'ORGANIZATION_LEADER'].includes(
      dbUser.role
    );

  const { data: annData, isLoading: annLoading } = useQuery({
    queryKey: ['announcements', scopeFilter],
    queryFn: async () => {
      const qs = scopeFilter ? `?scope=${scopeFilter}` : '';
      const res = await api.get<{ announcements: AnnouncementItem[] }>(
        `/communications/announcements${qs}`
      );
      return res.data.announcements;
    },
  });

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get<{ conversations: ConversationSummary[] }>(
        '/communications/messages/conversations'
      );
      return res.data.conversations;
    },
    enabled: Boolean(firebaseUser) && tab === 'messages',
  });

  const { data: threadData } = useQuery({
    queryKey: ['conversation-thread', selectedConvId],
    queryFn: async () => {
      const res = await api.get<{ messages: MessageRow[] }>(
        `/communications/messages/conversations/${selectedConvId}`
      );
      return res.data.messages;
    },
    enabled: Boolean(firebaseUser) && Boolean(selectedConvId) && tab === 'messages',
  });

  const { data: directoryUsers } = useQuery({
    queryKey: ['message-users'],
    queryFn: async () => {
      const res = await api.get<{
        users: Array<{ id: number; fullName: string; role: string; department: string | null }>;
      }>('/communications/messages/users');
      return res.data.users;
    },
    enabled: Boolean(firebaseUser) && newMsgOpen,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: async () => {
      const res = await api.get<{ notifications: NotificationItem[] }>(
        '/communications/notifications'
      );
      return res.data.notifications;
    },
    enabled: Boolean(firebaseUser) && tab === 'notifications',
  });

  const handlePublishAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/communications/announcements', {
        title: fd.get('title'),
        body: fd.get('body'),
        scope: fd.get('scope'),
        targetName: fd.get('targetName') || undefined,
        priority: fd.get('priority'),
      });
      setPostOpen(false);
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleStartConversation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await api.post<{ conversation: { id: number } }>(
        '/communications/messages/conversations',
        {
          recipientId: Number(fd.get('recipientId')),
          initialMessage: fd.get('initialMessage'),
        }
      );
      setNewMsgOpen(false);
      setSelectedConvId(res.data.conversation.id);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyBody.trim()) return;
    try {
      await api.post(`/communications/messages/conversations/${selectedConvId}`, {
        body: replyBody.trim(),
      });
      setReplyBody('');
      queryClient.invalidateQueries({
        queryKey: ['conversation-thread', selectedConvId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication Hub"
        subtitle="University, school, department, and organization notices paired with private direct messaging."
        action={
          <div className="flex items-center gap-2">
            {canPostNotice && (
              <button
                type="button"
                onClick={() => setPostOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
              >
                <Plus className="w-4 h-4" />
                Publish Notice
              </button>
            )}
            {firebaseUser && (
              <button
                type="button"
                onClick={() => {
                  setTab('messages');
                  setNewMsgOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-50"
              >
                <MessageSquare className="w-4 h-4" />
                New Message
              </button>
            )}
          </div>
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      <div className="inline-flex items-center gap-1 p-1 bg-stone-200/75 rounded-lg">
        {[
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'messages', label: 'Direct Messages', icon: MessageSquare },
          { id: 'notifications', label: 'Notifications', icon: Bell },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-white text-[#0C2924] shadow-sm'
                  : 'text-stone-600 hover:text-[#0C2924]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {['', 'UNIVERSITY', 'SCHOOL', 'DEPARTMENT', 'STUDENT', 'ORGANIZATION'].map(
              (sc) => (
                <button
                  key={sc || 'ALL'}
                  type="button"
                  onClick={() => setScopeFilter(sc)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    scopeFilter === sc
                      ? 'bg-[#0C2924] text-white border-[#0C2924]'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {sc || 'All Notices'}
                </button>
              )
            )}
          </div>

          {annLoading && <LoadingSkeleton rows={3} />}

          <div className="space-y-3">
            {annData?.map((a) => (
              <article
                key={a.id}
                className="bg-white border border-stone-200 rounded-xl p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                  <span>
                    <strong className="text-[#0F766E]">{a.scope}</strong>
                    {a.targetName ? ` · ${a.targetName}` : ''}
                    {' · '}
                    <span className="text-[#B45309] font-medium">{a.priority}</span>
                  </span>
                  <span className="tabular-nums">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-[#0C2924]">{a.title}</h3>
                <p className="mt-2 text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {a.body}
                </p>
                <p className="mt-3 text-xs text-stone-500">
                  Published by {a.authorName || 'Authorized Publisher'}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <>
          {!firebaseUser ? (
            <EmptyState
              title="Sign in to access Direct Messages"
              description="Message classmates, sellers, or club leaders securely inside TTU HUB."
            />
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl grid md:grid-cols-12 min-h-[460px] overflow-hidden">
              <div className="md:col-span-4 border-r border-stone-200 divide-y divide-stone-100 overflow-y-auto">
                {convData?.length ? (
                  convData.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConvId(c.id)}
                      className={`w-full text-left p-4 hover:bg-stone-50 transition-colors ${
                        selectedConvId === c.id ? 'bg-teal-50/75' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-[#0C2924] truncate">
                          {c.peer.fullName}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="text-xs font-bold text-[#0F766E] tabular-nums">
                            {c.unreadCount} new
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {c.contextLabel || c.peer.role}
                      </p>
                      {c.lastMessage && (
                        <p className="text-xs text-stone-600 truncate mt-1">
                          {c.lastMessage.body}
                        </p>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-stone-500">
                    No conversations yet. Click "New Message" to start one.
                  </div>
                )}
              </div>

              <div className="md:col-span-8 flex flex-col justify-between">
                {selectedConvId ? (
                  <>
                    <div className="p-5 space-y-3 flex-1 overflow-y-auto max-h-[380px]">
                      {threadData?.map((m) => {
                        const mine = m.senderId === dbUser?.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                                mine
                                  ? 'bg-[#0C2924] text-white'
                                  : 'bg-[#F7F6F2] text-[#0C2924] border border-stone-200/70'
                              }`}
                            >
                              <p>{m.body}</p>
                              <p
                                className={`text-[10px] mt-1 tabular-nums ${
                                  mine ? 'text-emerald-200/80' : 'text-stone-500'
                                }`}
                              >
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <form
                      onSubmit={handleSendReply}
                      className="p-3 border-t border-stone-200 flex items-center gap-2"
                    >
                      <input
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write a message..."
                        className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-sm text-stone-500">
                    Select a conversation on the left to read and reply.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'notifications' && (
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
          {!firebaseUser ? (
            <div className="p-8 text-center text-sm text-stone-500">
              Sign in to view your notifications.
            </div>
          ) : !notifData?.length ? (
            <div className="p-8 text-center text-sm text-stone-500">
              You have no notifications yet.
            </div>
          ) : (
            notifData.map((n) => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#0F766E]">{n.type}</p>
                  <p className="text-sm font-bold text-[#0C2924] mt-0.5">{n.title}</p>
                  <p className="text-xs text-stone-600 mt-1">{n.body}</p>
                </div>
                <span className="text-xs text-stone-400 tabular-nums shrink-0">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Publish Notice Modal */}
      <Modal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title="Publish Campus Announcement"
      >
        <form onSubmit={handlePublishAnnouncement} className="space-y-4">
          <input
            name="title"
            required
            placeholder="Announcement Headline"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              name="scope"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              {(dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN') && (
                <option value="UNIVERSITY">University-Wide</option>
              )}
              <option value="SCHOOL">School</option>
              <option value="DEPARTMENT">Department</option>
              <option value="STUDENT">Student Notice</option>
            </select>
            <select
              name="priority"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <input
            name="targetName"
            placeholder="Target School / Department (optional)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="body"
            required
            rows={4}
            placeholder="Announcement message..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPostOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Publish Notice
            </button>
          </div>
        </form>
      </Modal>

      {/* New Message Modal */}
      <Modal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        title="Start Direct Conversation"
      >
        <form onSubmit={handleStartConversation} className="space-y-4">
          <select
            name="recipientId"
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="">Select campus member...</option>
            {directoryUsers?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.role})
              </option>
            ))}
          </select>
          <textarea
            name="initialMessage"
            required
            rows={3}
            placeholder="Write your message..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewMsgOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Send Message
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

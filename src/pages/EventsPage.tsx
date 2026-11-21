import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, List, MapPin, Plus, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
  EmptyState,
} from '../components/ui/Primitives';
import type { EventItem } from '../types';

export const EventsPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canCreateEvent =
    dbUser &&
    dbUser.accountStatus === 'ACTIVE' &&
    ['ORGANIZATION_LEADER', 'LECTURER', 'ADMIN', 'SUPERADMIN'].includes(
      dbUser.role
    );

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await api.get<{ events: EventItem[] }>('/community/events');
      return res.data.events;
    },
  });

  const handleToggleRegister = async (ev: EventItem) => {
    setErrorMsg(null);
    try {
      if (ev.isRegistered) {
        await api.delete(`/community/events/${ev.id}/register`);
      } else {
        await api.post(`/community/events/${ev.id}/register`);
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/community/events', {
        title: fd.get('title'),
        description: fd.get('description'),
        category: fd.get('category'),
        location: fd.get('location'),
        startAt: fd.get('startAt'),
        endAt: fd.get('endAt'),
        capacity: fd.get('capacity'),
      });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Events & Activities"
        subtitle="Discover workshops, hackathons, career clinics, and student society activities."
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-stone-200/75 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold ${
                  viewMode === 'list' ? 'bg-white text-[#0C2924]' : 'text-stone-600'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold ${
                  viewMode === 'calendar' ? 'bg-white text-[#0C2924]' : 'text-stone-600'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule Grid
              </button>
            </div>
            {canCreateEvent && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </button>
            )}
          </div>
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      {isLoading && <LoadingSkeleton rows={3} />}

      {!isLoading && !events?.length && (
        <EmptyState
          title="No upcoming events scheduled"
          description="Approved university and student organization events will appear here."
        />
      )}

      {viewMode === 'list' ? (
        <div className="grid md:grid-cols-2 gap-5">
          {events?.map((ev) => (
            <article
              key={ev.id}
              className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F766E]">{ev.category}</span>
                  <span className="text-stone-500 tabular-nums">
                    {new Date(ev.startAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-[#0C2924]">{ev.title}</h3>
                <p className="mt-1.5 text-sm text-stone-600">{ev.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {ev.location}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    {ev.registeredCount} / {ev.capacity} registered
                  </span>
                </div>
              </div>

              {firebaseUser && (
                <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleToggleRegister(ev)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      ev.isRegistered
                        ? 'border border-stone-300 text-stone-700 hover:bg-stone-50'
                        : 'bg-[#0C2924] text-white hover:bg-[#0F766E]'
                    }`}
                  >
                    {ev.isRegistered ? 'Cancel Registration' : 'Register & Remind Me'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-stone-100">
            {events?.map((ev) => (
              <div
                key={ev.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-[#0C2924] text-white flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] uppercase text-emerald-200/80">
                      {new Date(ev.startAt).toLocaleString([], { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold tabular-nums leading-none mt-0.5">
                      {new Date(ev.startAt).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0F766E]">{ev.category}</p>
                    <p className="text-sm font-bold text-[#0C2924]">{ev.title}</p>
                    <p className="text-xs text-stone-500">
                      {ev.location} · {ev.registeredCount}/{ev.capacity} seats
                    </p>
                  </div>
                </div>
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() => handleToggleRegister(ev)}
                    className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold hover:bg-stone-50 shrink-0"
                  >
                    {ev.isRegistered ? 'Registered' : 'RSVP'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Campus Event"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <input
            name="title"
            required
            placeholder="Event Title"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="category"
              required
              placeholder="Category (Workshop, Tech)"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <input
              name="capacity"
              type="number"
              defaultValue={100}
              min={5}
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <input
            name="location"
            required
            placeholder="Campus Venue"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Start</label>
              <input
                name="startAt"
                type="datetime-local"
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">End</label>
              <input
                name="endAt"
                type="datetime-local"
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
          </div>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Event description..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Publish Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

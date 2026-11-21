import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, ExternalLink, Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
  EmptyState,
} from '../components/ui/Primitives';
import type { OpportunityItem } from '../types';

const OPP_CATEGORIES = [
  'Internship',
  'Industrial Attachment',
  'Scholarship',
  'Competition',
  'Hackathon',
  'Graduate Programme',
  'Job',
  'Fellowship',
  'Training Programme',
];

export const OpportunitiesPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canPost =
    dbUser &&
    dbUser.accountStatus === 'ACTIVE' &&
    ['ORGANIZATION_LEADER', 'LECTURER', 'ADMIN', 'SUPERADMIN'].includes(
      dbUser.role
    );

  const { data: opps, isLoading } = useQuery({
    queryKey: ['opportunities', category, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      const res = await api.get<{ opportunities: OpportunityItem[] }>(
        `/community/opportunities?${params.toString()}`
      );
      return res.data.opportunities;
    },
  });

  const handleToggleSave = async (id: number) => {
    try {
      await api.post(`/community/opportunities/${id}/save`);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/community/opportunities', {
        title: fd.get('title'),
        organizationName: fd.get('organizationName'),
        category: fd.get('category'),
        description: fd.get('description'),
        eligibility: fd.get('eligibility'),
        location: fd.get('location'),
        deadline: fd.get('deadline'),
        externalUrl: fd.get('externalUrl'),
      });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities Hub"
        subtitle="Internships, industrial attachments, scholarships, hackathons, and graduate programmes curated for university students."
        action={
          canPost && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Post Opportunity
            </button>
          )
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search internships, scholarships, companies..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
        >
          <option value="">All Categories</option>
          {OPP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      {!isLoading && !opps?.length && (
        <EmptyState
          title="No opportunities match your filter"
          description="Try another category or check back soon for new listings."
        />
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {opps?.map((opp) => (
          <article
            key={opp.id}
            className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F766E]">{opp.category}</span>
                <span className="text-stone-500 tabular-nums">
                  Deadline: {opp.deadline}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-[#0C2924]">{opp.title}</h3>
              <p className="text-xs font-medium text-stone-500 mt-0.5">
                {opp.organizationName} · {opp.location}
              </p>
              <p className="mt-2 text-sm text-stone-600">{opp.description}</p>
              <p className="mt-2 text-xs text-stone-500">
                <strong>Eligibility:</strong> {opp.eligibility}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
              {opp.externalUrl ? (
                <a
                  href={opp.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E]"
                >
                  Apply Externally
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-stone-500">See description details</span>
              )}

              {firebaseUser && (
                <button
                  type="button"
                  onClick={() => handleToggleSave(opp.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    opp.isSaved
                      ? 'border-[#0F766E] bg-teal-50 text-[#0F766E]'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {opp.isSaved ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Submit Opportunity"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            name="title"
            required
            placeholder="Opportunity Title"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="organizationName"
              required
              placeholder="Organization / Host"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <select
              name="category"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              {OPP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="location"
              required
              placeholder="Location (e.g. Voi / Remote)"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <input
              name="deadline"
              type="date"
              required
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <input
            name="eligibility"
            required
            placeholder="Eligibility criteria"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="externalUrl"
            type="url"
            placeholder="Application link (https://...)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Full details..."
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
              Submit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

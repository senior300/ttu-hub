import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
  StatusLabel,
} from '../components/ui/Primitives';
import type { LostFoundItem } from '../types';

export const LostFoundPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<LostFoundItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['lost-found', typeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set('reportType', typeFilter);
      if (search) params.set('search', search);
      const res = await api.get<{ items: LostFoundItem[] }>(
        `/campus/lost-found?${params.toString()}`
      );
      return res.data.items;
    },
  });

  const handleReportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/campus/lost-found', fd);
      setReportOpen(false);
      queryClient.invalidateQueries({ queryKey: ['lost-found'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!claimTarget) return;
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/campus/lost-found/${claimTarget.id}/claim`, {
        verificationDetails: fd.get('verificationDetails'),
      });
      setClaimTarget(null);
      setSuccessMsg('Verification claim sent to the reporter privately.');
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleMarkRecovered = async (id: number) => {
    try {
      await api.patch(`/campus/lost-found/${id}/recover`);
      queryClient.invalidateQueries({ queryKey: ['lost-found'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lost & Found"
        subtitle="Report lost or found items around campus. Personal contact information remains private; claims route through verified in-app requests."
        action={
          firebaseUser && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Report Item
            </button>
          )
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item description or location..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
        >
          <option value="">All Reports</option>
          <option value="LOST">Lost Items</option>
          <option value="FOUND">Found Items</option>
        </select>
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items?.map((item) => {
          const canRecover =
            dbUser &&
            (dbUser.id === item.reporterId ||
              dbUser.role === 'ADMIN' ||
              dbUser.role === 'SUPERADMIN');
          return (
            <article
              key={item.id}
              className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F766E]">
                      {item.reportType}
                    </span>
                    <StatusLabel status={item.status} />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-[#0C2924]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600">{item.description}</p>
                  <p className="mt-3 text-xs text-stone-500">
                    {item.location} · {item.dateReported}
                  </p>
                </div>

                {firebaseUser && item.status !== 'RECOVERED' && (
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-2">
                    {dbUser?.id !== item.reporterId && (
                      <button
                        type="button"
                        onClick={() => setClaimTarget(item)}
                        className="px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E]"
                      >
                        Request Claim
                      </button>
                    )}
                    {canRecover && (
                      <button
                        type="button"
                        onClick={() => handleMarkRecovered(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Recovered
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Lost or Found Item"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select
              name="reportType"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              <option value="LOST">Lost Item</option>
              <option value="FOUND">Found Item</option>
            </select>
            <input
              name="dateReported"
              type="date"
              required
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <input
            name="title"
            required
            placeholder="Item Name (e.g. Student ID, Calculator)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="location"
            required
            placeholder="Campus Location"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="General description (keep secret identifiers private for verification)..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="w-full text-xs text-stone-600"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Submit Report
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(claimTarget)}
        onClose={() => setClaimTarget(null)}
        title={`Verify Claim · ${claimTarget?.title ?? ''}`}
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <textarea
            name="verificationDetails"
            required
            rows={3}
            placeholder="Provide identifying marks, contents, or serial details to confirm ownership..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClaimTarget(null)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Send Claim
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

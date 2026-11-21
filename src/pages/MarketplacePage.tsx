import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Flag, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  EmptyState,
  ErrorBanner,
  Modal,
  StatusLabel,
} from '../components/ui/Primitives';
import type { MarketplaceItem } from '../types';

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Books',
  'Food',
  'Accommodation',
  'Beauty',
  'Services',
  'Other',
];

export const MarketplacePage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<MarketplaceItem | null>(null);
  const [contactTarget, setContactTarget] = useState<MarketplaceItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: listings, isLoading } = useQuery({
    queryKey: ['marketplace', search, category, maxPrice],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (maxPrice) params.set('maxPrice', maxPrice);
      const res = await api.get<{ listings: MarketplaceItem[] }>(
        `/campus/marketplace?${params.toString()}`
      );
      return res.data.listings;
    },
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/campus/marketplace', fd);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleMarkSold = async (id: number) => {
    try {
      await api.patch(`/campus/marketplace/${id}`, {
        availabilityStatus: 'SOLD',
      });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleContactSeller = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contactTarget) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/communications/messages/conversations', {
        recipientId: contactTarget.sellerId,
        contextLabel: `Marketplace: ${contactTarget.title}`,
        initialMessage: fd.get('message'),
      });
      setContactTarget(null);
      navigate('/communications');
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reportTarget) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/campus/marketplace/${reportTarget.id}/report`, {
        reason: fd.get('reason'),
      });
      setReportTarget(null);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Marketplace"
        subtitle="Peer-to-peer student listings for electronics, textbooks, and campus services. Arrange payment in person; M-Pesa checkout hooks are prepared for future integration."
        action={
          firebaseUser && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Post Listing
            </button>
          )
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-4 grid sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calculators, books, laptops..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Max price (KES)"
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
        />
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      {!isLoading && !listings?.length && (
        <EmptyState
          title="No marketplace listings match"
          description="Try clearing your price or category filter, or post an item to sell."
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings?.map((item) => {
          const isSeller = dbUser?.id === item.sellerId;
          return (
            <article
              key={item.id}
              className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-44 object-cover bg-stone-100"
                  />
                ) : (
                  <div className="w-full h-36 bg-stone-100 flex items-center justify-center text-xs font-medium text-stone-500">
                    {item.category}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F766E]">{item.category}</span>
                    <StatusLabel status={item.availabilityStatus} />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-[#0C2924]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-lg font-bold font-mono text-[#0C2924] tabular-nums">
                    KES {item.priceKes.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-600 line-clamp-2">
                    {item.description}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    Seller: {item.sellerName || 'TTU Student'} · {item.condition}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between gap-2">
                {firebaseUser && isSeller && item.availabilityStatus !== 'SOLD' && (
                  <button
                    type="button"
                    onClick={() => handleMarkSold(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Sold
                  </button>
                )}
                {firebaseUser && !isSeller && item.availabilityStatus === 'AVAILABLE' && (
                  <button
                    type="button"
                    onClick={() => setContactTarget(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Contact Seller
                  </button>
                )}
                {firebaseUser && !isSeller && (
                  <button
                    type="button"
                    onClick={() => setReportTarget(item)}
                    aria-label="Report listing"
                    className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:text-rose-600"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Create Listing Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Post Marketplace Listing"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            name="title"
            required
            placeholder="Item Title"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              name="category"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              name="priceKes"
              type="number"
              required
              min={0}
              placeholder="Price (KES)"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <select
            name="condition"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="New">New</option>
            <option value="Used - Like New">Used - Like New</option>
            <option value="Used - Good">Used - Good</option>
            <option value="Service">Service</option>
          </select>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Item details, pickup location on campus..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Product Photo (JPG, PNG, WEBP · Max 4 MB)
            </label>
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full text-xs text-stone-600"
            />
          </div>
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
              Publish Listing
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact Seller Modal */}
      <Modal
        open={Boolean(contactTarget)}
        onClose={() => setContactTarget(null)}
        title={`Message Seller · ${contactTarget?.title ?? ''}`}
      >
        <form onSubmit={handleContactSeller} className="space-y-4">
          <textarea
            name="message"
            required
            rows={3}
            defaultValue={`Hi, is "${contactTarget?.title ?? ''}" still available?`}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setContactTarget(null)}
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

      {/* Report Modal */}
      <Modal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        title="Report Suspicious Listing"
      >
        <form onSubmit={handleReport} className="space-y-4">
          <textarea
            name="reason"
            required
            rows={3}
            placeholder="Reason for reporting this listing..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportTarget(null)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
            >
              Submit Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

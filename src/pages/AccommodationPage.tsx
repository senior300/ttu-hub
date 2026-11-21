import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ShieldCheck, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
} from '../components/ui/Primitives';
import type { AccommodationItem } from '../types';

export const AccommodationPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [providerFilter, setProviderFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState<AccommodationItem | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ['accommodations', providerFilter],
    queryFn: async () => {
      const qs = providerFilter ? `?providerType=${providerFilter}` : '';
      const res = await api.get<{ accommodations: AccommodationItem[] }>(
        `/campus/accommodation${qs}`
      );
      return res.data.accommodations;
    },
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/campus/accommodation', fd);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['accommodations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requestTarget) return;
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/campus/accommodation/${requestTarget.id}/request`, {
        preferredMoveIn: fd.get('preferredMoveIn'),
        message: fd.get('message'),
      });
      setRequestTarget(null);
      setSuccessMsg('Accommodation inquiry submitted to provider.');
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const isAdmin =
    dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accommodation & Hostel Services"
        subtitle="Clear separation between official university residence halls and privately advertised off-campus housing."
        action={
          firebaseUser && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Add Accommodation
            </button>
          )
        }
      />

      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-xs text-teal-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
        <span>
          Room counts marked unverified reflect provider-submitted estimates rather than real-time university booking telemetry. Always confirm allocation or tenancy terms directly before making deposits.
        </span>
      </div>

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}

      <div className="inline-flex p-1 bg-stone-200/75 rounded-lg">
        {[
          { id: '', label: 'All Listings' },
          { id: 'UNIVERSITY_HOSTEL', label: 'University Hostels' },
          { id: 'PRIVATE_ACCOMMODATION', label: 'Private Rentals' },
        ].map((t) => (
          <button
            key={t.id || 'all'}
            type="button"
            onClick={() => setProviderFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
              providerFilter === t.id
                ? 'bg-white text-[#0C2924] shadow-sm'
                : 'text-stone-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      <div className="grid md:grid-cols-2 gap-5">
        {list?.map((acc) => (
          <article
            key={acc.id}
            className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
          >
            {acc.imageUrl && (
              <img
                src={acc.imageUrl}
                alt={acc.name}
                className="w-full h-44 object-cover"
              />
            )}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold ${
                      acc.providerType === 'UNIVERSITY_HOSTEL'
                        ? 'text-[#0C2924]'
                        : 'text-[#0F766E]'
                    }`}
                  >
                    {acc.providerType === 'UNIVERSITY_HOSTEL'
                      ? 'University Hostel'
                      : 'Private Advertised Accommodation'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-stone-500">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {acc.availabilityVerified
                      ? 'Availability Verified'
                      : 'Confirm Directly'}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-[#0C2924]">{acc.name}</h3>
                <p className="mt-1 text-base font-bold font-mono text-[#0C2924] tabular-nums">
                  KES {acc.pricePerSemesterKes.toLocaleString()} / semester
                </p>
                <p className="mt-2 text-sm text-stone-600">{acc.description}</p>
                <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                  <p className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {acc.location}
                  </p>
                  <p>Amenities: {acc.amenities}</p>
                  <p>Contact: {acc.contactInfo}</p>
                </div>
              </div>

              {firebaseUser && (
                <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRequestTarget(acc)}
                    className="px-4 py-2 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E]"
                  >
                    Send Inquiry
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Advertise Student Accommodation"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            name="name"
            required
            placeholder="Hostel / Apartment Name"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <select
            name="providerType"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="PRIVATE_ACCOMMODATION">Private Accommodation</option>
            {isAdmin && (
              <option value="UNIVERSITY_HOSTEL">University Hostel (Official)</option>
            )}
          </select>
          <input
            name="location"
            required
            placeholder="Distance from campus / Road"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="pricePerSemesterKes"
              type="number"
              required
              placeholder="Price / Semester (KES)"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <input
              name="roomsAvailable"
              type="number"
              required
              placeholder="Estimated rooms"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <input
            name="amenities"
            required
            placeholder="Amenities (Wi-Fi, Security, Water)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="contactInfo"
            required
            placeholder="Caretaker or Office contact instructions"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Room description and house rules..."
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

      <Modal
        open={Boolean(requestTarget)}
        onClose={() => setRequestTarget(null)}
        title={`Inquiry · ${requestTarget?.name ?? ''}`}
      >
        <form onSubmit={handleRequest} className="space-y-4">
          <input
            name="preferredMoveIn"
            type="date"
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="message"
            required
            rows={3}
            placeholder="Room type preferred and viewing availability..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRequestTarget(null)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Submit Inquiry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

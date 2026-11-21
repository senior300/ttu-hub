import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Search, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
} from '../components/ui/Primitives';
import type { CampusLocationItem } from '../types';

const LOCATION_CATEGORIES = [
  'School',
  'Department',
  'Office',
  'Student Service',
  'Accommodation',
  'Library',
  'Laboratory',
  'Lecture Hall',
  'Facility',
];

export const DirectoryMapPage: React.FC = () => {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editTarget, setEditTarget] = useState<CampusLocationItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin =
    dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN';

  const { data: locations, isLoading } = useQuery({
    queryKey: ['directory', search, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const res = await api.get<{ locations: CampusLocationItem[] }>(
        `/campus/directory?${params.toString()}`
      );
      return res.data.locations;
    },
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([-3.4165, 38.5065], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer || !locations) return;
    layer.clearLayers();

    for (const loc of locations) {
      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        const marker = L.circleMarker([loc.latitude, loc.longitude], {
          radius: 8,
          color: '#0C2924',
          fillColor: loc.coordinatesVerified ? '#16A34A' : '#0D9488',
          fillOpacity: 0.9,
          weight: 2,
        });
        marker.bindPopup(
          `<div style="font-size:12px;"><strong>${loc.name}</strong><br/><span>${loc.category}${
            loc.buildingCode ? ` (${loc.buildingCode})` : ''
          }</span><br/><em style="color:#57534e;">${
            loc.coordinatesVerified
              ? 'Verified coordinates'
              : 'Approximate · Configurable by Admin'
          }</em></div>`
        );
        marker.addTo(layer);
      }
    }
  }, [locations]);

  const focusLocation = (loc: CampusLocationItem) => {
    if (
      mapInstanceRef.current &&
      typeof loc.latitude === 'number' &&
      typeof loc.longitude === 'number'
    ) {
      mapInstanceRef.current.setView([loc.latitude, loc.longitude], 17, {
        animate: true,
      });
    }
  };

  const handleSaveLocation = async (
    e: React.FormEvent<HTMLFormElement>,
    mode: 'create' | 'edit'
  ) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get('name'),
      category: fd.get('category'),
      buildingCode: fd.get('buildingCode') || null,
      description: fd.get('description'),
      openingHours: fd.get('openingHours') || null,
      latitude: fd.get('latitude') ? Number(fd.get('latitude')) : null,
      longitude: fd.get('longitude') ? Number(fd.get('longitude')) : null,
      coordinatesVerified: fd.get('coordinatesVerified') === 'on',
    };
    try {
      if (mode === 'create') {
        await api.post('/campus/directory', payload);
        setCreateOpen(false);
      } else if (editTarget) {
        await api.patch(`/campus/directory/${editTarget.id}`, payload);
        setEditTarget(null);
      }
      queryClient.invalidateQueries({ queryKey: ['directory'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Directory & Map"
        subtitle="Search schools, departments, libraries, laboratories, and offices. Building coordinates are configurable by administrators."
        action={
          isAdmin && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Add Facility
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
            placeholder="Search library, engineering block, office..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
        >
          <option value="">All Facilities</option>
          {LOCATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl overflow-hidden min-h-[380px]">
          <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />
        </div>

        <div className="lg:col-span-5 space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {isLoading && <LoadingSkeleton rows={3} />}
          {locations?.map((loc) => (
            <div
              key={loc.id}
              className="bg-white border border-stone-200 rounded-xl p-4 hover:border-[#0F766E] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => focusLocation(loc)}
                  className="text-left flex-1"
                >
                  <p className="text-xs font-semibold text-[#0F766E]">
                    {loc.category}
                    {loc.buildingCode ? ` · ${loc.buildingCode}` : ''}
                  </p>
                  <h3 className="text-sm font-bold text-[#0C2924] mt-0.5">
                    {loc.name}
                  </h3>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditTarget(loc)}
                    aria-label="Configure location"
                    className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-1">{loc.description}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                {loc.openingHours && <span>{loc.openingHours}</span>}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {loc.coordinatesVerified
                    ? 'Verified Pin'
                    : 'Configurable Default Pin'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit Location Modal */}
      <Modal
        open={createOpen || Boolean(editTarget)}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        title={editTarget ? `Edit ${editTarget.name}` : 'Add Campus Facility'}
      >
        <form
          onSubmit={(e) => handleSaveLocation(e, editTarget ? 'edit' : 'create')}
          className="space-y-4"
        >
          <input
            name="name"
            required
            defaultValue={editTarget?.name ?? ''}
            placeholder="Facility Name"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              name="category"
              defaultValue={editTarget?.category ?? 'Facility'}
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            >
              {LOCATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              name="buildingCode"
              defaultValue={editTarget?.buildingCode ?? ''}
              placeholder="Building Code"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="latitude"
              type="number"
              step="any"
              defaultValue={editTarget?.latitude ?? -3.4165}
              placeholder="Latitude"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono"
            />
            <input
              name="longitude"
              type="number"
              step="any"
              defaultValue={editTarget?.longitude ?? 38.5065}
              placeholder="Longitude"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-700">
            <input
              type="checkbox"
              name="coordinatesVerified"
              defaultChecked={editTarget?.coordinatesVerified ?? false}
            />
            Mark coordinates as verified on campus
          </label>
          <input
            name="openingHours"
            defaultValue={editTarget?.openingHours ?? ''}
            placeholder="Opening Hours (e.g. Mon-Fri 08:00 - 17:00)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="description"
            required
            rows={2}
            defaultValue={editTarget?.description ?? ''}
            placeholder="Description and services offered..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setEditTarget(null);
              }}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Save Location
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

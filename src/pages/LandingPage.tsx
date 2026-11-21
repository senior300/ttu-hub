import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Megaphone,
  Calendar,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { BrandMark, ErrorBanner } from '../components/ui/Primitives';
import type { AcademicResource, AnnouncementItem, EventItem } from '../types';

export const LandingPage: React.FC = () => {
  const { firebaseUser, signInWithGoogle, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const [heroError, setHeroError] = useState(false);

  const { data: previewData } = useQuery({
    queryKey: ['landing-preview'],
    queryFn: async () => {
      const [annRes, resRes, evRes] = await Promise.all([
        api.get<{ announcements: AnnouncementItem[] }>('/communications/announcements'),
        api.get<{ resources: AcademicResource[] }>('/academics/resources?limit=3'),
        api.get<{ events: EventItem[] }>('/community/events'),
      ]);
      return {
        announcements: annRes.data.announcements.slice(0, 3),
        resources: resRes.data.resources.slice(0, 3),
        events: evRes.data.events.slice(0, 2),
      };
    },
  });

  const handlePrimaryAction = async () => {
    if (firebaseUser) {
      navigate('/dashboard');
      return;
    }
    await signInWithGoogle();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#0C2924]">
      {/* Top Bar */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <BrandMark size="sm" />
            <span className="font-display font-bold text-lg text-[#0C2924] whitespace-nowrap">
              TTU HUB
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <Link to="/academics" className="hover:text-[#0F766E] whitespace-nowrap transition-colors">
              Ed Vault
            </Link>
            <Link to="/organizations" className="hover:text-[#0F766E] whitespace-nowrap transition-colors">
              Organizations
            </Link>
            <Link to="/marketplace" className="hover:text-[#0F766E] whitespace-nowrap transition-colors">
              Marketplace
            </Link>
            <Link to="/directory" className="hover:text-[#0F766E] whitespace-nowrap transition-colors">
              Campus Map
            </Link>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="px-4 py-2 rounded-lg bg-[#0C2924] text-white text-sm font-medium hover:bg-[#0F766E] transition-colors whitespace-nowrap"
            >
              {firebaseUser ? 'Open Workspace' : 'Sign In with Google'}
            </button>
          </div>
        </div>
      </header>

      <main>
        {authError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <ErrorBanner message={authError} onDismiss={clearAuthError} />
          </div>
        )}

        {/* Hero Section */}
        <section className="border-b border-stone-200 bg-gradient-to-b from-white to-[#F7F6F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
                Taita Taveta University · Student & Academic Portal
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0C2924] text-balance leading-[1.12]">
                One University. One Connected Experience.
              </h1>
              <p className="mt-4 text-base text-stone-600 leading-relaxed max-w-xl">
                Access verified lecture notes in Ed Vault, class and exam timetables, campus announcements, student organizations, verified accommodation notices, opportunities, and interactive campus navigation in one unified platform.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#115E59] transition-colors"
                >
                  <span>{firebaseUser ? 'Go to Dashboard' : 'Enter TTU HUB'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/academics"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-stone-300 text-[#0C2924] text-sm font-semibold hover:bg-stone-50 transition-colors"
                >
                  <span>Browse Ed Vault</span>
                </Link>
              </div>
              <p className="mt-5 text-xs text-stone-500">
                Independent software platform built for the TTU campus community. Not an official university ERP or institutional portal.
              </p>
            </div>

            <div className="lg:col-span-6">
              {heroError ? (
                <div className="h-full min-h-[280px] rounded-xl bg-[#0C2924] text-white p-8 flex flex-col justify-end">
                  <p className="font-display text-xl font-bold">TTU HUB Digital Campus</p>
                  <p className="text-sm text-emerald-100/80 mt-1">
                    Academics, Community, Marketplace, and Services
                  </p>
                </div>
              ) : (
                <img
                  src="/src/assets/images/ttu_campus_hero_1795286247636.jpg"
                  alt="University campus library and landscaped courtyard"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroError(true)}
                  className="w-full h-72 lg:h-full object-cover rounded-xl border border-stone-200 shadow-sm"
                />
              )}
            </div>
          </div>
        </section>

        {/* Core Ecosystem Modules */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-[#0C2924]">
              Designed for daily university life
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Role-tailored workspaces for students, lecturers, student organizations, and university administrators.
            </p>
          </div>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: BookOpen,
                title: 'Academic Hub — Ed Vault',
                desc: 'Organized lecture notes, revision guides, past papers, assignments, and class/exam timetables.',
                to: '/academics',
              },
              {
                icon: Megaphone,
                title: 'Communication Hub',
                desc: 'Scoped university, school, department, and club announcements paired with direct messaging.',
                to: '/communications',
              },
              {
                icon: Calendar,
                title: 'Clubs & Campus Events',
                desc: 'Join student organizations, RSVP to hackathons and career clinics, and manage club members.',
                to: '/organizations',
              },
              {
                icon: ShoppingBag,
                title: 'Campus Marketplace & Housing',
                desc: 'Buy and sell student essentials safely and distinguish university hostels from private rentals.',
                to: '/marketplace',
              },
              {
                icon: Briefcase,
                title: 'Opportunities Hub',
                desc: 'Discover industrial attachments, scholarships, graduate programmes, and fellowships.',
                to: '/opportunities',
              },
              {
                icon: MapPin,
                title: 'Directory & Campus Map',
                desc: 'Search departments, labs, and offices on an OpenStreetMap view with admin-configurable pins.',
                to: '/directory',
              },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.title}
                  to={mod.to}
                  className="bg-white border border-stone-200 rounded-xl p-6 hover:border-[#0F766E] transition-colors flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 text-[#0F766E] flex items-center justify-center group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#0C2924]">
                      {mod.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                  <span className="mt-4 text-xs font-semibold text-[#0F766E] inline-flex items-center gap-1">
                    Explore module <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Live Platform Preview */}
        <section className="bg-white border-t border-stone-200 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-8">
            <div className="bg-[#F7F6F2] border border-stone-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <h3 className="text-base font-bold text-[#0C2924]">
                  Recent Campus Announcements
                </h3>
                <Link to="/communications" className="text-xs font-semibold text-[#0F766E] hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-stone-200/70">
                {previewData?.announcements.map((a) => (
                  <div key={a.id} className="py-3.5">
                    <p className="text-xs text-[#B45309] font-medium">
                      {a.scope} · {a.targetName || 'Campus'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0C2924]">{a.title}</p>
                    <p className="mt-1 text-xs text-stone-600 line-clamp-2">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F7F6F2] border border-stone-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <h3 className="text-base font-bold text-[#0C2924]">
                  Latest Approved Ed Vault Resources
                </h3>
                <Link to="/academics" className="text-xs font-semibold text-[#0F766E] hover:underline">
                  Open Ed Vault
                </Link>
              </div>
              <div className="divide-y divide-stone-200/70">
                {previewData?.resources.map((r) => (
                  <div key={r.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono font-medium text-[#0F766E]">
                        {r.unitCode} · {r.category}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0C2924]">{r.title}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{r.course}</p>
                    </div>
                    <span className="text-xs text-stone-500 tabular-nums shrink-0">
                      {r.downloadCount} downloads
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0C2924]" />
            <span>TTU HUB — Independent Community Software Project</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/directory" className="hover:text-[#0C2924]">
              Campus Directory
            </Link>
            <a href="/api/docs" target="_blank" rel="noreferrer" className="hover:text-[#0C2924]">
              REST API Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

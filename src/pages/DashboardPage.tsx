import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Megaphone,
  Briefcase,
  ShoppingBag,
  Building2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  StatTile,
  LoadingSkeleton,
  ErrorBanner,
  StatusLabel,
} from '../components/ui/Primitives';
import type {
  AcademicResource,
  AnnouncementItem,
  EventItem,
  TimetableEntry,
  MarketplaceItem,
  OpportunityItem,
  AccommodationItem,
} from '../types';

interface DashboardPayload {
  recentResources: AcademicResource[];
  savedBookmarks: AcademicResource[];
  recentAnnouncements: AnnouncementItem[];
  upcomingEvents: EventItem[];
  timetables: TimetableEntry[];
  marketplaceHighlights: MarketplaceItem[];
  accommodationHighlights: AccommodationItem[];
  opportunityHighlights: OpportunityItem[];
  roleExtras: {
    myUploads?: AcademicResource[];
    submissionsCount?: number;
    pendingMembers?: number;
    totalUsers?: number;
    pendingResources?: number;
    pendingAccountApprovals?: number;
  };
}

export const DashboardPage: React.FC = () => {
  const { dbUser, firebaseUser, signInWithGoogle, canClaimSuperAdmin } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', dbUser?.id],
    queryFn: async () => {
      const res = await api.get<DashboardPayload>('/auth/dashboard');
      return res.data;
    },
    enabled: Boolean(firebaseUser),
  });

  if (!firebaseUser || !dbUser) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8">
        <h1 className="text-2xl font-bold text-[#0C2924]">Welcome to TTU HUB</h1>
        <p className="mt-2 text-sm text-stone-600">
          Sign in with your Google account to unlock your personalized student, lecturer, organization leader, or administrator dashboard.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 px-5 py-2.5 rounded-lg bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#115E59]"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${dbUser.fullName}`}
        subtitle={`${dbUser.role.replace(/_/g, ' ')} Workspace · ${
          dbUser.department || 'Complete your university profile for tailored unit schedules'
        }`}
        action={
          <div className="flex items-center gap-3">
            <StatusLabel status={dbUser.accountStatus} />
            <Link
              to="/profile"
              className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:bg-stone-50"
            >
              Manage Profile
            </Link>
          </div>
        }
      />

      {(!dbUser.profileCompleted || canClaimSuperAdmin) && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-teal-950">
            <p className="font-semibold">
              {!dbUser.profileCompleted
                ? 'Complete your university profile'
                : 'Initial SuperAdmin setup available'}
            </p>
            <p className="text-xs text-teal-800 mt-0.5">
              {!dbUser.profileCompleted
                ? 'Add your registration number, school, and course—or request Lecturer / Organization Leader verification.'
                : 'No platform SuperAdmin is assigned yet. Visit Profile to claim initial administration privileges.'}
            </p>
          </div>
          <Link
            to="/profile"
            className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59] shrink-0"
          >
            Open Profile Setup
          </Link>
        </div>
      )}

      {error && <ErrorBanner message={extractErrorMessage(error)} />}
      {isLoading && <LoadingSkeleton rows={4} />}

      {data && (
        <>
          {/* Role-Specific Metric Strip */}
          {dbUser.role === 'ADMIN' || dbUser.role === 'SUPERADMIN' ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Registered Users" value={data.roleExtras.totalUsers ?? 0} />
              <StatTile
                label="Pending Account Approvals"
                value={data.roleExtras.pendingAccountApprovals ?? 0}
              />
              <StatTile
                label="Pending Ed Vault Uploads"
                value={data.roleExtras.pendingResources ?? 0}
              />
              <div className="bg-[#0C2924] text-white rounded-xl p-5 flex flex-col justify-between">
                <p className="text-xs text-emerald-200/75">Administration</p>
                <Link
                  to="/admin"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Open Admin Console
                </Link>
              </div>
            </div>
          ) : dbUser.role === 'LECTURER' ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Uploaded Materials"
                value={data.roleExtras.myUploads?.length ?? 0}
              />
              <StatTile
                label="Student Submissions"
                value={data.roleExtras.submissionsCount ?? 0}
              />
              <StatTile label="Upcoming Events" value={data.upcomingEvents.length} />
              <StatTile label="Recent Notices" value={data.recentAnnouncements.length} />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Ed Vault Resources" value={data.recentResources.length} />
              <StatTile label="Saved Bookmarks" value={data.savedBookmarks.length} />
              <StatTile label="Upcoming Events" value={data.upcomingEvents.length} />
              <StatTile label="Open Opportunities" value={data.opportunityHighlights.length} />
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { to: '/academics', label: 'Ed Vault', icon: BookOpen },
              { to: '/communications', label: 'Announcements', icon: Megaphone },
              { to: '/events', label: 'Events', icon: Calendar },
              { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
              { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
              { to: '/accommodation', label: 'Hostels', icon: Building2 },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#0C2924] hover:border-[#0F766E] transition-colors"
                >
                  <Icon className="w-4 h-4 text-[#0F766E] shrink-0" />
                  <span className="truncate">{s.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Timetables & Resources */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h2 className="text-base font-bold text-[#0C2924]">
                    Class & Examination Timetable
                  </h2>
                  <Link
                    to="/academics"
                    className="text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    Full schedule
                  </Link>
                </div>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-stone-500 border-b border-stone-100">
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Unit</th>
                        <th className="py-2 pr-3 font-medium">Day / Date</th>
                        <th className="py-2 pr-3 font-medium">Time</th>
                        <th className="py-2 font-medium">Venue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.timetables.slice(0, 5).map((t) => (
                        <tr key={t.id}>
                          <td className="py-2.5 pr-3 font-semibold text-[#0F766E]">
                            {t.entryType}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-[#0C2924]">
                            {t.unitCode}
                          </td>
                          <td className="py-2.5 pr-3 text-stone-700">{t.dayOrDate}</td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-stone-700">
                            {t.startTime}–{t.endTime}
                          </td>
                          <td className="py-2.5 text-stone-700">{t.venue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h2 className="text-base font-bold text-[#0C2924]">
                    Recently Added Academic Resources
                  </h2>
                  <Link
                    to="/academics"
                    className="text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    Browse Ed Vault
                  </Link>
                </div>
                <div className="divide-y divide-stone-100 mt-2">
                  {data.recentResources.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-mono text-[#0F766E]">
                          {r.unitCode} · {r.category}
                        </p>
                        <p className="text-sm font-semibold text-[#0C2924]">{r.title}</p>
                      </div>
                      <a
                        href={`/api/academics/resources/${r.id}/download`}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 shrink-0"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Rail: Notices, Events & Campus Highlights */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h2 className="text-base font-bold text-[#0C2924]">
                    Recent Announcements
                  </h2>
                  <Link
                    to="/communications"
                    className="text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-stone-100 mt-2">
                  {data.recentAnnouncements.slice(0, 4).map((a) => (
                    <div key={a.id} className="py-3">
                      <p className="text-xs text-[#B45309] font-medium">
                        {a.scope} · {a.priority}
                      </p>
                      <p className="text-sm font-semibold text-[#0C2924] mt-0.5">
                        {a.title}
                      </p>
                      <p className="text-xs text-stone-600 line-clamp-2 mt-1">{a.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h2 className="text-base font-bold text-[#0C2924]">
                    Opportunities & Marketplace
                  </h2>
                  <Link
                    to="/opportunities"
                    className="text-xs font-semibold text-[#0F766E] hover:underline inline-flex items-center gap-1"
                  >
                    Explore <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3 mt-3">
                  {data.opportunityHighlights.slice(0, 2).map((o) => (
                    <div key={o.id} className="p-3 rounded-lg bg-[#F7F6F2] border border-stone-200/70">
                      <p className="text-xs font-medium text-[#0F766E]">{o.category}</p>
                      <p className="text-sm font-semibold text-[#0C2924] mt-0.5">
                        {o.title}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {o.organizationName} · Deadline {o.deadline}
                      </p>
                    </div>
                  ))}
                  {data.marketplaceHighlights.slice(0, 2).map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs pt-2 border-t border-stone-100">
                      <span className="font-medium text-stone-800 truncate pr-3">
                        {m.title}
                      </span>
                      <span className="font-mono font-semibold text-[#0C2924] tabular-nums shrink-0">
                        KES {m.priceKes.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

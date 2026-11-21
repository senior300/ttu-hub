import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookOpen,
  Megaphone,
  Users,
  ShoppingBag,
  Building2,
  SearchCheck,
  Briefcase,
  Calendar,
  MapPin,
  Bot,
  ShieldCheck,
  Bell,
  Menu,
  X,
  LogOut,
  UserCircle2,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { BrandMark } from '../components/ui/Primitives';
import type { NotificationItem } from '../types';

const navSections = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/academics', label: 'Ed Vault & Academics', icon: BookOpen },
      { to: '/communications', label: 'Communications', icon: Megaphone },
      { to: '/assistant', label: 'TTU AI Assistant', icon: Bot },
    ],
  },
  {
    label: 'Campus Life',
    items: [
      { to: '/organizations', label: 'Organizations', icon: Users },
      { to: '/events', label: 'Events', icon: Calendar },
      { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
      { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
      { to: '/accommodation', label: 'Accommodation', icon: Building2 },
      { to: '/lost-found', label: 'Lost & Found', icon: SearchCheck },
      { to: '/directory', label: 'Directory & Map', icon: MapPin },
    ],
  },
];

export const PortalLayout: React.FC = () => {
  const { dbUser, firebaseUser, signInWithGoogle, signOutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();

  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>('/communications/notifications');
      return res.data;
    },
    enabled: Boolean(firebaseUser),
  });

  const isAdmin =
    dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN';

  const markAllRead = async () => {
    await api.post('/communications/notifications/read-all');
    refetchNotifs();
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#0C2924] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0C2924] text-white border-r border-[#18433B]">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" />
            <span className="font-display font-bold text-base tracking-tight whitespace-nowrap">
              TTU HUB
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-xs font-medium text-emerald-200/60 mb-2">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#0F766E] text-white shadow-sm ring-1 ring-teal-300/20'
                            : 'text-stone-300 hover:bg-[#143D35] hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              <p className="px-3 text-xs font-medium text-emerald-200/60 mb-2">
                Administration
              </p>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0F766E] text-white shadow-sm ring-1 ring-teal-300/20'
                      : 'text-stone-300 hover:bg-[#143D35] hover:text-white'
                  }`
                }
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin Console</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-emerald-200/65">
          <p className="truncate">Independent Student Platform</p>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="text-teal-200 hover:text-white underline mt-1 inline-block"
          >
            OpenAPI Docs
          </a>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="lg:hidden flex items-center gap-2.5">
              <BrandMark size="sm" />
              <span className="font-display font-bold text-base text-[#0C2924] whitespace-nowrap">
                TTU HUB
              </span>
            </Link>
            <span className="hidden lg:inline text-xs font-medium text-stone-500">
              Taita Taveta University Community Portal
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((v) => !v)}
                    aria-label="Toggle notifications"
                    className="relative p-2 rounded-lg text-stone-700 hover:bg-stone-100"
                  >
                    <Bell className="w-5 h-5" />
                    {(notifData?.unreadCount ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0F766E] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {notifData?.unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-xl shadow-lg p-3 z-40">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <span className="text-xs font-bold text-[#0C2924]">
                          Notifications
                        </span>
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-xs text-[#0F766E] hover:underline"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
                        {notifData?.notifications.length ? (
                          notifData.notifications.slice(0, 6).map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => {
                                setNotifOpen(false);
                                if (n.linkPath) navigate(n.linkPath);
                              }}
                              className={`w-full text-left py-2.5 px-1 hover:bg-stone-50 rounded ${
                                !n.isRead ? 'font-medium text-[#0C2924]' : 'text-stone-600'
                              }`}
                            >
                              <p className="text-xs font-semibold">{n.title}</p>
                              <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">
                                {n.body}
                              </p>
                            </button>
                          ))
                        ) : (
                          <p className="py-6 text-center text-xs text-stone-500">
                            No notifications yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm"
                >
                  {dbUser?.avatarUrl ? (
                    <img
                      src={dbUser.avatarUrl}
                      alt={dbUser.fullName}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="w-5 h-5 text-[#0F766E]" />
                  )}
                  <span className="hidden sm:inline font-medium text-stone-800 max-w-[140px] truncate">
                    {dbUser?.fullName || firebaseUser.email}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={signOutUser}
                  aria-label="Sign out"
                  className="p-2 rounded-lg text-stone-600 hover:text-[#0C2924] hover:bg-stone-100"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-sm font-medium hover:bg-[#115E59] transition-colors whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-stone-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0C2924] text-white h-full overflow-y-auto p-4 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <BrandMark size="sm" />
                <span className="font-display font-bold text-base">TTU HUB</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-stone-300 hover:bg-[#143D35]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-5 flex-1">
              {navSections.map((section) => (
                <div key={section.label}>
                  <p className="px-2 text-xs font-medium text-emerald-200/60 mb-1.5">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                              isActive
                                ? 'bg-[#0F766E] text-white'
                                : 'text-stone-300 hover:bg-[#143D35]'
                            }`
                          }
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-200 hover:bg-[#143D35]"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Admin Console</span>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 grid grid-cols-5 h-14"
      >
        {[
          { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
          { to: '/academics', label: 'Ed Vault', icon: BookOpen },
          { to: '/communications', label: 'Notices', icon: Megaphone },
          { to: '/marketplace', label: 'Market', icon: ShoppingBag },
          { to: '/directory', label: 'Map', icon: MapPin },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-[#0F766E]' : 'text-stone-600'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

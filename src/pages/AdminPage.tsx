import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  StatTile,
  LoadingSkeleton,
  ErrorBanner,
  StatusLabel,
} from '../components/ui/Primitives';

interface AdminOverview {
  metrics: {
    totalUsers: number;
    totalStudents: number;
    totalLecturers: number;
    pendingAccountApprovals: number;
    totalResources: number;
    pendingResources: number;
    totalAnnouncements: number;
    totalEvents: number;
    totalMarketplaceListings: number;
  };
  charts: {
    usersByRole: Array<{ role: string; count: number }>;
    resourcesByCategory: Array<{ category: string; count: number }>;
  };
}

interface AdminUserRow {
  id: number;
  fullName: string;
  email: string;
  role: string;
  requestedRole: string | null;
  accountStatus: string;
  staffId: string | null;
  registrationNumber: string | null;
}

interface PendingApprovals {
  pendingResources: Array<{ id: number; unitCode: string; title: string }>;
  pendingOrgs: Array<{ id: number; name: string; category: string }>;
  pendingOpps: Array<{ id: number; title: string; organizationName: string }>;
  openReports: Array<{ id: number; entityType: string; entityId: number; reason: string }>;
}

interface AuditLogRow {
  id: number;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

export const AdminPage: React.FC = () => {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'users' | 'moderation' | 'audit'>(
    'overview'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin =
    dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPERADMIN';

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await api.get<AdminOverview>('/admin/overview');
      return res.data;
    },
    enabled: Boolean(isAdmin),
  });

  const { data: usersList } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get<{ users: AdminUserRow[] }>('/admin/users');
      return res.data.users;
    },
    enabled: Boolean(isAdmin) && tab === 'users',
  });

  const { data: approvals } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: async () => {
      const res = await api.get<PendingApprovals>('/admin/approvals');
      return res.data;
    },
    enabled: Boolean(isAdmin) && tab === 'moderation',
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => {
      const res = await api.get<{ logs: AuditLogRow[] }>('/admin/audit-logs');
      return res.data.logs;
    },
    enabled: Boolean(isAdmin) && tab === 'audit',
  });

  if (!isAdmin) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-lg mx-auto my-8">
        <h2 className="text-lg font-bold text-[#0C2924]">Administrator Access Required</h2>
        <p className="mt-2 text-sm text-stone-600">
          This console is restricted to verified platform administrators.
        </p>
      </div>
    );
  }

  const updateUser = async (
    id: number,
    payload: {
      accountStatus?: string;
      approveRequestedRole?: boolean;
      role?: string;
    }
  ) => {
    setErrorMsg(null);
    try {
      await api.patch(`/admin/users/${id}`, payload);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const moderateResource = async (
    id: number,
    approvalStatus: 'APPROVED' | 'REJECTED'
  ) => {
    try {
      await api.patch(`/admin/resources/${id}/moderate`, {
        approvalStatus,
        rejectionReason:
          approvalStatus === 'REJECTED' ? 'Requires syllabus metadata review' : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const resolveReport = async (id: number, removeContent: boolean) => {
    try {
      await api.patch(`/admin/reports/${id}`, {
        status: 'RESOLVED',
        removeContent,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const downloadCsv = async (entity: string) => {
    try {
      const res = await api.get(`/admin/export/${entity}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ttu-hub-${entity}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration & System Control"
        subtitle="Manage user approvals, Ed Vault moderation, campus analytics, audit logs, and CSV exports."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCsv('users')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold hover:bg-stone-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export Users CSV
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('audit')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold hover:bg-stone-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </button>
          </div>
        }
      />

      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      )}

      <div className="inline-flex p-1 bg-stone-200/75 rounded-lg">
        {[
          { id: 'overview', label: 'Analytics & Overview' },
          { id: 'users', label: 'Users & Approvals' },
          { id: 'moderation', label: 'Content Moderation' },
          { id: 'audit', label: 'Audit Logs' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
              tab === t.id ? 'bg-white text-[#0C2924] shadow-sm' : 'text-stone-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {overviewLoading && <LoadingSkeleton rows={3} />}
          {overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Total Users" value={overview.metrics.totalUsers} />
                <StatTile label="Students" value={overview.metrics.totalStudents} />
                <StatTile label="Lecturers" value={overview.metrics.totalLecturers} />
                <StatTile
                  label="Pending Approvals"
                  value={overview.metrics.pendingAccountApprovals}
                />
                <StatTile label="Ed Vault Resources" value={overview.metrics.totalResources} />
                <StatTile label="Pending Uploads" value={overview.metrics.pendingResources} />
                <StatTile label="Announcements" value={overview.metrics.totalAnnouncements} />
                <StatTile
                  label="Marketplace Listings"
                  value={overview.metrics.totalMarketplaceListings}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-[#0C2924] mb-4">
                    Users by Role
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.charts.usersByRole}>
                        <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-[#0C2924] mb-4">
                    Ed Vault Materials by Category
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.charts.resourcesByCategory}>
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0C2924" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
              <tr>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">ID / Staff No</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usersList?.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#0C2924]">{u.fullName}</p>
                    <p className="text-stone-500">{u.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-[#0F766E]">{u.role}</span>
                    {u.requestedRole && (
                      <p className="text-amber-700">Requested: {u.requestedRole}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-stone-600">
                    {u.staffId || u.registrationNumber || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel status={u.accountStatus} />
                  </td>
                  <td className="py-3 px-4 flex flex-wrap gap-2">
                    {u.requestedRole && (
                      <button
                        type="button"
                        onClick={() => updateUser(u.id, { approveRequestedRole: true })}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                      >
                        Approve {u.requestedRole}
                      </button>
                    )}
                    {u.accountStatus !== 'SUSPENDED' ? (
                      <button
                        type="button"
                        onClick={() => updateUser(u.id, { accountStatus: 'SUSPENDED' })}
                        className="px-2.5 py-1 rounded border border-rose-300 text-rose-700 font-semibold"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateUser(u.id, { accountStatus: 'ACTIVE' })}
                        className="px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 font-semibold"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#0C2924]">
              Pending Academic Uploads
            </h3>
            {approvals?.pendingResources.length ? (
              approvals.pendingResources.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg border border-stone-200 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-mono text-[#0F766E]">{r.unitCode}</p>
                    <p className="text-sm font-semibold text-[#0C2924]">{r.title}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => moderateResource(r.id, 'APPROVED')}
                      aria-label="Approve resource"
                      className="p-1.5 rounded bg-emerald-600 text-white"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateResource(r.id, 'REJECTED')}
                      aria-label="Reject resource"
                      className="p-1.5 rounded bg-rose-600 text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-500">No pending resource uploads.</p>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#0C2924]">
              Open Content Reports
            </h3>
            {approvals?.openReports.length ? (
              approvals.openReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 rounded-lg border border-stone-200 space-y-2"
                >
                  <p className="text-xs font-semibold text-rose-700">
                    {rep.entityType} #{rep.entityId}
                  </p>
                  <p className="text-xs text-stone-700">{rep.reason}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolveReport(rep.id, true)}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-semibold"
                    >
                      Remove Content
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveReport(rep.id, false)}
                      className="px-2.5 py-1 rounded border border-stone-300 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-500">No open reports.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Target</th>
                <th className="py-3 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {auditLogs?.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-stone-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-stone-700">
                    {log.actorEmail || 'System'}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[#0C2924]">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-stone-600">
                    {log.targetType} #{log.targetId}
                  </td>
                  <td className="py-2.5 px-4 text-stone-600">{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

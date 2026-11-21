import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, UserCheck, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  LoadingSkeleton,
  ErrorBanner,
  Modal,
  StatusLabel,
} from '../components/ui/Primitives';
import type { OrganizationItem } from '../types';

interface OrgMemberRow {
  id: number;
  userId: number;
  roleTitle: string;
  status: string;
  fullName: string;
  department: string | null;
  course: string | null;
}

export const OrganizationsPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOrg, setManageOrg] = useState<OrganizationItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations', category],
    queryFn: async () => {
      const qs = category ? `?category=${category}` : '';
      const res = await api.get<{ organizations: OrganizationItem[] }>(
        `/community/organizations${qs}`
      );
      return res.data.organizations;
    },
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ['org-members', manageOrg?.id],
    queryFn: async () => {
      const res = await api.get<{ members: OrgMemberRow[] }>(
        `/community/organizations/${manageOrg!.id}/members`
      );
      return res.data.members;
    },
    enabled: Boolean(manageOrg),
  });

  const handleJoin = async (orgId: number) => {
    setErrorMsg(null);
    try {
      await api.post(`/community/organizations/${orgId}/join`);
      setSuccessMsg('Membership request sent to organization leaders.');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleRegisterOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/community/organizations', {
        name: fd.get('name'),
        category: fd.get('category'),
        description: fd.get('description'),
        mission: fd.get('mission'),
        meetingSchedule: fd.get('meetingSchedule'),
      });
      setCreateOpen(false);
      setSuccessMsg('Organization registration submitted.');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  const handleMemberDecision = async (
    memberId: number,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    if (!manageOrg) return;
    try {
      await api.patch(
        `/community/organizations/${manageOrg.id}/members/${memberId}`,
        { status }
      );
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Community & Organizations"
        subtitle="Explore student associations, technology clubs, cultural societies, and independent club workspaces."
        action={
          firebaseUser && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              <Plus className="w-4 h-4" />
              Register Organization
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

      <div className="flex flex-wrap gap-2">
        {[
          '',
          'TECH',
          'ACADEMIC',
          'CULTURAL',
          'RELIGIOUS',
          'SPORTS',
          'LEADERSHIP',
          'ASSOCIATION',
        ].map((cat) => (
          <button
            key={cat || 'ALL'}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              category === cat
                ? 'bg-[#0C2924] text-white border-[#0C2924]'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {cat || 'All Organizations'}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {orgs?.map((org) => {
          const canManage =
            dbUser &&
            (org.leaderId === dbUser.id ||
              dbUser.role === 'ADMIN' ||
              dbUser.role === 'SUPERADMIN');
          return (
            <article
              key={org.id}
              className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F766E]">{org.category}</span>
                  <StatusLabel status={org.approvalStatus} />
                </div>
                <h3 className="mt-2 text-base font-bold text-[#0C2924]">{org.name}</h3>
                <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                  {org.description}
                </p>
                <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                  <p className="tabular-nums flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {org.memberCount} approved members
                  </p>
                  {org.meetingSchedule && <p>{org.meetingSchedule}</p>}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                {firebaseUser &&
                  (org.myMembershipStatus ? (
                    <span className="text-xs font-semibold text-stone-600">
                      Membership: {org.myMembershipStatus}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleJoin(org.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E]"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Request to Join
                    </button>
                  ))}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setManageOrg(org)}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                  >
                    Manage Members
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Register Org Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register Student Organization"
      >
        <form onSubmit={handleRegisterOrg} className="space-y-4">
          <input
            name="name"
            required
            placeholder="Organization Name"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <select
            name="category"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="TECH">Technology Club</option>
            <option value="ACADEMIC">Academic Society</option>
            <option value="CULTURAL">Cultural Organization</option>
            <option value="RELIGIOUS">Religious Society</option>
            <option value="SPORTS">Sports Organization</option>
            <option value="LEADERSHIP">Student Leadership</option>
            <option value="ASSOCIATION">Student Association</option>
          </select>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Describe your organization's purpose..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="mission"
            placeholder="Mission statement (optional)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <input
            name="meetingSchedule"
            placeholder="Meeting schedule (e.g. Fridays 4 PM)"
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
              Submit Registration
            </button>
          </div>
        </form>
      </Modal>

      {/* Scoped Member Management Modal */}
      <Modal
        open={Boolean(manageOrg)}
        onClose={() => setManageOrg(null)}
        title={`Manage Members · ${manageOrg?.name ?? ''}`}
      >
        <div className="space-y-3">
          {members?.length ? (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200"
              >
                <div>
                  <p className="text-sm font-semibold text-[#0C2924]">{m.fullName}</p>
                  <p className="text-xs text-stone-500">
                    {m.roleTitle} · {m.department || 'Student'} · {m.status}
                  </p>
                </div>
                {m.status === 'PENDING' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMemberDecision(m.id, 'APPROVED')}
                      aria-label="Approve member"
                      className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMemberDecision(m.id, 'REJECTED')}
                      aria-label="Reject member"
                      className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-500 text-center py-6">
              No membership requests yet.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};

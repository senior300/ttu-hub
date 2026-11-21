import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Bookmark,
  Flag,
  Upload,
  Search,
  CalendarClock,
  FileText,
} from 'lucide-react';
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
import type {
  AcademicResource,
  AssignmentItem,
  TimetableEntry,
} from '../types';

export const AcademicsPage: React.FC = () => {
  const { dbUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'vault' | 'bookmarks' | 'timetables' | 'assignments'
  >('vault');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [school, setSchool] = useState('');
  const [page, setPage] = useState(1);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<AssignmentItem | null>(null);
  const [reportTarget, setReportTarget] = useState<AcademicResource | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const canUpload =
    dbUser &&
    dbUser.accountStatus === 'ACTIVE' &&
    ['LECTURER', 'ADMIN', 'SUPERADMIN'].includes(dbUser.role);

  const { data: vaultData, isLoading: vaultLoading } = useQuery({
    queryKey: ['resources', search, category, school, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '9' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (school) params.set('school', school);
      const res = await api.get<{
        resources: AcademicResource[];
        total: number;
      }>(`/academics/resources?${params.toString()}`);
      return res.data;
    },
  });

  const { data: bookmarksData } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const res = await api.get<{ bookmarks: AcademicResource[] }>(
        '/academics/resources/bookmarks/mine'
      );
      return res.data.bookmarks;
    },
    enabled: Boolean(firebaseUser) && activeTab === 'bookmarks',
  });

  const { data: timetablesData } = useQuery({
    queryKey: ['timetables'],
    queryFn: async () => {
      const res = await api.get<{ timetables: TimetableEntry[] }>(
        '/academics/timetables'
      );
      return res.data.timetables;
    },
    enabled: activeTab === 'timetables',
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const res = await api.get<{ assignments: AssignmentItem[] }>(
        '/academics/assignments'
      );
      return res.data.assignments;
    },
    enabled: Boolean(firebaseUser) && activeTab === 'assignments',
  });

  const handleToggleBookmark = async (resourceId: number) => {
    setActionError(null);
    try {
      await api.post(`/academics/resources/${resourceId}/bookmark`);
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await api.post('/academics/resources', formData);
      setUploadOpen(false);
      form.reset();
      setActionSuccess(
        dbUser?.role === 'LECTURER'
          ? 'Resource uploaded and submitted for administrator approval.'
          : 'Resource uploaded and published to Ed Vault.'
      );
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post('/academics/assignments', {
        unitCode: fd.get('unitCode'),
        unitName: fd.get('unitName'),
        title: fd.get('title'),
        instructions: fd.get('instructions'),
        dueDate: fd.get('dueDate'),
        maxScore: fd.get('maxScore'),
      });
      setAssignmentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setActionSuccess('Assignment published.');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!submitTarget) return;
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/academics/assignments/${submitTarget.id}/submit`, fd);
      setSubmitTarget(null);
      setActionSuccess('Assignment submission recorded.');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleReportResource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reportTarget) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/academics/resources/${reportTarget.id}/report`, {
        reason: fd.get('reason'),
      });
      setReportTarget(null);
      setActionSuccess('Resource report submitted for moderation.');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const totalPages = Math.max(1, Math.ceil((vaultData?.total ?? 0) / 9));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Hub — Ed Vault"
        subtitle="Verified lecture notes, past papers, revision guides, class and examination timetables, and unit assignments."
        action={
          canUpload && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
              >
                <Upload className="w-4 h-4" />
                Upload Material
              </button>
              <button
                type="button"
                onClick={() => setAssignmentOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-50"
              >
                New Assignment
              </button>
            </div>
          )
        }
      />

      {actionError && (
        <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-stone-200/75 rounded-lg">
        {[
          { id: 'vault', label: 'Ed Vault Library' },
          { id: 'bookmarks', label: 'Saved Bookmarks' },
          { id: 'timetables', label: 'Timetables' },
          { id: 'assignments', label: 'Assignments' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-[#0C2924] shadow-sm'
                : 'text-stone-600 hover:text-[#0C2924]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'vault' && (
        <>
          <div className="bg-white border border-stone-200 rounded-xl p-4 grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search unit code, title, or course..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
              />
            </div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            >
              <option value="">All Categories</option>
              <option value="NOTES">Lecture Notes</option>
              <option value="PAST_PAPER">Past Papers</option>
              <option value="REVISION">Revision Guides</option>
              <option value="ASSIGNMENT">Assignments</option>
              <option value="DOCUMENT">Documents</option>
            </select>
            <select
              value={school}
              onChange={(e) => {
                setSchool(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            >
              <option value="">All Schools</option>
              <option value="School of Mines and Engineering">
                School of Mines and Engineering
              </option>
              <option value="School of Science and Informatics">
                School of Science and Informatics
              </option>
              <option value="School of Business, Economics and Social Sciences">
                School of Business & Social Sciences
              </option>
            </select>
          </div>

          {vaultLoading && <LoadingSkeleton rows={3} />}

          {!vaultLoading && vaultData?.resources.length === 0 && (
            <EmptyState
              title="No matching academic resources"
              description="Adjust your search query or category filter to explore available notes and past papers."
            />
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vaultData?.resources.map((res) => (
              <article
                key={res.id}
                className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#0F766E]">
                      {res.unitCode} · {res.category.replace('_', ' ')}
                    </span>
                    <StatusLabel status={res.approvalStatus} />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-[#0C2924] line-clamp-2">
                    {res.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 line-clamp-2">
                    {res.description}
                  </p>
                  <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                    <p className="truncate">{res.course}</p>
                    <p>
                      {res.academicYear} · {res.semester} ·{' '}
                      <span className="tabular-nums">{res.downloadCount}</span> downloads
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <a
                    href={`/api/academics/resources/${res.id}/download`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                  {firebaseUser && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(res.id)}
                        aria-label="Bookmark resource"
                        className={`p-2 rounded-lg border text-xs ${
                          res.isBookmarked
                            ? 'border-[#0F766E] text-[#0F766E] bg-teal-50'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportTarget(res)}
                        aria-label="Report resource"
                        className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:text-rose-600 hover:bg-stone-50"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-stone-500 tabular-nums">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          {!firebaseUser ? (
            <EmptyState
              title="Sign in to view saved bookmarks"
              description="Your bookmarked notes and past papers stay synced across sessions."
            />
          ) : !bookmarksData?.length ? (
            <EmptyState
              title="No bookmarked resources yet"
              description="Click the bookmark icon on any approved Ed Vault resource to save it here."
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {bookmarksData.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-mono text-[#0F766E]">{r.unitCode}</p>
                    <p className="text-sm font-bold text-[#0C2924] mt-0.5">{r.title}</p>
                    <p className="text-xs text-stone-500 mt-1">{r.course}</p>
                  </div>
                  <a
                    href={`/api/academics/resources/${r.id}/download`}
                    className="px-3 py-1.5 rounded-lg bg-[#0C2924] text-white text-xs font-semibold hover:bg-[#0F766E] shrink-0"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'timetables' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#0F766E]" />
            <h2 className="text-sm font-bold text-[#0C2924]">
              Class & Examination Schedules
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Course</th>
                  <th className="py-3 px-4 font-semibold">Unit</th>
                  <th className="py-3 px-4 font-semibold">Day / Date</th>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">Venue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {timetablesData?.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-semibold text-[#0F766E]">
                      {t.entryType}
                    </td>
                    <td className="py-3 px-4 text-stone-700">{t.courseName}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-[#0C2924]">
                        {t.unitCode}
                      </span>{' '}
                      · {t.unitName}
                    </td>
                    <td className="py-3 px-4 text-stone-700">{t.dayOrDate}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-stone-700">
                      {t.startTime}–{t.endTime}
                    </td>
                    <td className="py-3 px-4 text-stone-700">{t.venue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {!firebaseUser ? (
            <EmptyState
              title="Sign in to view unit assignments"
              description="View coursework deadlines and submit PDF or DOCX assignments."
            />
          ) : !assignmentsData?.length ? (
            <EmptyState
              title="No active assignments"
              description="Coursework tasks published by lecturers will appear here."
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {assignmentsData.map((a) => (
                <div
                  key={a.id}
                  className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-[#0F766E]">
                        {a.unitCode} · {a.unitName}
                      </span>
                      <span className="text-stone-500 tabular-nums">
                        Due {a.dueDate}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-[#0C2924]">
                      {a.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-stone-600">{a.instructions}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-500 tabular-nums">
                      Max {a.maxScore} marks
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubmitTarget(a)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Submit Work
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Resource Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Learning Material to Ed Vault"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Resource Title
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category
              </label>
              <select
                name="category"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              >
                <option value="NOTES">Lecture Notes</option>
                <option value="REVISION">Revision Guide</option>
                <option value="PAST_PAPER">Past Paper</option>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="DOCUMENT">Documents</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Unit Code
              </label>
              <input
                name="unitCode"
                required
                placeholder="ICS 2304"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Unit Name
              </label>
              <input
                name="unitName"
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Course
              </label>
              <input
                name="course"
                required
                defaultValue="B.Sc. Computer Science"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                School
              </label>
              <select
                name="school"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              >
                <option value="School of Science and Informatics">
                  School of Science and Informatics
                </option>
                <option value="School of Mines and Engineering">
                  School of Mines and Engineering
                </option>
                <option value="School of Business, Economics and Social Sciences">
                  School of Business & Social Sciences
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Department
              </label>
              <input
                name="department"
                required
                defaultValue="Mathematics and Informatics"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Academic Year
              </label>
              <input
                name="academicYear"
                required
                defaultValue="2026/2027"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Semester
              </label>
              <select
                name="semester"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              required
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              File (PDF, DOCX, PPTX, TXT · Max 10 MB)
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.docx,.pptx,.txt"
              className="w-full text-xs text-stone-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Upload Material
            </button>
          </div>
        </form>
      </Modal>

      {/* New Assignment Modal */}
      <Modal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        title="Publish Unit Assignment"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              name="unitCode"
              required
              placeholder="Unit Code (ICS 2304)"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <input
              name="unitName"
              required
              placeholder="Unit Name"
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <input
            name="title"
            required
            placeholder="Assignment Title"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <textarea
            name="instructions"
            required
            rows={3}
            placeholder="Instructions and deliverables..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="dueDate"
              type="date"
              required
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <input
              name="maxScore"
              type="number"
              defaultValue={30}
              min={5}
              max={100}
              className="px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAssignmentOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Publish
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Assignment Modal */}
      <Modal
        open={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title={`Submit: ${submitTarget?.title ?? ''}`}
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-4">
          <textarea
            name="notes"
            rows={3}
            placeholder="Optional submission notes or summary..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Attachment (PDF, DOCX, PPTX, TXT)
            </label>
            <input
              name="file"
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              className="w-full text-xs text-stone-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSubmitTarget(null)}
              className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#115E59]"
            >
              Submit Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Report Modal */}
      <Modal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        title="Report Resource"
      >
        <form onSubmit={handleReportResource} className="space-y-4">
          <p className="text-xs text-stone-600">
            Flag "{reportTarget?.title}" for administrator review.
          </p>
          <textarea
            name="reason"
            required
            rows={3}
            placeholder="Describe why this file should be reviewed..."
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

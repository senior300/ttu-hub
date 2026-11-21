import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, extractErrorMessage } from '../services/api';
import {
  PageHeader,
  ErrorBanner,
  StatusLabel,
} from '../components/ui/Primitives';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  requestedRole: z.enum(['STUDENT', 'LECTURER', 'ORGANIZATION_LEADER']),
  registrationNumber: z.string().optional(),
  staffId: z.string().optional(),
  school: z.string().optional(),
  department: z.string().optional(),
  course: z.string().optional(),
  yearOfStudy: z.coerce.number().int().min(1).max(6).optional(),
  currentSemester: z.string().optional(),
  phoneNumber: z.string().optional(),
  bio: z.string().max(500).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const ProfilePage: React.FC = () => {
  const { dbUser, firebaseUser, canClaimSuperAdmin, refreshProfile, signInWithGoogle } =
    useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: {
      fullName: '',
      requestedRole: 'STUDENT',
      yearOfStudy: 1,
      currentSemester: 'Semester 1',
    },
  });

  useEffect(() => {
    if (dbUser) {
      reset({
        fullName: dbUser.fullName,
        requestedRole:
          (dbUser.requestedRole as 'STUDENT' | 'LECTURER' | 'ORGANIZATION_LEADER') ||
          (dbUser.role === 'LECTURER' || dbUser.role === 'ORGANIZATION_LEADER'
            ? dbUser.role
            : 'STUDENT'),
        registrationNumber: dbUser.registrationNumber || '',
        staffId: dbUser.staffId || '',
        school: dbUser.school || 'School of Science and Informatics',
        department: dbUser.department || 'Mathematics and Informatics',
        course: dbUser.course || 'B.Sc. Computer Science',
        yearOfStudy: dbUser.yearOfStudy || 1,
        currentSemester: dbUser.currentSemester || 'Semester 1',
        phoneNumber: dbUser.phoneNumber || '',
        bio: dbUser.bio || '',
      });
    }
  }, [dbUser, reset]);

  const selectedRole = watch('requestedRole');

  if (!firebaseUser || !dbUser) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-lg mx-auto my-8">
        <h2 className="text-xl font-bold text-[#0C2924]">Sign in to manage your profile</h2>
        <p className="mt-2 text-sm text-stone-600">
          Authenticate with Google to complete your TTU HUB student or staff profile.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-5 px-5 py-2.5 rounded-lg bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#115E59]"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const onSubmit = async (values: ProfileFormValues) => {
    setServerError(null);
    setSuccessMsg(null);
    try {
      await api.put('/auth/profile', values);
      await refreshProfile();
      setSuccessMsg('Profile saved successfully.');
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Failed to save profile.'));
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setServerError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post('/auth/avatar', formData);
      await refreshProfile();
      setSuccessMsg('Profile photo updated.');
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Avatar upload failed.'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleClaimSuperAdmin = async () => {
    setServerError(null);
    try {
      await api.post('/auth/claim-superadmin');
      await refreshProfile();
      setSuccessMsg('SuperAdmin privileges claimed for initial platform setup.');
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Account & Profile"
        subtitle="Manage your university registration details, role verification, and profile picture."
      />

      {serverError && (
        <ErrorBanner message={serverError} onDismiss={() => setServerError(null)} />
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {canClaimSuperAdmin && dbUser.role !== 'SUPERADMIN' && (
        <div className="bg-[#0C2924] text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Initial Platform Administrator Setup</p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                No SuperAdmin has been assigned yet. Claim initial SuperAdmin access to manage user approvals and system configuration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClaimSuperAdmin}
            className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D9488] shrink-0"
          >
            Claim SuperAdmin
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {dbUser.avatarUrl ? (
            <img
              src={dbUser.avatarUrl}
              alt={dbUser.fullName}
              className="w-16 h-16 rounded-full object-cover border border-stone-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#0C2924] text-white flex items-center justify-center font-bold text-xl">
              {dbUser.fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-base font-bold text-[#0C2924]">{dbUser.fullName}</p>
            <p className="text-xs text-stone-500">{dbUser.email}</p>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#0F766E]">{dbUser.role}</span>
              <span aria-hidden="true">·</span>
              <StatusLabel status={dbUser.accountStatus} />
            </div>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer shrink-0">
          <Upload className="w-4 h-4" />
          <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </label>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white border border-stone-200 rounded-xl p-6 space-y-5"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Full Name
            </label>
            <input
              {...register('fullName')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            />
            {errors.fullName && (
              <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>
            )}
          </div>

          {dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Role
              </label>
              <select
                {...register('requestedRole')}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
              >
                <option value="STUDENT">Student</option>
                <option value="LECTURER">Lecturer (Requires Admin Approval)</option>
                <option value="ORGANIZATION_LEADER">
                  Organization Leader (Requires Admin Approval)
                </option>
              </select>
            </div>
          )}

          {selectedRole === 'LECTURER' ? (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Staff Identification Number
              </label>
              <input
                {...register('staffId')}
                placeholder="e.g. TTU/STF/1042"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Registration Number
              </label>
              <input
                {...register('registrationNumber')}
                placeholder="e.g. TU01-SC211-0045/2024"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Phone Number
            </label>
            <input
              {...register('phoneNumber')}
              placeholder="+254 7XX XXX XXX"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              School
            </label>
            <select
              {...register('school')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            >
              <option value="School of Mines and Engineering">
                School of Mines and Engineering
              </option>
              <option value="School of Science and Informatics">
                School of Science and Informatics
              </option>
              <option value="School of Business, Economics and Social Sciences">
                School of Business, Economics and Social Sciences
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Department
            </label>
            <input
              {...register('department')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
            />
          </div>

          {selectedRole !== 'LECTURER' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Course / Programme
                </label>
                <input
                  {...register('course')}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Year of Study
                  </label>
                  <select
                    {...register('yearOfStudy')}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
                  >
                    {[1, 2, 3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Semester
                  </label>
                  <select
                    {...register('currentSemester')}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Short Bio
          </label>
          <textarea
            rows={3}
            {...register('bio')}
            placeholder="Academic interests, clubs, or office hours..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0F766E]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg bg-[#0C2924] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

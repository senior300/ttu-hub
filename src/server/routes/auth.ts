import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  academicResources,
  resourceBookmarks,
  announcements,
  events,
  eventRegistrations,
  timetables,
  notifications,
  accommodations,
  opportunities,
  marketplaceListings,
  organizations,
  organizationMembers,
  assignments,
  assignmentSubmissions,
} from '../../db/schema.ts';
import {
  requireAuth,
  type AuthRequest,
  canClaimInitialSuperAdmin,
  logAudit,
  notifyUser,
} from '../middleware/auth.ts';
import {
  imageUpload,
  validateImageBuffer,
  persistUploadedBuffer,
} from '../utils/uploads.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  requestedRole: z
    .enum(['STUDENT', 'LECTURER', 'ORGANIZATION_LEADER'])
    .optional(),
  registrationNumber: z.string().trim().max(40).optional().nullable(),
  staffId: z.string().trim().max(40).optional().nullable(),
  school: z.string().trim().max(150).optional().nullable(),
  department: z.string().trim().max(150).optional().nullable(),
  course: z.string().trim().max(150).optional().nullable(),
  yearOfStudy: z.coerce.number().int().min(1).max(6).optional().nullable(),
  currentSemester: z.string().trim().max(40).optional().nullable(),
  phoneNumber: z.string().trim().max(30).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
});

router.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const claimAvailable = await canClaimInitialSuperAdmin();
    res.json({
      user: req.dbUser,
      canClaimSuperAdmin: claimAvailable,
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Unable to load profile.' });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const current = req.dbUser!;

    let nextRole = current.role;
    let nextStatus = current.accountStatus;
    let nextRequestedRole = current.requestedRole;

    // Only allow non-admin users to switch/request Student, Lecturer, or Org Leader.
    // Lecturer and Organization Leader requests require admin approval unless already approved.
    if (
      data.requestedRole &&
      current.role !== 'ADMIN' &&
      current.role !== 'SUPERADMIN'
    ) {
      if (data.requestedRole === 'STUDENT') {
        if (current.role === 'STUDENT') {
          nextRole = 'STUDENT';
          nextStatus = 'ACTIVE';
          nextRequestedRole = null;
        }
      } else if (
        data.requestedRole === 'LECTURER' &&
        current.role !== 'LECTURER'
      ) {
        if (!data.staffId || data.staffId.trim().length < 3) {
          return res.status(400).json({
            error: 'Staff identification number is required for lecturer verification.',
          });
        }
        nextRequestedRole = 'LECTURER';
        nextStatus = 'PENDING_APPROVAL';
      } else if (
        data.requestedRole === 'ORGANIZATION_LEADER' &&
        current.role !== 'ORGANIZATION_LEADER'
      ) {
        nextRequestedRole = 'ORGANIZATION_LEADER';
        nextStatus = 'PENDING_APPROVAL';
      }
    }

    if (
      (nextRole === 'STUDENT' && !nextRequestedRole) &&
      (!data.registrationNumber || data.registrationNumber.trim().length < 3)
    ) {
      return res.status(400).json({
        error: 'Student registration number is required.',
      });
    }

    const [updated] = await db
      .update(users)
      .set({
        fullName: data.fullName,
        role: nextRole,
        requestedRole: nextRequestedRole,
        accountStatus: nextStatus,
        profileCompleted: true,
        registrationNumber: data.registrationNumber ?? current.registrationNumber,
        staffId: data.staffId ?? current.staffId,
        school: data.school ?? current.school,
        department: data.department ?? current.department,
        course: data.course ?? current.course,
        yearOfStudy: data.yearOfStudy ?? current.yearOfStudy,
        currentSemester: data.currentSemester ?? current.currentSemester,
        phoneNumber: data.phoneNumber ?? current.phoneNumber,
        bio: data.bio ?? current.bio,
        updatedAt: new Date(),
      })
      .where(eq(users.id, current.id))
      .returning();

    if (nextStatus === 'PENDING_APPROVAL' && nextRequestedRole) {
      await notifyUser(
        current.id,
        'APPROVAL',
        'Role Verification Submitted',
        `Your request for ${nextRequestedRole.replace('_', ' ')} access has been queued for administrator review.`,
        '/profile'
      );
      await logAudit(
        current,
        'ROLE_APPROVAL_REQUESTED',
        'USER',
        current.id,
        `Requested role: ${nextRequestedRole}`
      );
    }

    res.json({ user: updated });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

router.post('/claim-superadmin', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allowed = await canClaimInitialSuperAdmin();
    if (!allowed) {
      return res.status(403).json({
        error: 'Initial SuperAdmin has already been claimed for this platform.',
      });
    }

    const current = req.dbUser!;
    const [updated] = await db
      .update(users)
      .set({
        role: 'SUPERADMIN',
        requestedRole: null,
        accountStatus: 'ACTIVE',
        profileCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, current.id))
      .returning();

    await logAudit(
      updated,
      'INITIAL_SUPERADMIN_CLAIMED',
      'USER',
      updated.id,
      `Claimed by ${updated.email}`
    );

    res.json({ user: updated });
  } catch (err) {
    console.error('Error claiming superadmin:', err);
    res.status(500).json({ error: 'Failed to claim SuperAdmin role.' });
  }
});

router.post(
  '/avatar',
  requireAuth,
  imageUpload.single('avatar'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
      }
      const check = validateImageBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      const saved = persistUploadedBuffer('avatars', req.file.buffer, check.ext);
      const [updated] = await db
        .update(users)
        .set({ avatarUrl: saved.publicUrl, updatedAt: new Date() })
        .where(eq(users.id, req.dbUser!.id))
        .returning();

      res.json({ avatarUrl: saved.publicUrl, user: updated });
    } catch (err) {
      console.error('Avatar upload failed:', err);
      res.status(500).json({ error: 'Failed to upload profile photo.' });
    }
  }
);

router.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const user = req.dbUser!;

    const [
      recentResources,
      savedBookmarks,
      recentAnnouncements,
      upcomingEvents,
      userTimetables,
      userNotifications,
      marketplaceHighlights,
      accommodationHighlights,
      opportunityHighlights,
      myRegistrations,
    ] = await Promise.all([
      db
        .select()
        .from(academicResources)
        .where(
          and(
            eq(academicResources.approvalStatus, 'APPROVED'),
            isNull(academicResources.deletedAt)
          )
        )
        .orderBy(desc(academicResources.createdAt))
        .limit(5),
      db
        .select({
          bookmarkId: resourceBookmarks.id,
          resource: academicResources,
        })
        .from(resourceBookmarks)
        .innerJoin(
          academicResources,
          eq(resourceBookmarks.resourceId, academicResources.id)
        )
        .where(eq(resourceBookmarks.userId, user.id))
        .orderBy(desc(resourceBookmarks.createdAt))
        .limit(5),
      db
        .select()
        .from(announcements)
        .where(
          and(
            eq(announcements.approvalStatus, 'APPROVED'),
            isNull(announcements.deletedAt)
          )
        )
        .orderBy(desc(announcements.createdAt))
        .limit(5),
      db
        .select()
        .from(events)
        .where(eq(events.approvalStatus, 'APPROVED'))
        .orderBy(events.startAt)
        .limit(5),
      db.select().from(timetables).limit(10),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(6),
      db
        .select()
        .from(marketplaceListings)
        .where(
          and(
            eq(marketplaceListings.moderationStatus, 'APPROVED'),
            eq(marketplaceListings.availabilityStatus, 'AVAILABLE'),
            isNull(marketplaceListings.deletedAt)
          )
        )
        .orderBy(desc(marketplaceListings.createdAt))
        .limit(4),
      db
        .select()
        .from(accommodations)
        .where(eq(accommodations.moderationStatus, 'APPROVED'))
        .orderBy(desc(accommodations.createdAt))
        .limit(3),
      db
        .select()
        .from(opportunities)
        .where(eq(opportunities.approvalStatus, 'APPROVED'))
        .orderBy(desc(opportunities.createdAt))
        .limit(4),
      db
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.userId, user.id)),
    ]);

    let roleExtras: Record<string, unknown> = {};

    if (user.role === 'LECTURER') {
      const [myUploads, myAssignments, submissionsCount] = await Promise.all([
        db
          .select()
          .from(academicResources)
          .where(
            and(
              eq(academicResources.uploadedById, user.id),
              isNull(academicResources.deletedAt)
            )
          )
          .orderBy(desc(academicResources.createdAt)),
        db
          .select()
          .from(assignments)
          .where(eq(assignments.lecturerId, user.id))
          .orderBy(desc(assignments.createdAt)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(assignmentSubmissions)
          .innerJoin(
            assignments,
            eq(assignmentSubmissions.assignmentId, assignments.id)
          )
          .where(eq(assignments.lecturerId, user.id)),
      ]);
      roleExtras = {
        myUploads,
        myAssignments,
        submissionsCount: submissionsCount[0]?.count ?? 0,
      };
    } else if (user.role === 'ORGANIZATION_LEADER') {
      const myOrgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.leaderId, user.id));
      const orgIds = myOrgs.map((o) => o.id);
      let pendingMembers = 0;
      if (orgIds.length > 0) {
        const counts = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, orgIds[0]),
              eq(organizationMembers.status, 'PENDING')
            )
          );
        pendingMembers = counts[0]?.count ?? 0;
      }
      roleExtras = { myOrgs, pendingMembers };
    } else if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      const [userCounts, pendingRes, pendingApprovals] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(academicResources)
          .where(eq(academicResources.approvalStatus, 'PENDING')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.accountStatus, 'PENDING_APPROVAL')),
      ]);
      roleExtras = {
        totalUsers: userCounts[0]?.count ?? 0,
        pendingResources: pendingRes[0]?.count ?? 0,
        pendingAccountApprovals: pendingApprovals[0]?.count ?? 0,
      };
    }

    res.json({
      user,
      recentResources,
      savedBookmarks: savedBookmarks.map((b) => b.resource),
      recentAnnouncements,
      upcomingEvents,
      timetables: userTimetables,
      notifications: userNotifications,
      marketplaceHighlights,
      accommodationHighlights,
      opportunityHighlights,
      registeredEventIds: myRegistrations.map((r) => r.eventId),
      roleExtras,
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).json({ error: 'Unable to load dashboard data.' });
  }
});

export default router;

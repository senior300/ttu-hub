import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  academicResources,
  announcements,
  events,
  marketplaceListings,
  organizations,
  opportunities,
  contentReports,
  auditLogs,
  schools,
  departments,
  courses,
  units,
  timetables,
} from '../../db/schema.ts';
import {
  requireAuth,
  requireRole,
  type AuthRequest,
  logAudit,
  notifyUser,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

router.get('/overview', async (_req, res) => {
  try {
    const [
      userRoleCounts,
      pendingApprovals,
      resourceStats,
      announcementCount,
      eventCount,
      marketplaceCount,
      recentAudit,
      resourcesByCategory,
    ] = await Promise.all([
      db
        .select({
          role: users.role,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(sql`${users.uid} NOT LIKE 'system-%'`)
        .groupBy(users.role),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.accountStatus, 'PENDING_APPROVAL')),
      db
        .select({
          approvalStatus: academicResources.approvalStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(academicResources)
        .groupBy(academicResources.approvalStatus),
      db.select({ count: sql<number>`count(*)::int` }).from(announcements),
      db.select({ count: sql<number>`count(*)::int` }).from(events),
      db.select({ count: sql<number>`count(*)::int` }).from(marketplaceListings),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(15),
      db
        .select({
          category: academicResources.category,
          count: sql<number>`count(*)::int`,
        })
        .from(academicResources)
        .groupBy(academicResources.category),
    ]);

    const roleMap = new Map(userRoleCounts.map((r) => [r.role, r.count]));
    const resMap = new Map(resourceStats.map((r) => [r.approvalStatus, r.count]));
    const totalUsers = userRoleCounts.reduce((acc, r) => acc + r.count, 0);

    res.json({
      metrics: {
        totalUsers,
        totalStudents: roleMap.get('STUDENT') ?? 0,
        totalLecturers: roleMap.get('LECTURER') ?? 0,
        pendingAccountApprovals: pendingApprovals[0]?.count ?? 0,
        totalResources:
          (resMap.get('APPROVED') ?? 0) +
          (resMap.get('PENDING') ?? 0) +
          (resMap.get('REJECTED') ?? 0),
        pendingResources: resMap.get('PENDING') ?? 0,
        totalAnnouncements: announcementCount[0]?.count ?? 0,
        totalEvents: eventCount[0]?.count ?? 0,
        totalMarketplaceListings: marketplaceCount[0]?.count ?? 0,
      },
      charts: {
        usersByRole: userRoleCounts,
        resourcesByCategory,
      },
      recentAudit,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const list = await db
      .select({
        id: users.id,
        publicId: users.publicId,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        requestedRole: users.requestedRole,
        accountStatus: users.accountStatus,
        registrationNumber: users.registrationNumber,
        staffId: users.staffId,
        school: users.school,
        department: users.department,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.uid} NOT LIKE 'system-%'`)
      .orderBy(desc(users.createdAt));

    res.json({ users: list });
  } catch (err) {
    console.error('Admin users fetch error:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      role: z
        .enum(['STUDENT', 'LECTURER', 'ORGANIZATION_LEADER', 'ADMIN', 'SUPERADMIN'])
        .optional(),
      accountStatus: z.enum(['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED']).optional(),
      approveRequestedRole: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user update payload.' });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Only SUPERADMIN may assign ADMIN or SUPERADMIN roles
    if (
      (parsed.data.role === 'ADMIN' || parsed.data.role === 'SUPERADMIN') &&
      req.dbUser!.role !== 'SUPERADMIN'
    ) {
      return res.status(403).json({
        error: 'Only a SuperAdmin can assign Administrator or SuperAdmin roles.',
      });
    }

    let nextRole = parsed.data.role ?? target.role;
    let nextStatus = parsed.data.accountStatus ?? target.accountStatus;
    let nextRequested = target.requestedRole;

    if (parsed.data.approveRequestedRole && target.requestedRole) {
      nextRole = target.requestedRole;
      nextStatus = 'ACTIVE';
      nextRequested = null;
    }

    const [updated] = await db
      .update(users)
      .set({
        role: nextRole,
        accountStatus: nextStatus,
        requestedRole: nextRequested,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    await logAudit(
      req.dbUser!,
      'USER_UPDATED',
      'USER',
      id,
      `role=${nextRole}, status=${nextStatus}`
    );

    await notifyUser(
      id,
      'APPROVAL',
      'Account Status Updated',
      `Your account is now ${nextStatus.toLowerCase().replace('_', ' ')} with role ${nextRole}.`,
      '/dashboard'
    );

    res.json({ user: updated });
  } catch (err) {
    console.error('Admin user update error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.get('/approvals', async (_req, res) => {
  try {
    const [
      pendingResources,
      pendingOrgs,
      pendingOpps,
      openReports,
      pendingUsers,
    ] = await Promise.all([
      db
        .select()
        .from(academicResources)
        .where(eq(academicResources.approvalStatus, 'PENDING'))
        .orderBy(desc(academicResources.createdAt)),
      db
        .select()
        .from(organizations)
        .where(eq(organizations.approvalStatus, 'PENDING')),
      db
        .select()
        .from(opportunities)
        .where(eq(opportunities.approvalStatus, 'PENDING')),
      db
        .select()
        .from(contentReports)
        .where(eq(contentReports.status, 'OPEN'))
        .orderBy(desc(contentReports.createdAt)),
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          requestedRole: users.requestedRole,
          staffId: users.staffId,
          department: users.department,
        })
        .from(users)
        .where(eq(users.accountStatus, 'PENDING_APPROVAL')),
    ]);

    res.json({
      pendingResources,
      pendingOrgs,
      pendingOpps,
      openReports,
      pendingUsers,
    });
  } catch (err) {
    console.error('Admin approvals fetch error:', err);
    res.status(500).json({ error: 'Failed to load pending approvals.' });
  }
});

router.patch('/resources/:id/moderate', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      approvalStatus: z.enum(['APPROVED', 'REJECTED']),
      rejectionReason: z.string().trim().max(400).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid moderation payload.' });
    }

    const [updated] = await db
      .update(academicResources)
      .set({
        approvalStatus: parsed.data.approvalStatus,
        rejectionReason: parsed.data.rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(academicResources.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    await logAudit(
      req.dbUser!,
      `RESOURCE_${parsed.data.approvalStatus}`,
      'ACADEMIC_RESOURCE',
      id,
      parsed.data.rejectionReason
    );

    await notifyUser(
      updated.uploadedById,
      'RESOURCE',
      `Resource ${parsed.data.approvalStatus}`,
      `Your upload "${updated.title}" was ${parsed.data.approvalStatus.toLowerCase()}.`,
      '/academics'
    );

    res.json({ resource: updated });
  } catch (err) {
    console.error('Moderate resource error:', err);
    res.status(500).json({ error: 'Failed to moderate resource.' });
  }
});

router.patch('/organizations/:id/moderate', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ approvalStatus: z.enum(['APPROVED', 'PENDING']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid organization moderation status.' });
    }

    const [updated] = await db
      .update(organizations)
      .set({ approvalStatus: parsed.data.approvalStatus, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();

    await logAudit(req.dbUser!, 'ORG_MODERATED', 'ORGANIZATION', id, parsed.data.approvalStatus);
    res.json({ organization: updated });
  } catch (err) {
    console.error('Moderate org error:', err);
    res.status(500).json({ error: 'Failed to moderate organization.' });
  }
});

router.patch('/opportunities/:id/moderate', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ approvalStatus: z.enum(['APPROVED', 'REJECTED']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const [updated] = await db
      .update(opportunities)
      .set({ approvalStatus: parsed.data.approvalStatus })
      .where(eq(opportunities.id, id))
      .returning();

    await logAudit(req.dbUser!, 'OPPORTUNITY_MODERATED', 'OPPORTUNITY', id, parsed.data.approvalStatus);
    res.json({ opportunity: updated });
  } catch (err) {
    console.error('Moderate opportunity error:', err);
    res.status(500).json({ error: 'Failed to moderate opportunity.' });
  }
});

router.patch('/reports/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['RESOLVED', 'DISMISSED']),
      removeContent: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid report resolution.' });
    }

    const [report] = await db
      .update(contentReports)
      .set({
        status: parsed.data.status,
        reviewedById: req.dbUser!.id,
      })
      .where(eq(contentReports.id, id))
      .returning();

    if (report && parsed.data.removeContent) {
      if (report.entityType === 'MARKETPLACE') {
        await db
          .update(marketplaceListings)
          .set({ moderationStatus: 'REMOVED' })
          .where(eq(marketplaceListings.id, report.entityId));
      } else if (report.entityType === 'ACADEMIC_RESOURCE') {
        await db
          .update(academicResources)
          .set({ deletedAt: new Date() })
          .where(eq(academicResources.id, report.entityId));
      }
    }

    await logAudit(req.dbUser!, 'REPORT_REVIEWED', 'CONTENT_REPORT', id, parsed.data.status);
    res.json({ report });
  } catch (err) {
    console.error('Report resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve report.' });
  }
});

router.post('/academics/departments', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      schoolId: z.coerce.number().int().positive(),
      code: z.string().trim().min(2).max(20),
      name: z.string().trim().min(3).max(140),
      headName: z.string().trim().max(120).optional(),
      officeLocation: z.string().trim().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid department details.' });
    }

    const [created] = await db
      .insert(departments)
      .values({ ...parsed.data, code: parsed.data.code.toUpperCase() })
      .returning();

    await logAudit(req.dbUser!, 'DEPARTMENT_CREATED', 'DEPARTMENT', created.id, created.name);
    res.status(201).json({ department: created });
  } catch (err) {
    console.error('Create department error:', err);
    res.status(400).json({ error: 'Unable to create department (code may already exist).' });
  }
});

router.post('/academics/courses', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      departmentId: z.coerce.number().int().positive(),
      code: z.string().trim().min(2).max(20),
      name: z.string().trim().min(3).max(150),
      level: z.enum(['BACHELORS', 'DIPLOMA', 'MASTERS']).default('BACHELORS'),
      durationYears: z.coerce.number().int().min(1).max(6).default(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid course details.' });
    }

    const [created] = await db
      .insert(courses)
      .values({ ...parsed.data, code: parsed.data.code.toUpperCase() })
      .returning();

    await logAudit(req.dbUser!, 'COURSE_CREATED', 'COURSE', created.id, created.name);
    res.status(201).json({ course: created });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(400).json({ error: 'Unable to create course.' });
  }
});

router.post('/academics/timetables', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      courseName: z.string().trim().min(2).max(150),
      unitCode: z.string().trim().min(2).max(30),
      unitName: z.string().trim().min(2).max(150),
      entryType: z.enum(['CLASS', 'EXAM']),
      dayOrDate: z.string().trim().min(2).max(40),
      startTime: z.string().trim().min(2).max(20),
      endTime: z.string().trim().min(2).max(20),
      venue: z.string().trim().min(2).max(100),
      semester: z.string().trim().default('Semester 1'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid timetable entry.' });
    }

    const [created] = await db.insert(timetables).values(parsed.data).returning();
    res.status(201).json({ timetable: created });
  } catch (err) {
    console.error('Create timetable error:', err);
    res.status(500).json({ error: 'Failed to add timetable entry.' });
  }
});

router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json({ logs });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '');
  // Neutralize CSV formula injection prefixes
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get('/export/:entity', async (req: AuthRequest, res) => {
  try {
    const entity = req.params.entity;
    let headers: string[] = [];
    let rows: Array<Array<unknown>> = [];

    if (entity === 'users') {
      const data = await db.select().from(users).orderBy(users.id);
      headers = ['ID', 'Full Name', 'Email', 'Role', 'Status', 'Department', 'Created At'];
      rows = data.map((u) => [
        u.id,
        u.fullName,
        u.email,
        u.role,
        u.accountStatus,
        u.department,
        u.createdAt.toISOString(),
      ]);
    } else if (entity === 'resources') {
      const data = await db.select().from(academicResources).orderBy(academicResources.id);
      headers = ['ID', 'Unit Code', 'Title', 'Category', 'Status', 'Downloads'];
      rows = data.map((r) => [
        r.id,
        r.unitCode,
        r.title,
        r.category,
        r.approvalStatus,
        r.downloadCount,
      ]);
    } else if (entity === 'audit') {
      const data = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
      headers = ['ID', 'Actor', 'Action', 'Target Type', 'Target ID', 'Details', 'Timestamp'];
      rows = data.map((a) => [
        a.id,
        a.actorEmail,
        a.action,
        a.targetType,
        a.targetId,
        a.details,
        a.createdAt.toISOString(),
      ]);
    } else {
      return res.status(400).json({ error: 'Unsupported export entity.' });
    }

    const csv = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ].join('\n');

    await logAudit(req.dbUser!, 'DATA_EXPORTED', 'EXPORT', entity);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ttu-hub-${entity}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Failed to export CSV data.' });
  }
});

// Unused imports check guard for schools/units
void schools;
void units;

export default router;

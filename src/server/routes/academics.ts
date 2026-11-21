import fs from 'fs';
import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  schools,
  departments,
  courses,
  units,
  timetables,
  academicResources,
  resourceBookmarks,
  assignments,
  assignmentSubmissions,
  contentReports,
  users,
} from '../../db/schema.ts';
import {
  optionalAuth,
  requireAuth,
  requireRole,
  type AuthRequest,
  logAudit,
  notifyUser,
} from '../middleware/auth.ts';
import {
  academicUpload,
  validateAcademicBuffer,
  persistUploadedBuffer,
  resolveSafeUploadPath,
} from '../utils/uploads.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

router.get('/structure', async (_req, res) => {
  try {
    await ensureSeeded();
    const [schoolList, departmentList, courseList, unitList] = await Promise.all([
      db.select().from(schools).orderBy(schools.name),
      db.select().from(departments).orderBy(departments.name),
      db.select().from(courses).orderBy(courses.name),
      db.select().from(units).orderBy(units.code),
    ]);
    res.json({
      schools: schoolList,
      departments: departmentList,
      courses: courseList,
      units: unitList,
    });
  } catch (err) {
    console.error('Error loading academic structure:', err);
    res.status(500).json({ error: 'Failed to load academic structure.' });
  }
});

router.get('/timetables', async (req, res) => {
  try {
    await ensureSeeded();
    const entryType =
      typeof req.query.entryType === 'string' ? req.query.entryType : undefined;
    const courseName =
      typeof req.query.courseName === 'string' ? req.query.courseName : undefined;

    const conditions = [];
    if (entryType && (entryType === 'CLASS' || entryType === 'EXAM')) {
      conditions.push(eq(timetables.entryType, entryType));
    }
    if (courseName && courseName.trim().length > 0) {
      conditions.push(ilike(timetables.courseName, `%${courseName.trim()}%`));
    }

    const rows =
      conditions.length > 0
        ? await db.select().from(timetables).where(and(...conditions))
        : await db.select().from(timetables);

    res.json({ timetables: rows });
  } catch (err) {
    console.error('Error fetching timetables:', err);
    res.status(500).json({ error: 'Failed to load timetables.' });
  }
});

router.get('/resources', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;

    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const school =
      typeof req.query.school === 'string' ? req.query.school.trim() : '';
    const semester =
      typeof req.query.semester === 'string' ? req.query.semester.trim() : '';
    const mine = req.query.mine === 'true';

    const conditions = [isNull(academicResources.deletedAt)];

    const user = req.dbUser;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');

    if (mine && user) {
      conditions.push(eq(academicResources.uploadedById, user.id));
    } else if (!isAdmin) {
      if (user) {
        conditions.push(
          or(
            eq(academicResources.approvalStatus, 'APPROVED'),
            eq(academicResources.uploadedById, user.id)
          )!
        );
      } else {
        conditions.push(eq(academicResources.approvalStatus, 'APPROVED'));
      }
      // Restricted exam material protection for unauthenticated or non-authorized callers
      if (!user || user.accountStatus !== 'ACTIVE') {
        conditions.push(eq(academicResources.isRestricted, false));
      }
    }

    if (category) {
      conditions.push(eq(academicResources.category, category));
    }
    if (school) {
      conditions.push(eq(academicResources.school, school));
    }
    if (semester) {
      conditions.push(eq(academicResources.semester, semester));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(academicResources.title, pattern),
          ilike(academicResources.unitCode, pattern),
          ilike(academicResources.unitName, pattern),
          ilike(academicResources.course, pattern),
          ilike(academicResources.description, pattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [items, totalRows, userBookmarks] = await Promise.all([
      db
        .select({
          id: academicResources.id,
          publicId: academicResources.publicId,
          title: academicResources.title,
          description: academicResources.description,
          category: academicResources.category,
          school: academicResources.school,
          department: academicResources.department,
          course: academicResources.course,
          unitCode: academicResources.unitCode,
          unitName: academicResources.unitName,
          academicYear: academicResources.academicYear,
          semester: academicResources.semester,
          fileName: academicResources.fileName,
          fileMime: academicResources.fileMime,
          fileSizeBytes: academicResources.fileSizeBytes,
          uploadedById: academicResources.uploadedById,
          approvalStatus: academicResources.approvalStatus,
          rejectionReason: academicResources.rejectionReason,
          isRestricted: academicResources.isRestricted,
          downloadCount: academicResources.downloadCount,
          createdAt: academicResources.createdAt,
          uploaderName: users.fullName,
        })
        .from(academicResources)
        .leftJoin(users, eq(academicResources.uploadedById, users.id))
        .where(whereClause)
        .orderBy(desc(academicResources.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(academicResources)
        .where(whereClause),
      user
        ? db
            .select({ resourceId: resourceBookmarks.resourceId })
            .from(resourceBookmarks)
            .where(eq(resourceBookmarks.userId, user.id))
        : Promise.resolve([]),
    ]);

    const bookmarkedSet = new Set(userBookmarks.map((b) => b.resourceId));

    res.json({
      resources: items.map((item) => ({
        ...item,
        isBookmarked: bookmarkedSet.has(item.id),
      })),
      total: totalRows[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('Error listing resources:', err);
    res.status(500).json({ error: 'Failed to load academic resources.' });
  }
});

const resourceMetaSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(1500),
  category: z.enum(['NOTES', 'PAST_PAPER', 'REVISION', 'ASSIGNMENT', 'DOCUMENT']),
  school: z.string().trim().min(2).max(150),
  department: z.string().trim().min(2).max(150),
  course: z.string().trim().min(2).max(150),
  unitCode: z.string().trim().min(2).max(30),
  unitName: z.string().trim().min(2).max(150),
  academicYear: z.string().trim().min(4).max(20),
  semester: z.string().trim().min(2).max(30),
  isRestricted: z.union([z.boolean(), z.string()]).optional(),
});

router.post(
  '/resources',
  requireAuth,
  requireRole('LECTURER', 'ADMIN', 'SUPERADMIN'),
  academicUpload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please attach a learning document (PDF, DOCX, PPTX, or TXT).' });
      }

      const fileCheck = validateAcademicBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      if (!fileCheck.valid) {
        return res.status(400).json({ error: fileCheck.error });
      }

      const parsed = resourceMetaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid resource details',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const saved = persistUploadedBuffer('resources', req.file.buffer, fileCheck.ext);
      const user = req.dbUser!;
      const isAutoApproved = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      const restrictedBool =
        parsed.data.isRestricted === true || parsed.data.isRestricted === 'true';

      const [created] = await db
        .insert(academicResources)
        .values({
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category,
          school: parsed.data.school,
          department: parsed.data.department,
          course: parsed.data.course,
          unitCode: parsed.data.unitCode.toUpperCase(),
          unitName: parsed.data.unitName,
          academicYear: parsed.data.academicYear,
          semester: parsed.data.semester,
          fileUrl: saved.publicUrl,
          fileName: req.file.originalname,
          fileMime: req.file.mimetype,
          fileSizeBytes: req.file.size,
          uploadedById: user.id,
          approvalStatus: isAutoApproved ? 'APPROVED' : 'PENDING',
          isRestricted: restrictedBool,
        })
        .returning();

      await logAudit(
        user,
        'RESOURCE_UPLOADED',
        'ACADEMIC_RESOURCE',
        created.id,
        `${created.unitCode} · ${created.title} (${created.approvalStatus})`
      );

      res.status(201).json({ resource: created });
    } catch (err) {
      console.error('Resource upload error:', err);
      res.status(500).json({ error: 'Failed to upload academic resource.' });
    }
  }
);

router.patch('/resources/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid resource ID.' });
    }

    const existing = await db
      .select()
      .from(academicResources)
      .where(and(eq(academicResources.id, id), isNull(academicResources.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const resource = existing[0];
    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (resource.uploadedById !== user.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the uploader or an administrator can edit this resource.' });
    }

    const updateSchema = z.object({
      title: z.string().trim().min(3).max(160).optional(),
      description: z.string().trim().min(5).max(1500).optional(),
      unitCode: z.string().trim().min(2).max(30).optional(),
      unitName: z.string().trim().min(2).max(150).optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid resource update fields.' });
    }

    const [updated] = await db
      .update(academicResources)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(academicResources.id, id))
      .returning();

    res.json({ resource: updated });
  } catch (err) {
    console.error('Error editing resource:', err);
    res.status(500).json({ error: 'Failed to update resource.' });
  }
});

router.delete('/resources/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db
      .select()
      .from(academicResources)
      .where(eq(academicResources.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (existing[0].uploadedById !== user.id && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to remove this resource.' });
    }

    await db
      .update(academicResources)
      .set({ deletedAt: new Date() })
      .where(eq(academicResources.id, id));

    await logAudit(user, 'RESOURCE_SOFT_DELETED', 'ACADEMIC_RESOURCE', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting resource:', err);
    res.status(500).json({ error: 'Failed to delete resource.' });
  }
});

router.get('/resources/:id/download', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid resource ID.' });
    }

    const rows = await db
      .select()
      .from(academicResources)
      .where(and(eq(academicResources.id, id), isNull(academicResources.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const resource = rows[0];
    const user = req.dbUser;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
    const isOwner = user && resource.uploadedById === user.id;

    if (resource.approvalStatus !== 'APPROVED' && !isAdmin && !isOwner) {
      return res.status(403).json({ error: 'This resource is awaiting administrator approval.' });
    }

    if (resource.isRestricted && (!user || user.accountStatus !== 'ACTIVE')) {
      return res.status(403).json({ error: 'Active university authentication required for restricted material.' });
    }

    const rel = resource.fileUrl.replace(/^\/uploads\//, '');
    const safePath = resolveSafeUploadPath(rel);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Resource file unavailable on storage.' });
    }

    await db
      .update(academicResources)
      .set({ downloadCount: sql`${academicResources.downloadCount} + 1` })
      .where(eq(academicResources.id, id));

    res.download(safePath, resource.fileName);
  } catch (err) {
    console.error('Download failed:', err);
    res.status(500).json({ error: 'Failed to download file.' });
  }
});

router.post('/resources/:id/bookmark', requireAuth, async (req: AuthRequest, res) => {
  try {
    const resourceId = Number(req.params.id);
    const userId = req.dbUser!.id;

    const existing = await db
      .select()
      .from(resourceBookmarks)
      .where(
        and(
          eq(resourceBookmarks.userId, userId),
          eq(resourceBookmarks.resourceId, resourceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(resourceBookmarks)
        .where(eq(resourceBookmarks.id, existing[0].id));
      return res.json({ bookmarked: false });
    }

    await db.insert(resourceBookmarks).values({ userId, resourceId });
    res.json({ bookmarked: true });
  } catch (err) {
    console.error('Bookmark error:', err);
    res.status(500).json({ error: 'Failed to toggle bookmark.' });
  }
});

router.get('/resources/bookmarks/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ resource: academicResources })
      .from(resourceBookmarks)
      .innerJoin(
        academicResources,
        eq(resourceBookmarks.resourceId, academicResources.id)
      )
      .where(
        and(
          eq(resourceBookmarks.userId, req.dbUser!.id),
          isNull(academicResources.deletedAt)
        )
      )
      .orderBy(desc(resourceBookmarks.createdAt));

    res.json({ bookmarks: rows.map((r) => r.resource) });
  } catch (err) {
    console.error('Bookmarks load error:', err);
    res.status(500).json({ error: 'Failed to load bookmarks.' });
  }
});

router.post('/resources/:id/report', requireAuth, async (req: AuthRequest, res) => {
  try {
    const resourceId = Number(req.params.id);
    const schema = z.object({ reason: z.string().trim().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide a clear report reason.' });
    }

    await db.insert(contentReports).values({
      reporterId: req.dbUser!.id,
      entityType: 'ACADEMIC_RESOURCE',
      entityId: resourceId,
      reason: parsed.data.reason,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

router.get('/assignments', requireAuth, async (_req, res) => {
  try {
    await ensureSeeded();
    const list = await db
      .select({
        id: assignments.id,
        publicId: assignments.publicId,
        unitCode: assignments.unitCode,
        unitName: assignments.unitName,
        title: assignments.title,
        instructions: assignments.instructions,
        dueDate: assignments.dueDate,
        maxScore: assignments.maxScore,
        lecturerId: assignments.lecturerId,
        lecturerName: users.fullName,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .leftJoin(users, eq(assignments.lecturerId, users.id))
      .orderBy(desc(assignments.createdAt));

    res.json({ assignments: list });
  } catch (err) {
    console.error('Error loading assignments:', err);
    res.status(500).json({ error: 'Failed to load assignments.' });
  }
});

router.post(
  '/assignments',
  requireAuth,
  requireRole('LECTURER', 'ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        unitCode: z.string().trim().min(2).max(30),
        unitName: z.string().trim().min(2).max(120),
        title: z.string().trim().min(3).max(160),
        instructions: z.string().trim().min(5).max(2000),
        dueDate: z.string().trim().min(4).max(30),
        maxScore: z.coerce.number().int().min(5).max(100).default(30),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid assignment details.' });
      }

      const [created] = await db
        .insert(assignments)
        .values({
          ...parsed.data,
          unitCode: parsed.data.unitCode.toUpperCase(),
          lecturerId: req.dbUser!.id,
        })
        .returning();

      res.status(201).json({ assignment: created });
    } catch (err) {
      console.error('Create assignment failed:', err);
      res.status(500).json({ error: 'Failed to create assignment.' });
    }
  }
);

router.post(
  '/assignments/:id/submit',
  requireAuth,
  academicUpload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const assignmentId = Number(req.params.id);
      const notes =
        typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 1000) : '';

      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (req.file) {
        const check = validateAcademicBuffer(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
        const saved = persistUploadedBuffer('submissions', req.file.buffer, check.ext);
        fileUrl = saved.publicUrl;
        fileName = req.file.originalname;
      } else if (!notes) {
        return res.status(400).json({ error: 'Please attach a file or submission notes.' });
      }

      const [submission] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          studentId: req.dbUser!.id,
          notes,
          fileUrl,
          fileName,
        })
        .returning();

      res.status(201).json({ submission });
    } catch (err) {
      console.error('Submission error:', err);
      res.status(500).json({ error: 'Failed to submit assignment.' });
    }
  }
);

router.get(
  '/assignments/:id/submissions',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const assignmentId = Number(req.params.id);
      const [assignment] = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }

      const user = req.dbUser!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      const isLecturerOwner =
        user.role === 'LECTURER' && assignment.lecturerId === user.id;

      if (isAdmin || isLecturerOwner) {
        const rows = await db
          .select({
            id: assignmentSubmissions.id,
            notes: assignmentSubmissions.notes,
            fileName: assignmentSubmissions.fileName,
            score: assignmentSubmissions.score,
            feedback: assignmentSubmissions.feedback,
            status: assignmentSubmissions.status,
            submittedAt: assignmentSubmissions.submittedAt,
            studentName: users.fullName,
            registrationNumber: users.registrationNumber,
          })
          .from(assignmentSubmissions)
          .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
          .where(eq(assignmentSubmissions.assignmentId, assignmentId))
          .orderBy(desc(assignmentSubmissions.submittedAt));
        return res.json({ submissions: rows });
      }

      const myRows = await db
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, user.id)
          )
        );
      res.json({ submissions: myRows });
    } catch (err) {
      console.error('Submissions fetch error:', err);
      res.status(500).json({ error: 'Failed to load submissions.' });
    }
  }
);

router.patch(
  '/submissions/:id/grade',
  requireAuth,
  requireRole('LECTURER', 'ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        score: z.coerce.number().int().min(0).max(100),
        feedback: z.string().trim().max(1000).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid grade payload.' });
      }

      const [existing] = await db
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      const [assignment] = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, existing.assignmentId))
        .limit(1);
      const user = req.dbUser!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      if (!assignment || (assignment.lecturerId !== user.id && !isAdmin)) {
        return res.status(403).json({ error: 'Only the unit lecturer or an administrator can grade this submission.' });
      }

      const [updated] = await db
        .update(assignmentSubmissions)
        .set({
          score: parsed.data.score,
          feedback: parsed.data.feedback ?? null,
          status: 'GRADED',
        })
        .where(eq(assignmentSubmissions.id, id))
        .returning();

      await notifyUser(
        existing.studentId,
        'ASSIGNMENT',
        'Assignment Graded',
        `${assignment.unitCode}: ${assignment.title} has been graded (${parsed.data.score}/${assignment.maxScore}).`,
        '/academics'
      );

      res.json({ submission: updated });
    } catch (err) {
      console.error('Grade error:', err);
      res.status(500).json({ error: 'Failed to grade submission.' });
    }
  }
);

export default router;

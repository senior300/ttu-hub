import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  organizations,
  organizationMembers,
  events,
  eventRegistrations,
  opportunities,
  savedOpportunities,
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
import { ensureSeeded } from '../seed.ts';

const router = Router();

// ---------------- ORGANIZATIONS ----------------

router.get('/organizations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [];
    const user = req.dbUser;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
    if (!isAdmin) {
      if (user) {
        conditions.push(
          or(
            eq(organizations.approvalStatus, 'APPROVED'),
            eq(organizations.leaderId, user.id)
          )!
        );
      } else {
        conditions.push(eq(organizations.approvalStatus, 'APPROVED'));
      }
    }
    if (category) {
      conditions.push(eq(organizations.category, category));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(ilike(organizations.name, p), ilike(organizations.description, p))!
      );
    }

    const list = await db
      .select({
        id: organizations.id,
        publicId: organizations.publicId,
        name: organizations.name,
        category: organizations.category,
        description: organizations.description,
        mission: organizations.mission,
        logoUrl: organizations.logoUrl,
        leaderId: organizations.leaderId,
        leaderName: users.fullName,
        approvalStatus: organizations.approvalStatus,
        contactEmail: organizations.contactEmail,
        meetingSchedule: organizations.meetingSchedule,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .leftJoin(users, eq(organizations.leaderId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(organizations.name);

    const memberCounts = await db
      .select({
        organizationId: organizationMembers.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.status, 'APPROVED'))
      .groupBy(organizationMembers.organizationId);

    const countMap = new Map(memberCounts.map((m) => [m.organizationId, m.count]));
    const myMemberships = user
      ? await db
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, user.id))
      : [];
    const membershipMap = new Map(
      myMemberships.map((m) => [m.organizationId, m.status])
    );

    res.json({
      organizations: list.map((o) => ({
        ...o,
        memberCount: countMap.get(o.id) ?? 0,
        myMembershipStatus: membershipMap.get(o.id) ?? null,
      })),
    });
  } catch (err) {
    console.error('Error loading organizations:', err);
    res.status(500).json({ error: 'Failed to load organizations.' });
  }
});

router.post('/organizations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    if (user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'Active account required.' });
    }
    const schema = z.object({
      name: z.string().trim().min(3).max(120),
      category: z.enum([
        'ACADEMIC',
        'TECH',
        'CULTURAL',
        'RELIGIOUS',
        'SPORTS',
        'LEADERSHIP',
        'ASSOCIATION',
      ]),
      description: z.string().trim().min(10).max(1500),
      mission: z.string().trim().max(500).optional(),
      contactEmail: z.string().email().optional(),
      meetingSchedule: z.string().trim().max(150).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid organization fields.' });
    }

    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    const [created] = await db
      .insert(organizations)
      .values({
        ...parsed.data,
        leaderId: user.id,
        approvalStatus: isAdmin ? 'APPROVED' : 'PENDING',
      })
      .returning();

    await logAudit(user, 'ORGANIZATION_REGISTERED', 'ORGANIZATION', created.id, created.name);
    res.status(201).json({ organization: created });
  } catch (err: unknown) {
    console.error('Org registration error:', err);
    res.status(400).json({ error: 'Unable to register organization (name may already exist).' });
  }
});

router.post('/organizations/:id/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = Number(req.params.id);
    const userId = req.dbUser!.id;

    const existing = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ membership: existing[0] });
    }

    const [created] = await db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId,
        status: 'PENDING',
      })
      .returning();

    res.status(201).json({ membership: created });
  } catch (err) {
    console.error('Join org error:', err);
    res.status(500).json({ error: 'Failed to submit membership request.' });
  }
});

router.get('/organizations/:id/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const organizationId = Number(req.params.id);
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (org.leaderId !== user.id && !isAdmin) {
      return res.status(403).json({
        error: 'Private organization member records are restricted to this organization’s leadership.',
      });
    }

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        roleTitle: organizationMembers.roleTitle,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        fullName: users.fullName,
        department: users.department,
        course: users.course,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(desc(organizationMembers.joinedAt));

    res.json({ members });
  } catch (err) {
    console.error('Members fetch error:', err);
    res.status(500).json({ error: 'Failed to load organization members.' });
  }
});

router.patch(
  '/organizations/:id/members/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const organizationId = Number(req.params.id);
      const memberId = Number(req.params.memberId);

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found.' });
      }

      const user = req.dbUser!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      if (org.leaderId !== user.id && !isAdmin) {
        return res.status(403).json({ error: 'Restricted to this organization’s leadership.' });
      }

      const schema = z.object({
        status: z.enum(['APPROVED', 'REJECTED']).optional(),
        roleTitle: z.string().trim().min(2).max(60).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid membership update.' });
      }

      const [updated] = await db
        .update(organizationMembers)
        .set(parsed.data)
        .where(
          and(
            eq(organizationMembers.id, memberId),
            eq(organizationMembers.organizationId, organizationId)
          )
        )
        .returning();

      if (updated && parsed.data.status) {
        await notifyUser(
          updated.userId,
          'APPROVAL',
          `${org.name} Membership`,
          `Your membership request was ${parsed.data.status.toLowerCase()}.`,
          '/organizations'
        );
      }

      res.json({ member: updated });
    } catch (err) {
      console.error('Member update error:', err);
      res.status(500).json({ error: 'Failed to update member.' });
    }
  }
);

// ---------------- EVENTS ----------------

router.get('/events', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const conditions = [eq(events.approvalStatus, 'APPROVED')];
    if (category) {
      conditions.push(eq(events.category, category));
    }

    const list = await db
      .select({
        id: events.id,
        publicId: events.publicId,
        title: events.title,
        description: events.description,
        category: events.category,
        location: events.location,
        startAt: events.startAt,
        endAt: events.endAt,
        capacity: events.capacity,
        posterUrl: events.posterUrl,
        organizerId: events.organizerId,
        organizationId: events.organizationId,
        organizerName: users.fullName,
      })
      .from(events)
      .leftJoin(users, eq(events.organizerId, users.id))
      .where(and(...conditions))
      .orderBy(events.startAt);

    const counts = await db
      .select({
        eventId: eventRegistrations.eventId,
        count: sql<number>`count(*)::int`,
      })
      .from(eventRegistrations)
      .where(sql`${eventRegistrations.attendanceStatus} != 'CANCELLED'`)
      .groupBy(eventRegistrations.eventId);

    const countMap = new Map(counts.map((c) => [c.eventId, c.count]));

    const myRegs = req.dbUser
      ? await db
          .select()
          .from(eventRegistrations)
          .where(eq(eventRegistrations.userId, req.dbUser.id))
      : [];
    const myRegSet = new Set(
      myRegs
        .filter((r) => r.attendanceStatus !== 'CANCELLED')
        .map((r) => r.eventId)
    );

    res.json({
      events: list.map((e) => ({
        ...e,
        registeredCount: countMap.get(e.id) ?? 0,
        isRegistered: myRegSet.has(e.id),
      })),
    });
  } catch (err) {
    console.error('Error loading events:', err);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

router.post(
  '/events',
  requireAuth,
  requireRole('ORGANIZATION_LEADER', 'LECTURER', 'ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().trim().min(3).max(160),
        description: z.string().trim().min(10).max(2000),
        category: z.string().trim().min(2).max(60),
        location: z.string().trim().min(2).max(150),
        startAt: z.string(),
        endAt: z.string(),
        capacity: z.coerce.number().int().min(5).max(5000).default(100),
        organizationId: z.coerce.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid event payload.' });
      }

      const start = new Date(parsed.data.startAt);
      const end = new Date(parsed.data.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return res.status(400).json({ error: 'Event end time must be after start time.' });
      }

      const user = req.dbUser!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      if (parsed.data.organizationId && !isAdmin) {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, parsed.data.organizationId))
          .limit(1);
        if (!org || org.leaderId !== user.id) {
          return res.status(403).json({
            error: 'You can only create events for organizations you lead.',
          });
        }
      }

      const [created] = await db
        .insert(events)
        .values({
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category,
          location: parsed.data.location,
          startAt: start,
          endAt: end,
          capacity: parsed.data.capacity,
          organizerId: user.id,
          organizationId: parsed.data.organizationId ?? null,
          approvalStatus: 'APPROVED',
        })
        .returning();

      await logAudit(user, 'EVENT_CREATED', 'EVENT', created.id, created.title);
      res.status(201).json({ event: created });
    } catch (err) {
      console.error('Event create error:', err);
      res.status(500).json({ error: 'Failed to create event.' });
    }
  }
);

router.post('/events/:id/register', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.id);
    const userId = req.dbUser!.id;

    const [ev] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!ev) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          sql`${eventRegistrations.attendanceStatus} != 'CANCELLED'`
        )
      );
    if ((countRows[0]?.count ?? 0) >= ev.capacity) {
      return res.status(400).json({ error: 'Event has reached full capacity.' });
    }

    const [reg] = await db
      .insert(eventRegistrations)
      .values({
        eventId,
        userId,
        attendanceStatus: 'REGISTERED',
        reminderEnabled: true,
      })
      .onConflictDoUpdate({
        target: [eventRegistrations.eventId, eventRegistrations.userId],
        set: { attendanceStatus: 'REGISTERED', reminderEnabled: true },
      })
      .returning();

    await notifyUser(
      userId,
      'EVENT',
      'Event Registration Confirmed',
      `You are registered for "${ev.title}" at ${ev.location}.`,
      '/events'
    );

    res.json({ registration: reg });
  } catch (err) {
    console.error('Event register error:', err);
    res.status(500).json({ error: 'Failed to register for event.' });
  }
});

router.delete('/events/:id/register', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.id);
    await db
      .update(eventRegistrations)
      .set({ attendanceStatus: 'CANCELLED' })
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, req.dbUser!.id)
        )
      );
    res.json({ success: true });
  } catch (err) {
    console.error('Cancel event reg error:', err);
    res.status(500).json({ error: 'Failed to cancel registration.' });
  }
});

router.get('/events/:id/registrations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.id);
    const [ev] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!ev) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (ev.organizerId !== user.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the organizer or administrator can view attendance.' });
    }

    const list = await db
      .select({
        id: eventRegistrations.id,
        userId: eventRegistrations.userId,
        attendanceStatus: eventRegistrations.attendanceStatus,
        registeredAt: eventRegistrations.registeredAt,
        fullName: users.fullName,
        registrationNumber: users.registrationNumber,
      })
      .from(eventRegistrations)
      .innerJoin(users, eq(eventRegistrations.userId, users.id))
      .where(eq(eventRegistrations.eventId, eventId));

    res.json({ registrations: list });
  } catch (err) {
    console.error('Load event registrations error:', err);
    res.status(500).json({ error: 'Failed to load registrations.' });
  }
});

// ---------------- OPPORTUNITIES ----------------

router.get('/opportunities', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const user = req.dbUser;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
    const conditions = [];

    if (!isAdmin) {
      conditions.push(eq(opportunities.approvalStatus, 'APPROVED'));
    }
    if (category) {
      conditions.push(eq(opportunities.category, category));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(
          ilike(opportunities.title, p),
          ilike(opportunities.organizationName, p),
          ilike(opportunities.description, p)
        )!
      );
    }

    const list = await db
      .select()
      .from(opportunities)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(opportunities.createdAt));

    const saved = user
      ? await db
          .select()
          .from(savedOpportunities)
          .where(eq(savedOpportunities.userId, user.id))
      : [];
    const savedSet = new Set(saved.map((s) => s.opportunityId));

    res.json({
      opportunities: list.map((o) => ({
        ...o,
        isSaved: savedSet.has(o.id),
      })),
    });
  } catch (err) {
    console.error('Opportunities load error:', err);
    res.status(500).json({ error: 'Failed to load opportunities.' });
  }
});

router.post(
  '/opportunities',
  requireAuth,
  requireRole('ORGANIZATION_LEADER', 'LECTURER', 'ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().trim().min(3).max(160),
        organizationName: z.string().trim().min(2).max(120),
        category: z.enum([
          'Internship',
          'Industrial Attachment',
          'Scholarship',
          'Competition',
          'Hackathon',
          'Graduate Programme',
          'Job',
          'Fellowship',
          'Training Programme',
        ]),
        description: z.string().trim().min(10).max(2000),
        eligibility: z.string().trim().min(3).max(500),
        location: z.string().trim().min(2).max(120),
        deadline: z.string().trim().min(4).max(30),
        externalUrl: z.string().url().optional().or(z.literal('')),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid opportunity details.' });
      }

      const user = req.dbUser!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

      const [created] = await db
        .insert(opportunities)
        .values({
          ...parsed.data,
          externalUrl: parsed.data.externalUrl || null,
          postedById: user.id,
          approvalStatus: isAdmin ? 'APPROVED' : 'PENDING',
        })
        .returning();

      res.status(201).json({ opportunity: created });
    } catch (err) {
      console.error('Opportunity create error:', err);
      res.status(500).json({ error: 'Failed to create opportunity.' });
    }
  }
);

router.post('/opportunities/:id/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const opportunityId = Number(req.params.id);
    const userId = req.dbUser!.id;
    const reminderDate =
      typeof req.body?.reminderDate === 'string' ? req.body.reminderDate : null;

    const existing = await db
      .select()
      .from(savedOpportunities)
      .where(
        and(
          eq(savedOpportunities.userId, userId),
          eq(savedOpportunities.opportunityId, opportunityId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(savedOpportunities)
        .where(eq(savedOpportunities.id, existing[0].id));
      return res.json({ saved: false });
    }

    await db.insert(savedOpportunities).values({
      userId,
      opportunityId,
      reminderDate,
    });
    res.json({ saved: true });
  } catch (err) {
    console.error('Save opportunity error:', err);
    res.status(500).json({ error: 'Failed to save opportunity.' });
  }
});

export default router;

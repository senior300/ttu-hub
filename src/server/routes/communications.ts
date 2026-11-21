import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  notifications,
  conversations,
  messages,
  users,
  organizations,
} from '../../db/schema.ts';
import {
  optionalAuth,
  requireAuth,
  type AuthRequest,
  logAudit,
  notifyUser,
} from '../middleware/auth.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

router.get('/announcements', optionalAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const scope = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [
      eq(announcements.approvalStatus, 'APPROVED'),
      isNull(announcements.deletedAt),
    ];

    if (scope) {
      conditions.push(eq(announcements.scope, scope));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(announcements.title, pattern),
          ilike(announcements.body, pattern),
          ilike(announcements.targetName, pattern)
        )!
      );
    }

    const rows = await db
      .select({
        id: announcements.id,
        publicId: announcements.publicId,
        title: announcements.title,
        body: announcements.body,
        scope: announcements.scope,
        targetName: announcements.targetName,
        priority: announcements.priority,
        authorId: announcements.authorId,
        authorName: users.fullName,
        organizationId: announcements.organizationId,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.authorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(announcements.createdAt))
      .limit(50);

    res.json({ announcements: rows });
  } catch (err) {
    console.error('Error loading announcements:', err);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

router.post('/announcements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    if (user.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'Active account required to post announcements.' });
    }

    const schema = z.object({
      title: z.string().trim().min(3).max(180),
      body: z.string().trim().min(10).max(4000),
      scope: z.enum([
        'UNIVERSITY',
        'SCHOOL',
        'DEPARTMENT',
        'STUDENT',
        'ORGANIZATION',
      ]),
      targetName: z.string().trim().max(150).optional(),
      priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
      organizationId: z.coerce.number().int().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid announcement fields.' });
    }

    const { scope, organizationId } = parsed.data;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

    // Only authorized administrators may publish university-wide official notices
    if (scope === 'UNIVERSITY' && !isAdmin) {
      return res.status(403).json({
        error: 'Only administrators may publish university-wide notices.',
      });
    }

    if ((scope === 'SCHOOL' || scope === 'DEPARTMENT') && user.role !== 'LECTURER' && !isAdmin) {
      return res.status(403).json({
        error: 'Only lecturers or administrators may publish school or department announcements.',
      });
    }

    if (scope === 'ORGANIZATION') {
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required.' });
      }
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      if (!org || (org.leaderId !== user.id && !isAdmin)) {
        return res.status(403).json({
          error: 'Only the organization leader or administrator can publish notices for this organization.',
        });
      }
    }

    const [created] = await db
      .insert(announcements)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        scope,
        targetName: parsed.data.targetName || (scope === 'UNIVERSITY' ? 'All Campus' : null),
        priority: parsed.data.priority,
        authorId: user.id,
        organizationId: organizationId ?? null,
        approvalStatus: 'APPROVED',
      })
      .returning();

    await logAudit(
      user,
      'ANNOUNCEMENT_PUBLISHED',
      'ANNOUNCEMENT',
      created.id,
      `${created.scope}: ${created.title}`
    );

    res.status(201).json({ announcement: created });
  } catch (err) {
    console.error('Error publishing announcement:', err);
    res.status(500).json({ error: 'Failed to publish announcement.' });
  }
});

router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.dbUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(40);

    const unreadCount = list.filter((n) => !n.isRead).length;
    res.json({ notifications: list, unreadCount });
  } catch (err) {
    console.error('Error loading notifications:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, req.dbUser!.id))
      );
    res.json({ success: true });
  } catch (err) {
    console.error('Notification read error:', err);
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.dbUser!.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.get('/messages/users', requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        department: users.department,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          eq(users.accountStatus, 'ACTIVE'),
          isNull(users.deletedAt),
          q ? ilike(users.fullName, `%${q}%`) : undefined
        )
      )
      .limit(25);

    res.json({
      users: rows.filter(
        (u) => u.id !== req.dbUser!.id && u.fullName !== 'TTU HUB Editorial Catalog'
      ),
    });
  } catch (err) {
    console.error('Error listing message contacts:', err);
    res.status(500).json({ error: 'Failed to search campus members.' });
  }
});

router.get('/messages/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.dbUser!.id;
    const convs = await db
      .select()
      .from(conversations)
      .where(
        or(
          eq(conversations.participantOneId, uid),
          eq(conversations.participantTwoId, uid)
        )
      )
      .orderBy(desc(conversations.lastMessageAt));

    const enriched = await Promise.all(
      convs.map(async (c) => {
        const peerId =
          c.participantOneId === uid ? c.participantTwoId : c.participantOneId;
        const [peer] = await db
          .select({
            id: users.id,
            fullName: users.fullName,
            role: users.role,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, peerId))
          .limit(1);

        const [lastMsg] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, c.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const unreadRows = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, c.id),
              eq(messages.isRead, false),
              eq(messages.senderId, peerId)
            )
          );

        return {
          ...c,
          peer: peer ?? { id: peerId, fullName: 'Campus Member', role: 'STUDENT', avatarUrl: null },
          lastMessage: lastMsg ?? null,
          unreadCount: unreadRows.length,
        };
      })
    );

    res.json({ conversations: enriched });
  } catch (err) {
    console.error('Conversations fetch error:', err);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

router.post('/messages/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      recipientId: z.coerce.number().int().positive(),
      contextLabel: z.string().trim().max(120).optional(),
      initialMessage: z.string().trim().min(1).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Recipient and message body are required.' });
    }

    const senderId = req.dbUser!.id;
    const recipientId = parsed.data.recipientId;
    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });
    }

    const existing = await db
      .select()
      .from(conversations)
      .where(
        or(
          and(
            eq(conversations.participantOneId, senderId),
            eq(conversations.participantTwoId, recipientId)
          ),
          and(
            eq(conversations.participantOneId, recipientId),
            eq(conversations.participantTwoId, senderId)
          )
        )
      )
      .limit(1);

    let conv = existing[0];
    if (!conv) {
      const [created] = await db
        .insert(conversations)
        .values({
          participantOneId: senderId,
          participantTwoId: recipientId,
          contextLabel: parsed.data.contextLabel ?? null,
        })
        .returning();
      conv = created;
    }

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        senderId,
        body: parsed.data.initialMessage,
      })
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conv.id));

    await notifyUser(
      recipientId,
      'MARKETPLACE',
      'New Direct Message',
      `${req.dbUser!.fullName} sent you a message.`,
      '/communications'
    );

    res.status(201).json({ conversation: conv, message: msg });
  } catch (err) {
    console.error('Start conversation error:', err);
    res.status(500).json({ error: 'Failed to start conversation.' });
  }
});

router.get('/messages/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const uid = req.dbUser!.id;

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conv || (conv.participantOneId !== uid && conv.participantTwoId !== uid)) {
      return res.status(403).json({ error: 'Conversation access denied.' });
    }

    // Mark peer messages as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, id),
          eq(messages.isRead, false),
          eq(
            messages.senderId,
            conv.participantOneId === uid ? conv.participantTwoId : conv.participantOneId
          )
        )
      );

    const thread = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.json({ conversation: conv, messages: thread });
  } catch (err) {
    console.error('Load messages error:', err);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/messages/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const uid = req.dbUser!.id;
    const schema = z.object({ body: z.string().trim().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Message body cannot be empty.' });
    }

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conv || (conv.participantOneId !== uid && conv.participantTwoId !== uid)) {
      return res.status(403).json({ error: 'Conversation access denied.' });
    }

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: id,
        senderId: uid,
        body: parsed.data.body,
      })
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, id));

    const peerId =
      conv.participantOneId === uid ? conv.participantTwoId : conv.participantOneId;
    await notifyUser(
      peerId,
      'MARKETPLACE',
      'New Message',
      `${req.dbUser!.fullName}: ${parsed.data.body.slice(0, 80)}`,
      '/communications'
    );

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

export default router;

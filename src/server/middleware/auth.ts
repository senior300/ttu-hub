import type { Request, Response, NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { db } from '../../db/index.ts';
import { users, auditLogs, notifications } from '../../db/schema.ts';

export type UserRole =
  | 'STUDENT'
  | 'LECTURER'
  | 'ADMIN'
  | 'SUPERADMIN'
  | 'ORGANIZATION_LEADER';

export interface DbUser {
  id: number;
  publicId: string;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  requestedRole: string | null;
  accountStatus: string;
  profileCompleted: boolean;
  registrationNumber: string | null;
  staffId: string | null;
  school: string | null;
  department: string | null;
  course: string | null;
  yearOfStudy: number | null;
  currentSemester: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  firebaseUid?: string;
  firebaseEmail?: string;
  dbUser?: DbUser;
}

async function getOrCreateDbUser(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<DbUser> {
  const initialAdminEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const isEnvSuperAdmin = Boolean(initialAdminEmail && initialAdminEmail === normalizedEmail);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.uid, uid))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    if (isEnvSuperAdmin && current.role !== 'SUPERADMIN') {
      const updated = await db
        .update(users)
        .set({
          role: 'SUPERADMIN',
          accountStatus: 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated[0];
    }
    return current;
  }

  const safeName =
    displayName && displayName.trim().length > 0
      ? displayName.trim()
      : normalizedEmail.split('@')[0];

  const inserted = await db
    .insert(users)
    .values({
      uid,
      email: normalizedEmail,
      fullName: safeName,
      role: isEnvSuperAdmin ? 'SUPERADMIN' : 'STUDENT',
      accountStatus: 'ACTIVE',
      profileCompleted: isEnvSuperAdmin,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: normalizedEmail,
        updatedAt: new Date(),
      },
    })
    .returning();

  return inserted[0];
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@users.ttu-hub.local`;
    const dbUser = await getOrCreateDbUser(
      decoded.uid,
      email,
      typeof decoded.name === 'string' ? decoded.name : null
    );

    if (dbUser.accountStatus === 'SUSPENDED' && req.path !== '/profile') {
      return res.status(403).json({
        error: 'Your account is currently suspended. Contact an administrator.',
      });
    }

    req.firebaseUid = decoded.uid;
    req.firebaseEmail = email;
    req.dbUser = dbUser;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@users.ttu-hub.local`;
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = email;
    req.dbUser = await getOrCreateDbUser(
      decoded.uid,
      email,
      typeof decoded.name === 'string' ? decoded.name : null
    );
  } catch {
    // Ignore invalid optional tokens on public read routes
  }
  next();
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.dbUser.accountStatus !== 'ACTIVE') {
      return res.status(403).json({
        error:
          req.dbUser.accountStatus === 'PENDING_APPROVAL'
            ? 'Your account role is pending administrator verification.'
            : 'Account is not active.',
      });
    }
    if (!allowedRoles.includes(req.dbUser.role as UserRole)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
      });
    }
    next();
  };
};

export async function canClaimInitialSuperAdmin(): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.role} = 'SUPERADMIN' AND ${users.uid} NOT LIKE 'system-%'`);
  return (rows[0]?.count ?? 0) === 0;
}

export async function logAudit(
  actor: { id?: number | null; email?: string | null } | null,
  action: string,
  targetType: string,
  targetId: string | number | null,
  details?: string
) {
  try {
    await db.insert(auditLogs).values({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      targetType,
      targetId: targetId !== null && targetId !== undefined ? String(targetId) : null,
      details: details ?? null,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

export async function notifyUser(
  userId: number,
  type:
    | 'ANNOUNCEMENT'
    | 'RESOURCE'
    | 'EVENT'
    | 'ASSIGNMENT'
    | 'APPROVAL'
    | 'MARKETPLACE'
    | 'SYSTEM',
  title: string,
  body: string,
  linkPath?: string
) {
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      linkPath: linkPath ?? null,
    });
  } catch (err) {
    console.error('Notification insert error:', err);
  }
}

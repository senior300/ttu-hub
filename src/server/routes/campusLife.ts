import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  marketplaceListings,
  accommodations,
  accommodationRequests,
  lostFoundItems,
  lostFoundClaims,
  campusLocations,
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
  imageUpload,
  validateImageBuffer,
  persistUploadedBuffer,
} from '../utils/uploads.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

// ---------------- CAMPUS MARKETPLACE ----------------

router.get('/marketplace', optionalAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const maxPrice = Number(req.query.maxPrice);
    const minPrice = Number(req.query.minPrice);

    const conditions = [
      eq(marketplaceListings.moderationStatus, 'APPROVED'),
      isNull(marketplaceListings.deletedAt),
    ];

    if (category) {
      conditions.push(eq(marketplaceListings.category, category));
    }
    if (!Number.isNaN(minPrice) && minPrice > 0) {
      conditions.push(gte(marketplaceListings.priceKes, minPrice));
    }
    if (!Number.isNaN(maxPrice) && maxPrice > 0) {
      conditions.push(lte(marketplaceListings.priceKes, maxPrice));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(
          ilike(marketplaceListings.title, p),
          ilike(marketplaceListings.description, p)
        )!
      );
    }

    const items = await db
      .select({
        id: marketplaceListings.id,
        publicId: marketplaceListings.publicId,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        category: marketplaceListings.category,
        priceKes: marketplaceListings.priceKes,
        condition: marketplaceListings.condition,
        imageUrl: marketplaceListings.imageUrl,
        sellerId: marketplaceListings.sellerId,
        sellerName: users.fullName,
        sellerDepartment: users.department,
        availabilityStatus: marketplaceListings.availabilityStatus,
        createdAt: marketplaceListings.createdAt,
      })
      .from(marketplaceListings)
      .leftJoin(users, eq(marketplaceListings.sellerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(marketplaceListings.createdAt));

    res.json({ listings: items });
  } catch (err) {
    console.error('Marketplace fetch error:', err);
    res.status(500).json({ error: 'Failed to load marketplace listings.' });
  }
});

router.post(
  '/marketplace',
  requireAuth,
  imageUpload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      if (user.accountStatus !== 'ACTIVE') {
        return res.status(403).json({ error: 'Active account required to post listings.' });
      }

      const schema = z.object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(1500),
        category: z.enum([
          'Electronics',
          'Clothing',
          'Books',
          'Food',
          'Accommodation',
          'Beauty',
          'Services',
          'Other',
        ]),
        priceKes: z.coerce.number().int().min(0).max(5000000),
        condition: z.string().trim().min(2).max(50).default('Used - Good'),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid listing details.' });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        const check = validateImageBuffer(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
        imageUrl = persistUploadedBuffer('images', req.file.buffer, check.ext).publicUrl;
      }

      const [created] = await db
        .insert(marketplaceListings)
        .values({
          ...parsed.data,
          imageUrl,
          sellerId: user.id,
          availabilityStatus: 'AVAILABLE',
          moderationStatus: 'APPROVED',
        })
        .returning();

      res.status(201).json({ listing: created });
    } catch (err) {
      console.error('Create listing error:', err);
      res.status(500).json({ error: 'Failed to create marketplace listing.' });
    }
  }
);

router.patch('/marketplace/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (existing.sellerId !== user.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the seller or administrator can update this listing.' });
    }

    const schema = z.object({
      availabilityStatus: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).optional(),
      priceKes: z.coerce.number().int().min(0).max(5000000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid listing update.' });
    }

    const [updated] = await db
      .update(marketplaceListings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();

    res.json({ listing: updated });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

router.post('/marketplace/:id/report', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ reason: z.string().trim().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Report reason is required.' });
    }

    await db.insert(contentReports).values({
      reporterId: req.dbUser!.id,
      entityType: 'MARKETPLACE',
      entityId: id,
      reason: parsed.data.reason,
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Report listing error:', err);
    res.status(500).json({ error: 'Failed to report listing.' });
  }
});

// ---------------- ACCOMMODATION ----------------

router.get('/accommodation', optionalAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const providerType =
      typeof req.query.providerType === 'string' ? req.query.providerType.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [eq(accommodations.moderationStatus, 'APPROVED')];
    if (providerType) {
      conditions.push(eq(accommodations.providerType, providerType));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(
          ilike(accommodations.name, p),
          ilike(accommodations.location, p),
          ilike(accommodations.amenities, p)
        )!
      );
    }

    const rows = await db
      .select()
      .from(accommodations)
      .where(and(...conditions))
      .orderBy(desc(accommodations.createdAt));

    res.json({ accommodations: rows });
  } catch (err) {
    console.error('Accommodation fetch error:', err);
    res.status(500).json({ error: 'Failed to load accommodations.' });
  }
});

router.post(
  '/accommodation',
  requireAuth,
  imageUpload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      const user = req.dbUser!;
      const schema = z.object({
        name: z.string().trim().min(3).max(150),
        providerType: z.enum(['UNIVERSITY_HOSTEL', 'PRIVATE_ACCOMMODATION']),
        description: z.string().trim().min(10).max(1500),
        location: z.string().trim().min(3).max(150),
        pricePerSemesterKes: z.coerce.number().int().min(500).max(500000),
        roomsAvailable: z.coerce.number().int().min(0).max(500),
        amenities: z.string().trim().min(3).max(500),
        contactInfo: z.string().trim().min(3).max(200),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid accommodation fields.' });
      }

      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      if (parsed.data.providerType === 'UNIVERSITY_HOSTEL' && !isAdmin) {
        return res.status(403).json({
          error: 'Only administrators may publish official university hostel listings.',
        });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        const check = validateImageBuffer(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
        imageUrl = persistUploadedBuffer('images', req.file.buffer, check.ext).publicUrl;
      }

      const [created] = await db
        .insert(accommodations)
        .values({
          ...parsed.data,
          imageUrl,
          ownerId: user.id,
          availabilityVerified: isAdmin,
          moderationStatus: 'APPROVED',
        })
        .returning();

      res.status(201).json({ accommodation: created });
    } catch (err) {
      console.error('Accommodation create error:', err);
      res.status(500).json({ error: 'Failed to create accommodation listing.' });
    }
  }
);

router.post('/accommodation/:id/request', requireAuth, async (req: AuthRequest, res) => {
  try {
    const accommodationId = Number(req.params.id);
    const schema = z.object({
      preferredMoveIn: z.string().trim().min(3).max(60),
      message: z.string().trim().min(5).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Move-in date and message are required.' });
    }

    const [acc] = await db
      .select()
      .from(accommodations)
      .where(eq(accommodations.id, accommodationId))
      .limit(1);
    if (!acc) {
      return res.status(404).json({ error: 'Accommodation not found.' });
    }

    const [created] = await db
      .insert(accommodationRequests)
      .values({
        accommodationId,
        studentId: req.dbUser!.id,
        preferredMoveIn: parsed.data.preferredMoveIn,
        message: parsed.data.message,
      })
      .returning();

    await notifyUser(
      acc.ownerId,
      'SYSTEM',
      'Accommodation Inquiry',
      `${req.dbUser!.fullName} submitted an inquiry for ${acc.name}.`,
      '/accommodation'
    );

    res.status(201).json({ request: created });
  } catch (err) {
    console.error('Accommodation request error:', err);
    res.status(500).json({ error: 'Failed to submit accommodation request.' });
  }
});

// ---------------- LOST & FOUND ----------------

router.get('/lost-found', optionalAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const reportType =
      typeof req.query.reportType === 'string' ? req.query.reportType.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [eq(lostFoundItems.moderationStatus, 'APPROVED')];
    if (reportType === 'LOST' || reportType === 'FOUND') {
      conditions.push(eq(lostFoundItems.reportType, reportType));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(
          ilike(lostFoundItems.title, p),
          ilike(lostFoundItems.description, p),
          ilike(lostFoundItems.location, p)
        )!
      );
    }

    // Notice: Never expose reporter email or phone number publicly!
    const rows = await db
      .select({
        id: lostFoundItems.id,
        publicId: lostFoundItems.publicId,
        reportType: lostFoundItems.reportType,
        title: lostFoundItems.title,
        description: lostFoundItems.description,
        location: lostFoundItems.location,
        dateReported: lostFoundItems.dateReported,
        imageUrl: lostFoundItems.imageUrl,
        reporterId: lostFoundItems.reporterId,
        reporterName: users.fullName,
        status: lostFoundItems.status,
        createdAt: lostFoundItems.createdAt,
      })
      .from(lostFoundItems)
      .leftJoin(users, eq(lostFoundItems.reporterId, users.id))
      .where(and(...conditions))
      .orderBy(desc(lostFoundItems.createdAt));

    res.json({ items: rows });
  } catch (err) {
    console.error('Lost and found fetch error:', err);
    res.status(500).json({ error: 'Failed to load lost and found items.' });
  }
});

router.post(
  '/lost-found',
  requireAuth,
  imageUpload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        reportType: z.enum(['LOST', 'FOUND']),
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(5).max(1500),
        location: z.string().trim().min(2).max(140),
        dateReported: z.string().trim().min(4).max(30),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid item report fields.' });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        const check = validateImageBuffer(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
        imageUrl = persistUploadedBuffer('images', req.file.buffer, check.ext).publicUrl;
      }

      const [created] = await db
        .insert(lostFoundItems)
        .values({
          ...parsed.data,
          imageUrl,
          reporterId: req.dbUser!.id,
          status: 'OPEN',
          moderationStatus: 'APPROVED',
        })
        .returning();

      res.status(201).json({ item: created });
    } catch (err) {
      console.error('Lost found create error:', err);
      res.status(500).json({ error: 'Failed to submit item report.' });
    }
  }
);

router.post('/lost-found/:id/claim', requireAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const schema = z.object({
      verificationDetails: z.string().trim().min(5).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please describe identifying details to verify ownership.' });
    }

    const [item] = await db
      .select()
      .from(lostFoundItems)
      .where(eq(lostFoundItems.id, itemId))
      .limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const [claim] = await db
      .insert(lostFoundClaims)
      .values({
        itemId,
        claimantId: req.dbUser!.id,
        verificationDetails: parsed.data.verificationDetails,
      })
      .returning();

    await notifyUser(
      item.reporterId,
      'SYSTEM',
      'Lost & Found Claim Request',
      `${req.dbUser!.fullName} submitted a verification claim for "${item.title}".`,
      '/lost-found'
    );

    res.status(201).json({ claim });
  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Failed to submit claim request.' });
  }
});

router.patch('/lost-found/:id/recover', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [item] = await db
      .select()
      .from(lostFoundItems)
      .where(eq(lostFoundItems.id, id))
      .limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const user = req.dbUser!;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    if (item.reporterId !== user.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the reporter or administrator can mark this item recovered.' });
    }

    const [updated] = await db
      .update(lostFoundItems)
      .set({ status: 'RECOVERED' })
      .where(eq(lostFoundItems.id, id))
      .returning();

    res.json({ item: updated });
  } catch (err) {
    console.error('Recover item error:', err);
    res.status(500).json({ error: 'Failed to update item status.' });
  }
});

// ---------------- CAMPUS DIRECTORY & CONFIGURABLE MAP ----------------

router.get('/directory', async (req, res) => {
  try {
    await ensureSeeded();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [];
    if (category) {
      conditions.push(eq(campusLocations.category, category));
    }
    if (search) {
      const p = `%${search}%`;
      conditions.push(
        or(
          ilike(campusLocations.name, p),
          ilike(campusLocations.description, p),
          ilike(campusLocations.buildingCode, p)
        )!
      );
    }

    const locations = await db
      .select()
      .from(campusLocations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(campusLocations.name);

    res.json({ locations });
  } catch (err) {
    console.error('Directory fetch error:', err);
    res.status(500).json({ error: 'Failed to load campus directory.' });
  }
});

const locationSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: z.enum([
    'School',
    'Department',
    'Office',
    'Student Service',
    'Accommodation',
    'Library',
    'Laboratory',
    'Lecture Hall',
    'Facility',
  ]),
  description: z.string().trim().min(5).max(1000),
  buildingCode: z.string().trim().max(30).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  coordinatesVerified: z.boolean().optional(),
  openingHours: z.string().trim().max(120).optional().nullable(),
  contactEmail: z.string().trim().max(120).optional().nullable(),
});

router.post(
  '/directory',
  requireAuth,
  requireRole('ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = locationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid campus location payload.' });
      }

      const [created] = await db
        .insert(campusLocations)
        .values({
          ...parsed.data,
          coordinatesVerified: parsed.data.coordinatesVerified ?? false,
          updatedById: req.dbUser!.id,
        })
        .returning();

      await logAudit(req.dbUser!, 'LOCATION_CREATED', 'CAMPUS_LOCATION', created.id, created.name);
      res.status(201).json({ location: created });
    } catch (err) {
      console.error('Location create error:', err);
      res.status(500).json({ error: 'Failed to create campus location.' });
    }
  }
);

router.patch(
  '/directory/:id',
  requireAuth,
  requireRole('ADMIN', 'SUPERADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = locationSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid location update fields.' });
      }

      const [updated] = await db
        .update(campusLocations)
        .set({
          ...parsed.data,
          updatedById: req.dbUser!.id,
          updatedAt: new Date(),
        })
        .where(eq(campusLocations.id, id))
        .returning();

      await logAudit(req.dbUser!, 'LOCATION_UPDATED', 'CAMPUS_LOCATION', id, updated?.name);
      res.json({ location: updated });
    } catch (err) {
      console.error('Location update error:', err);
      res.status(500).json({ error: 'Failed to update campus location.' });
    }
  }
);

export default router;

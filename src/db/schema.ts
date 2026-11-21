import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').defaultRandom().notNull().unique(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('STUDENT'),
    requestedRole: text('requested_role'),
    accountStatus: text('account_status').notNull().default('ACTIVE'),
    profileCompleted: boolean('profile_completed').notNull().default(false),
    registrationNumber: text('registration_number'),
    staffId: text('staff_id'),
    school: text('school'),
    department: text('department'),
    course: text('course'),
    yearOfStudy: integer('year_of_study'),
    currentSemester: text('current_semester'),
    phoneNumber: text('phone_number'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    index('users_status_idx').on(t.accountStatus),
  ]
);

export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  deanName: text('dean_name'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  headName: text('head_name'),
  officeLocation: text('office_location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  level: text('level').notNull().default('BACHELORS'),
  durationYears: integer('duration_years').notNull().default(4),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  lecturerId: integer('lecturer_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  yearOfStudy: integer('year_of_study').notNull().default(1),
  semester: text('semester').notNull().default('Semester 1'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const timetables = pgTable('timetables', {
  id: serial('id').primaryKey(),
  courseName: text('course_name').notNull(),
  unitCode: text('unit_code').notNull(),
  unitName: text('unit_name').notNull(),
  entryType: text('entry_type').notNull().default('CLASS'),
  dayOrDate: text('day_or_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  venue: text('venue').notNull(),
  lecturerName: text('lecturer_name'),
  semester: text('semester').notNull().default('Semester 1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const academicResources = pgTable(
  'academic_resources',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').defaultRandom().notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    school: text('school').notNull(),
    department: text('department').notNull(),
    course: text('course').notNull(),
    unitCode: text('unit_code').notNull(),
    unitName: text('unit_name').notNull(),
    academicYear: text('academic_year').notNull(),
    semester: text('semester').notNull(),
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name').notNull(),
    fileMime: text('file_mime').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull().default(0),
    uploadedById: integer('uploaded_by_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    approvalStatus: text('approval_status').notNull().default('PENDING'),
    rejectionReason: text('rejection_reason'),
    isRestricted: boolean('is_restricted').notNull().default(false),
    downloadCount: integer('download_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('resources_status_idx').on(t.approvalStatus),
    index('resources_unit_idx').on(t.unitCode),
    index('resources_category_idx').on(t.category),
  ]
);

export const resourceBookmarks = pgTable(
  'resource_bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    resourceId: integer('resource_id')
      .references(() => academicResources.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('bookmark_user_resource_uidx').on(t.userId, t.resourceId)]
);

export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  unitCode: text('unit_code').notNull(),
  unitName: text('unit_name').notNull(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  dueDate: text('due_date').notNull(),
  maxScore: integer('max_score').notNull().default(30),
  lecturerId: integer('lecturer_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id')
    .references(() => assignments.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  notes: text('notes'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  score: integer('score'),
  feedback: text('feedback'),
  status: text('status').notNull().default('SUBMITTED'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  name: text('name').notNull().unique(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  mission: text('mission'),
  logoUrl: text('logo_url'),
  leaderId: integer('leader_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  approvalStatus: text('approval_status').notNull().default('APPROVED'),
  contactEmail: text('contact_email'),
  meetingSchedule: text('meeting_schedule'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    roleTitle: text('role_title').notNull().default('Member'),
    status: text('status').notNull().default('PENDING'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('org_member_uidx').on(t.organizationId, t.userId)]
);

export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').defaultRandom().notNull().unique(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    scope: text('scope').notNull().default('UNIVERSITY'),
    targetName: text('target_name'),
    priority: text('priority').notNull().default('NORMAL'),
    authorId: integer('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: integer('organization_id').references(
      () => organizations.id,
      { onDelete: 'set null' }
    ),
    approvalStatus: text('approval_status').notNull().default('APPROVED'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('announcements_scope_idx').on(t.scope)]
);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  location: text('location').notNull(),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  capacity: integer('capacity').notNull().default(100),
  posterUrl: text('poster_url'),
  organizerId: integer('organizer_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: integer('organization_id').references(
    () => organizations.id,
    { onDelete: 'set null' }
  ),
  approvalStatus: text('approval_status').notNull().default('APPROVED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    attendanceStatus: text('attendance_status').notNull().default('REGISTERED'),
    reminderEnabled: boolean('reminder_enabled').notNull().default(true),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('event_reg_uidx').on(t.eventId, t.userId)]
);

export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').defaultRandom().notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    priceKes: integer('price_kes').notNull(),
    condition: text('condition').notNull().default('Used - Good'),
    imageUrl: text('image_url'),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    availabilityStatus: text('availability_status')
      .notNull()
      .default('AVAILABLE'),
    moderationStatus: text('moderation_status').notNull().default('APPROVED'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('marketplace_cat_idx').on(t.category)]
);

export const accommodations = pgTable('accommodations', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  name: text('name').notNull(),
  providerType: text('provider_type').notNull(),
  description: text('description').notNull(),
  location: text('location').notNull(),
  pricePerSemesterKes: integer('price_per_semester_kes').notNull(),
  roomsAvailable: integer('rooms_available').notNull().default(0),
  availabilityVerified: boolean('availability_verified')
    .notNull()
    .default(false),
  amenities: text('amenities').notNull(),
  imageUrl: text('image_url'),
  contactInfo: text('contact_info').notNull(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  moderationStatus: text('moderation_status').notNull().default('APPROVED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accommodationRequests = pgTable('accommodation_requests', {
  id: serial('id').primaryKey(),
  accommodationId: integer('accommodation_id')
    .references(() => accommodations.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  preferredMoveIn: text('preferred_move_in').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lostFoundItems = pgTable('lost_found_items', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  reportType: text('report_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  location: text('location').notNull(),
  dateReported: text('date_reported').notNull(),
  imageUrl: text('image_url'),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull().default('OPEN'),
  moderationStatus: text('moderation_status').notNull().default('APPROVED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lostFoundClaims = pgTable('lost_found_claims', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .references(() => lostFoundItems.id, { onDelete: 'cascade' })
    .notNull(),
  claimantId: integer('claimant_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  verificationDetails: text('verification_details').notNull(),
  status: text('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  title: text('title').notNull(),
  organizationName: text('organization_name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  eligibility: text('eligibility').notNull(),
  location: text('location').notNull(),
  deadline: text('deadline').notNull(),
  externalUrl: text('external_url'),
  postedById: integer('posted_by_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  approvalStatus: text('approval_status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedOpportunities = pgTable(
  'saved_opportunities',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    opportunityId: integer('opportunity_id')
      .references(() => opportunities.id, { onDelete: 'cascade' })
      .notNull(),
    reminderDate: text('reminder_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saved_opp_uidx').on(t.userId, t.opportunityId)]
);

export const campusLocations = pgTable('campus_locations', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  buildingCode: text('building_code'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  coordinatesVerified: boolean('coordinates_verified')
    .notNull()
    .default(false),
  openingHours: text('opening_hours'),
  contactEmail: text('contact_email'),
  updatedById: integer('updated_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  publicId: uuid('public_id').defaultRandom().notNull().unique(),
  participantOneId: integer('participant_one_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  participantTwoId: integer('participant_two_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  contextLabel: text('context_label'),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  senderId: integer('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkPath: text('link_path'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.isRead)]
);

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contentReports = pgTable('content_reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('OPEN'),
  reviewedById: integer('reviewed_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

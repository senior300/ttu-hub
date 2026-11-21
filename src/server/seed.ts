import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  users,
  schools,
  departments,
  courses,
  units,
  timetables,
  academicResources,
  announcements,
  organizations,
  events,
  opportunities,
  accommodations,
  marketplaceListings,
  lostFoundItems,
  campusLocations,
  assignments,
} from '../db/schema.ts';
import { ensureUploadDirs, UPLOADS_ROOT } from './utils/uploads.ts';

let seedPromise: Promise<void> | null = null;

function writeSamplePdf(filename: string, title: string, bodyText: string) {
  ensureUploadDirs();
  const target = path.resolve(UPLOADS_ROOT, 'resources', filename);
  if (fs.existsSync(target)) {
    return `/uploads/resources/${filename}`;
  }
  const safeTitle = title.replace(/[()\\]/g, '');
  const safeBody = bodyText.replace(/[()\\]/g, '').slice(0, 180);
  const contentStream = `BT /F1 16 Tf 50 740 Td (${safeTitle}) Tj /F1 11 Tf 0 -28 Td (${safeBody}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${contentStream.length} >> stream
${contentStream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000400 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
470
%%EOF`;
  fs.writeFileSync(target, pdf, 'utf-8');
  return `/uploads/resources/${filename}`;
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeedIfEmpty().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  const existingSchools = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schools);
  if ((existingSchools[0]?.count ?? 0) > 0) {
    return;
  }

  // Create an internal institutional catalog publisher record (not usable for login)
  const [editorialUser] = await db
    .insert(users)
    .values({
      uid: 'system-ttu-editorial',
      email: 'catalog@ttu-hub.internal',
      fullName: 'TTU HUB Editorial Catalog',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      profileCompleted: true,
      school: 'School of Science and Informatics',
      department: 'Department of Mathematics & Informatics',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { updatedAt: new Date() },
    })
    .returning();

  const insertedSchools = await db
    .insert(schools)
    .values([
      {
        code: 'SME',
        name: 'School of Mines and Engineering',
        deanName: 'Office of the Dean, SME',
        description:
          'Mining, mineral processing, civil, mechanical, and geospatial engineering programmes.',
      },
      {
        code: 'SSI',
        name: 'School of Science and Informatics',
        deanName: 'Office of the Dean, SSI',
        description:
          'Computer science, mathematics, informatics, and applied physical sciences.',
      },
      {
        code: 'SBESS',
        name: 'School of Business, Economics and Social Sciences',
        deanName: 'Office of the Dean, SBESS',
        description:
          'Commerce, procurement, economics, and entrepreneurship programmes.',
      },
    ])
    .returning();

  const sme = insertedSchools.find((s) => s.code === 'SME')!;
  const ssi = insertedSchools.find((s) => s.code === 'SSI')!;
  const sbess = insertedSchools.find((s) => s.code === 'SBESS')!;

  const insertedDepts = await db
    .insert(departments)
    .values([
      {
        schoolId: sme.id,
        code: 'MPE',
        name: 'Mining and Mineral Processing Engineering',
        headName: 'Department Chair, Mining',
        officeLocation: 'Engineering Block B, Floor 2',
      },
      {
        schoolId: ssi.id,
        code: 'CSI',
        name: 'Mathematics and Informatics',
        headName: 'Department Chair, Informatics',
        officeLocation: 'Science Complex, Floor 1',
      },
      {
        schoolId: sbess.id,
        code: 'BUS',
        name: 'Business and Economics',
        headName: 'Department Chair, Business',
        officeLocation: 'Administration & Business Wing',
      },
    ])
    .returning();

  const mpe = insertedDepts.find((d) => d.code === 'MPE')!;
  const csi = insertedDepts.find((d) => d.code === 'CSI')!;
  const bus = insertedDepts.find((d) => d.code === 'BUS')!;

  const insertedCourses = await db
    .insert(courses)
    .values([
      {
        departmentId: csi.id,
        code: 'BSC-CS',
        name: 'B.Sc. Computer Science',
        level: 'BACHELORS',
        durationYears: 4,
      },
      {
        departmentId: mpe.id,
        code: 'BENG-MIN',
        name: 'B.Eng. Mining and Mineral Processing Engineering',
        level: 'BACHELORS',
        durationYears: 5,
      },
      {
        departmentId: bus.id,
        code: 'BCOM',
        name: 'Bachelor of Commerce',
        level: 'BACHELORS',
        durationYears: 4,
      },
    ])
    .returning();

  const bscCs = insertedCourses.find((c) => c.code === 'BSC-CS')!;
  const bengMin = insertedCourses.find((c) => c.code === 'BENG-MIN')!;
  const bcom = insertedCourses.find((c) => c.code === 'BCOM')!;

  await db.insert(units).values([
    {
      courseId: bscCs.id,
      code: 'ICS 2304',
      name: 'Database Management Systems',
      yearOfStudy: 3,
      semester: 'Semester 1',
      description: 'Relational modeling, normalization, SQL optimization, and transactions.',
    },
    {
      courseId: bscCs.id,
      code: 'ICS 2208',
      name: 'Data Structures and Algorithms',
      yearOfStudy: 2,
      semester: 'Semester 2',
      description: 'Trees, graphs, dynamic programming, and asymptotic complexity.',
    },
    {
      courseId: bengMin.id,
      code: 'EMG 2311',
      name: 'Rock Mechanics and Slope Stability',
      yearOfStudy: 3,
      semester: 'Semester 1',
      description: 'Stress analysis in rock masses and open-pit slope engineering.',
    },
    {
      courseId: bcom.id,
      code: 'BBC 2105',
      name: 'Financial Accounting Principles',
      yearOfStudy: 1,
      semester: 'Semester 1',
      description: 'Ledger accounting, financial statements, and IFRS basics.',
    },
  ]);

  await db.insert(timetables).values([
    {
      courseName: 'B.Sc. Computer Science',
      unitCode: 'ICS 2304',
      unitName: 'Database Management Systems',
      entryType: 'CLASS',
      dayOrDate: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      venue: 'Computer Lab 2',
      lecturerName: 'Assigned Unit Lecturer',
      semester: 'Semester 1',
    },
    {
      courseName: 'B.Sc. Computer Science',
      unitCode: 'ICS 2208',
      unitName: 'Data Structures and Algorithms',
      entryType: 'CLASS',
      dayOrDate: 'Wednesday',
      startTime: '10:30',
      endTime: '12:30',
      venue: 'Lecture Hall LH-4',
      lecturerName: 'Assigned Unit Lecturer',
      semester: 'Semester 1',
    },
    {
      courseName: 'B.Eng. Mining and Mineral Processing Engineering',
      unitCode: 'EMG 2311',
      unitName: 'Rock Mechanics and Slope Stability',
      entryType: 'CLASS',
      dayOrDate: 'Tuesday',
      startTime: '14:00',
      endTime: '16:00',
      venue: 'Geomechanics Lab',
      lecturerName: 'Assigned Unit Lecturer',
      semester: 'Semester 1',
    },
    {
      courseName: 'B.Sc. Computer Science',
      unitCode: 'ICS 2304',
      unitName: 'Database Management Systems',
      entryType: 'EXAM',
      dayOrDate: '2026-12-08',
      startTime: '09:00',
      endTime: '12:00',
      venue: 'Main Examination Hall',
      lecturerName: 'Examinations Office',
      semester: 'Semester 1',
    },
    {
      courseName: 'B.Sc. Computer Science',
      unitCode: 'ICS 2208',
      unitName: 'Data Structures and Algorithms',
      entryType: 'EXAM',
      dayOrDate: '2026-12-11',
      startTime: '14:00',
      endTime: '17:00',
      venue: 'Science Complex Hall B',
      lecturerName: 'Examinations Office',
      semester: 'Semester 1',
    },
  ]);

  const pdf1 = writeSamplePdf(
    'ics2304-normalization.pdf',
    'ICS 2304: Relational Normalization Notes',
    'Covers 1NF, 2NF, 3NF, BCNF, functional dependencies, and PostgreSQL indexing examples.'
  );
  const pdf2 = writeSamplePdf(
    'emg2311-rock-mechanics-revision.pdf',
    'EMG 2311: Rock Mechanics Revision Guide',
    'Mohr-Coulomb failure criterion, stereonet kinematic checks, and slope stability factors.'
  );
  const pdf3 = writeSamplePdf(
    'ics2208-graphs-past-paper.pdf',
    'ICS 2208: Sample Revision Questions',
    'Practice problems on BFS, DFS, Dijkstra shortest paths, and dynamic programming.'
  );

  await db.insert(academicResources).values([
    {
      title: 'Relational Database Normalization & Indexing Guide',
      description:
        'Comprehensive lecture notes on 1NF through BCNF, B-Tree indexes, and query plans in PostgreSQL.',
      category: 'NOTES',
      school: 'School of Science and Informatics',
      department: 'Mathematics and Informatics',
      course: 'B.Sc. Computer Science',
      unitCode: 'ICS 2304',
      unitName: 'Database Management Systems',
      academicYear: '2026/2027',
      semester: 'Semester 1',
      fileUrl: pdf1,
      fileName: 'ics2304-normalization.pdf',
      fileMime: 'application/pdf',
      fileSizeBytes: 1248,
      uploadedById: editorialUser.id,
      approvalStatus: 'APPROVED',
      downloadCount: 18,
    },
    {
      title: 'Rock Mechanics & Slope Stability Revision Workbook',
      description:
        'Worked tutorial examples covering shear strength parameters and kinematic slope checks.',
      category: 'REVISION',
      school: 'School of Mines and Engineering',
      department: 'Mining and Mineral Processing Engineering',
      course: 'B.Eng. Mining and Mineral Processing Engineering',
      unitCode: 'EMG 2311',
      unitName: 'Rock Mechanics and Slope Stability',
      academicYear: '2026/2027',
      semester: 'Semester 1',
      fileUrl: pdf2,
      fileName: 'emg2311-rock-mechanics-revision.pdf',
      fileMime: 'application/pdf',
      fileSizeBytes: 1180,
      uploadedById: editorialUser.id,
      approvalStatus: 'APPROVED',
      downloadCount: 11,
    },
    {
      title: 'Data Structures & Graph Algorithms Practice Pack',
      description:
        'Unrestricted revision problem set for trees, heaps, and shortest-path algorithms.',
      category: 'PAST_PAPER',
      school: 'School of Science and Informatics',
      department: 'Mathematics and Informatics',
      course: 'B.Sc. Computer Science',
      unitCode: 'ICS 2208',
      unitName: 'Data Structures and Algorithms',
      academicYear: '2025/2026',
      semester: 'Semester 2',
      fileUrl: pdf3,
      fileName: 'ics2208-graphs-past-paper.pdf',
      fileMime: 'application/pdf',
      fileSizeBytes: 1105,
      uploadedById: editorialUser.id,
      approvalStatus: 'APPROVED',
      downloadCount: 24,
    },
  ]);

  await db.insert(assignments).values([
    {
      unitCode: 'ICS 2304',
      unitName: 'Database Management Systems',
      title: 'ERD & PostgreSQL Schema Design Assignment',
      instructions:
        'Submit a normalized entity-relationship diagram and SQL DDL script for a campus library inventory.',
      dueDate: '2026-12-02',
      maxScore: 30,
      lecturerId: editorialUser.id,
    },
  ]);

  const insertedOrgs = await db
    .insert(organizations)
    .values([
      {
        name: 'TTU Innovation & Software Club',
        category: 'TECH',
        description:
          'Student-led engineering community exploring web systems, open source, and hackathon projects.',
        mission: 'Build practical digital tools and peer mentorship across campus.',
        leaderId: editorialUser.id,
        approvalStatus: 'APPROVED',
        contactEmail: 'innovation-club@ttu-hub.internal',
        meetingSchedule: 'Thursdays, 4:00 PM · Computer Lab 1',
      },
      {
        name: 'Society of Mining & Earth Sciences Students',
        category: 'ACADEMIC',
        description:
          'Academic society connecting mining, geology, and mineral processing undergraduates with industry field trips.',
        mission: 'Bridge classroom engineering with responsible resource extraction.',
        leaderId: editorialUser.id,
        approvalStatus: 'APPROVED',
        contactEmail: 'mining-society@ttu-hub.internal',
        meetingSchedule: 'Fridays, 3:00 PM · Engineering Hall',
      },
      {
        name: 'TTU Environmental & Wildlife Conservation Society',
        category: 'CULTURAL',
        description:
          'Campus stewardship group organizing Tsavo corridor cleanups, tree planting, and sustainability workshops.',
        mission: 'Champion ecological awareness across Taita Taveta.',
        leaderId: editorialUser.id,
        approvalStatus: 'APPROVED',
        contactEmail: 'conservation@ttu-hub.internal',
        meetingSchedule: 'Saturdays, 10:00 AM · Main Quad',
      },
    ])
    .returning();

  const techClub = insertedOrgs[0];

  await db.insert(announcements).values([
    {
      title: 'Welcome to TTU HUB Community Platform',
      body: 'TTU HUB is an independent student-centered digital ecosystem bringing Ed Vault notes, campus announcements, clubs, marketplace listings, and directory maps into one workspace. Always verify official academic deadlines with university notices.',
      scope: 'UNIVERSITY',
      targetName: 'All Campus',
      priority: 'IMPORTANT',
      authorId: editorialUser.id,
      approvalStatus: 'APPROVED',
    },
    {
      title: 'Semester 1 Timetable & Ed Vault Revisions Live',
      body: 'Updated sample class and examination timetables for B.Sc. Computer Science and Mining Engineering are now available under Academics.',
      scope: 'SCHOOL',
      targetName: 'School of Science and Informatics',
      priority: 'NORMAL',
      authorId: editorialUser.id,
      approvalStatus: 'APPROVED',
    },
    {
      title: 'Weekly Build & Code Review Session',
      body: 'Join the TTU Innovation & Software Club this Thursday for a hands-on TypeScript and PostgreSQL clinic.',
      scope: 'ORGANIZATION',
      targetName: techClub.name,
      priority: 'NORMAL',
      authorId: editorialUser.id,
      organizationId: techClub.id,
      approvalStatus: 'APPROVED',
    },
  ]);

  const now = Date.now();
  await db.insert(events).values([
    {
      title: 'Taita Taveta Tech & Civic Hackathon',
      description:
        '48-hour collaborative build weekend focusing on agriculture, water conservation, and campus logistics.',
      category: 'Hackathon',
      location: 'Main Innovation Auditorium',
      startAt: new Date(now + 7 * 86400000),
      endAt: new Date(now + 8 * 86400000),
      capacity: 120,
      organizerId: editorialUser.id,
      organizationId: techClub.id,
      approvalStatus: 'APPROVED',
    },
    {
      title: 'Industrial Attachment & Career Readiness Clinic',
      description:
        'CV reviews, logbook preparation, and engineering internship panel with alumni mentors.',
      category: 'Career',
      location: 'Main Library Seminar Room 2',
      startAt: new Date(now + 12 * 86400000),
      endAt: new Date(now + 12 * 86400000 + 3 * 3600000),
      capacity: 150,
      organizerId: editorialUser.id,
      approvalStatus: 'APPROVED',
    },
  ]);

  await db.insert(opportunities).values([
    {
      title: 'Software Engineering Industrial Attachment (Q1 2027)',
      organizationName: 'Coastal Digital Labs Mombasa',
      category: 'Industrial Attachment',
      description:
        '12-week supervised industrial attachment covering full-stack web APIs, testing, and cloud deployment.',
      eligibility: '3rd or 4th Year Computer Science / IT undergraduates',
      location: 'Mombasa / Hybrid',
      deadline: '2026-12-20',
      externalUrl: 'https://example.org/attachments',
      postedById: editorialUser.id,
      approvalStatus: 'APPROVED',
    },
    {
      title: 'East Africa Mineral Processing Graduate Trainee',
      organizationName: 'Rift Valley Minerals Ltd.',
      category: 'Graduate Programme',
      description:
        'Structured 18-month rotational programme across ore beneficiation, metallurgy labs, and mine safety.',
      eligibility: 'Final-year B.Eng. Mining & Mineral Processing students',
      location: 'Voi / Kajiado',
      deadline: '2027-01-15',
      externalUrl: 'https://example.org/mining-graduate',
      postedById: editorialUser.id,
      approvalStatus: 'APPROVED',
    },
  ]);

  await db.insert(accommodations).values([
    {
      name: 'Ngerenyi Campus Residence Hall (University)',
      providerType: 'UNIVERSITY_HOSTEL',
      description:
        'On-campus student residence managed through university accommodation services. Contact the Accommodation Office to verify room allocation.',
      location: 'Main Campus North Wing',
      pricePerSemesterKes: 6500,
      roomsAvailable: 0,
      availabilityVerified: false,
      amenities: 'Study desks, Shared laundry, Campus security, Water & power',
      contactInfo: 'Verify allocation directly via Campus Accommodation Office',
      ownerId: editorialUser.id,
      moderationStatus: 'APPROVED',
    },
    {
      name: 'Voi Ridge Student Suites (Private)',
      providerType: 'PRIVATE_ACCOMMODATION',
      description:
        'Privately advertised furnished single and shared rooms 600m from the main gate. Confirm current vacancy directly with caretaker before paying deposits.',
      location: 'Ngerenyi Road, 600m from Main Gate',
      pricePerSemesterKes: 14000,
      roomsAvailable: 6,
      availabilityVerified: false,
      amenities: 'Wi-Fi ready, Backup water tank, Gated perimeter, Kitchenette',
      contactInfo: 'Submit an inquiry request inside TTU HUB',
      ownerId: editorialUser.id,
      moderationStatus: 'APPROVED',
    },
  ]);

  await db.insert(marketplaceListings).values([
    {
      title: 'Casio fx-991EX ClassWiz Scientific Calculator',
      description: 'Clean condition, used for two semesters. Ideal for Engineering and Maths units.',
      category: 'Electronics',
      priceKes: 2200,
      condition: 'Used - Like New',
      sellerId: editorialUser.id,
      availabilityStatus: 'AVAILABLE',
      moderationStatus: 'APPROVED',
    },
    {
      title: 'Engineering Drawing Board & T-Square Set (A2)',
      description: 'Complete A2 drawing board with carry sleeve and set squares.',
      category: 'Books',
      priceKes: 3500,
      condition: 'Used - Good',
      sellerId: editorialUser.id,
      availabilityStatus: 'AVAILABLE',
      moderationStatus: 'APPROVED',
    },
  ]);

  await db.insert(lostFoundItems).values([
    {
      reportType: 'FOUND',
      title: 'Blue Spiral Notebook (ICS 2304 Notes)',
      description: 'Left on the second desk near the window in Computer Lab 2 after the morning session.',
      location: 'Computer Lab 2',
      dateReported: '2026-11-19',
      reporterId: editorialUser.id,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
    },
  ]);

  // Note: Campus locations provide general Voi/campus-area defaults with coordinatesVerified = false
  // so administrators can set and verify exact building coordinates in the Directory Console.
  await db.insert(campusLocations).values([
    {
      name: 'TTU Main Library & Learning Commons',
      category: 'Library',
      description: 'Central reading halls, digital repository workstations, and quiet study rooms. (Coordinates configurable by Admin)',
      buildingCode: 'LIB-01',
      latitude: -3.4165,
      longitude: 38.5065,
      coordinatesVerified: false,
      openingHours: 'Mon–Sat · 08:00 – 22:00',
      contactEmail: 'library@ttu-hub.internal',
    },
    {
      name: 'School of Mines & Engineering Block',
      category: 'School',
      description: 'Geomechanics labs, mineral processing workshops, and faculty offices. (Coordinates configurable by Admin)',
      buildingCode: 'SME-01',
      latitude: -3.4172,
      longitude: 38.5074,
      coordinatesVerified: false,
      openingHours: 'Mon–Fri · 08:00 – 17:00',
      contactEmail: 'sme@ttu-hub.internal',
    },
    {
      name: 'Science & Informatics Complex',
      category: 'Laboratory',
      description: 'Computer laboratories 1–3, lecture rooms, and Mathematics & Informatics offices. (Coordinates configurable by Admin)',
      buildingCode: 'SCI-02',
      latitude: -3.4158,
      longitude: 38.5059,
      coordinatesVerified: false,
      openingHours: 'Mon–Fri · 08:00 – 19:00',
      contactEmail: 'sci@ttu-hub.internal',
    },
    {
      name: 'Student Welfare & Dean of Students Office',
      category: 'Student Service',
      description: 'Student clubs registration, accommodation advisory, and welfare support. (Coordinates configurable by Admin)',
      buildingCode: 'SWO-01',
      latitude: -3.4169,
      longitude: 38.5052,
      coordinatesVerified: false,
      openingHours: 'Mon–Fri · 08:00 – 17:00',
      contactEmail: 'welfare@ttu-hub.internal',
    },
  ]);
}

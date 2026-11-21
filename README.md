# TTU HUB — University Digital Ecosystem

> **TTU HUB — One University. One Connected Experience.**

An independent, full-stack university community and academic platform designed for Taita Taveta University (TTU) students, lecturers, student organizations, and administrators.

---

## Core Modules

- **Role-Based Authentication & Onboarding**: Firebase Google Sign-In verified server-side via `firebase-admin`, paired with PostgreSQL role profiles (`STUDENT`, `LECTURER`, `ORGANIZATION_LEADER`, `ADMIN`, `SUPERADMIN`) and administrator approval gates.
- **Role-Based Dashboards**: Tailored views for students, lecturers, organization leaders, and administrators backed by live PostgreSQL aggregations.
- **Academic Hub — Ed Vault**: Searchable repository for PDF/DOCX/PPTX/TXT lecture notes, past papers, revision guides, bookmarks, download tracking, magic-byte file upload validation, class/exam timetables, and coursework assignments.
- **Communication Hub**: Scoped announcements (University, School, Department, Student, Organization), notifications, and private direct messaging.
- **Campus Community & Organizations**: Club directory, membership request workflows, and leader-scoped member administration.
- **Events & Activities**: List and schedule views, event RSVP capacity checks, and attendance tracking.
- **Opportunities Hub**: Internships, industrial attachments, scholarships, competitions, and saved bookmarks.
- **Campus Marketplace**: Student listings with category/price filters, photo uploads, sold status, seller direct messaging, and moderation reporting (prepared for future M-Pesa integration without storing payment credentials).
- **Accommodation & Hostel Services**: Clear distinction between official university residence halls and privately advertised off-campus housing, with inquiry requests.
- **Lost & Found**: Lost/found reporting with privacy-protected claim verification.
- **Campus Directory & Map**: Searchable directory integrated with Leaflet & OpenStreetMap; building coordinates are administrator-configurable.
- **TTU AI Assistant**: Configurable student assistant (`GEMINI_API_KEY` or `OPENAI_API_KEY`) grounded in authorized platform records.
- **Administration & Audit Console**: Recharts analytics, user approval/suspension controls, content moderation, audit logs, and formula-safe CSV exports.
- **OpenAPI Documentation**: Interactive API reference available at `/api/docs` and `/api/openapi.json`.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, React Hook Form, Zod, Axios, Recharts, Leaflet / OpenStreetMap, Lucide Icons
- **Backend**: Node.js 22, Express, Multer, Express Rate Limit, Firebase Admin SDK
- **Database**: PostgreSQL via Drizzle ORM & `pg` connection pool

---

## Environment Setup

1. Copy `.env.example` to `.env` (or configure secrets in your hosting environment).
2. Configure Cloud SQL PostgreSQL variables (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`).
3. Optional keys:
   - `GEMINI_API_KEY` or `OPENAI_API_KEY` for TTU AI Assistant
   - `INITIAL_SUPERADMIN_EMAIL` to auto-assign initial SuperAdmin on sign-in

---

## Running & Testing

```bash
# Install dependencies
npm install

# Run full-stack development server (port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Run backend security & API integration tests
npm test

# Build frontend for production
npm run build

# Start production server
npm start
```

---

## Deployment

- Build the frontend bundle with `npm run build` and start the server with `npm start` on port `3000`.
- A `Dockerfile` and `docker-compose.yml` are included for containerized deployments (e.g., Cloud Run or Render).

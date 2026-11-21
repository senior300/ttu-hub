# TTU HUB Development Status

## Completed Modules
- **Database Schema & Cloud SQL PostgreSQL**: 29 relational tables with foreign keys, unique constraints, indexes, and Drizzle ORM schema verified against `information_schema.columns`.
- **Authentication & RBAC**: Firebase Google Sign-In with server-side ID token verification, PostgreSQL user synchronization, role-approval queue for Lecturer and Organization Leader requests, and one-time initial SuperAdmin claim flow.
- **Role-Based Dashboards**: Live PostgreSQL-backed dashboards for Student, Lecturer, Organization Leader, and Admin/SuperAdmin roles.
- **Academic Hub (Ed Vault)**: Resource catalog, search/filtering/pagination, bookmarks, secure file upload validation (magic-byte + MIME + 10 MB limit), RBAC download handler, timetables, and assignments.
- **Communication Hub**: Scoped announcements, notification feed, and private direct messaging.
- **Campus Community, Events & Opportunities**: Organization registration & leader-scoped membership management, event RSVPs with list/schedule views, and opportunity bookmarks.
- **Marketplace, Accommodation & Lost and Found**: Category/price filtering, image upload validation, seller direct messaging, hostel vs private accommodation separation, and privacy-preserving lost/found claims.
- **Campus Directory & Map**: Searchable directory with interactive Leaflet + OpenStreetMap view and admin-configurable coordinates.
- **Administration & OpenAPI**: Recharts analytics, user/content moderation, audit logs, CSV export, and `/api/docs` + `/api/openapi.json`.
- **TTU AI Assistant**: Server-side assistant grounded in authorized database records with graceful setup prompt when AI API keys are unconfigured.

## Pending / External Configuration
- Configure `GEMINI_API_KEY` or `OPENAI_API_KEY` in environment secrets to enable live AI generation in TTU AI.
- Optionally set `INITIAL_SUPERADMIN_EMAIL` (or claim SuperAdmin via the first-run Profile setup banner after signing in).
- M-Pesa Daraja API credentials can be wired into `/api/campus/marketplace` when merchant credentials are ready.

## Tests Passed
- `npm test`: Backend API, authentication enforcement (401 on protected routes), file signature validation, and path traversal safety tests.
- `npm run lint` & `npm run build`: TypeScript compilation and Vite production bundle checks.

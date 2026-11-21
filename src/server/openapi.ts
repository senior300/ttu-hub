import { Router } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TTU HUB API',
    version: '1.0.0',
    description:
      'RESTful API for TTU HUB — University Academic, Community, Marketplace, Directory, and Administration Platform.',
  },
  servers: [{ url: '/api', description: 'TTU HUB API Server' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
      },
    },
  },
  paths: {
    '/health': { get: { summary: 'Health check', responses: { '200': { description: 'OK' } } } },
    '/auth/profile': {
      get: { summary: 'Get authenticated user profile', security: [{ BearerAuth: [] }] },
      put: { summary: 'Complete or update onboarding profile', security: [{ BearerAuth: [] }] },
    },
    '/auth/dashboard': {
      get: { summary: 'Get role-specific dashboard aggregation', security: [{ BearerAuth: [] }] },
    },
    '/academics/structure': { get: { summary: 'List schools, departments, courses, and units' } },
    '/academics/timetables': { get: { summary: 'Query class and examination timetables' } },
    '/academics/resources': {
      get: { summary: 'Search and filter approved academic resources' },
      post: { summary: 'Upload academic resource (Lecturer/Admin)', security: [{ BearerAuth: [] }] },
    },
    '/academics/resources/{id}/download': {
      get: { summary: 'Download approved resource file and increment counter' },
    },
    '/communications/announcements': {
      get: { summary: 'List campus announcements' },
      post: { summary: 'Publish scoped announcement', security: [{ BearerAuth: [] }] },
    },
    '/communications/notifications': {
      get: { summary: 'List user notifications', security: [{ BearerAuth: [] }] },
    },
    '/communications/messages/conversations': {
      get: { summary: 'List direct message conversations', security: [{ BearerAuth: [] }] },
      post: { summary: 'Start a direct conversation', security: [{ BearerAuth: [] }] },
    },
    '/community/organizations': {
      get: { summary: 'List campus organizations' },
      post: { summary: 'Register organization', security: [{ BearerAuth: [] }] },
    },
    '/community/events': {
      get: { summary: 'List campus events' },
      post: { summary: 'Create event', security: [{ BearerAuth: [] }] },
    },
    '/community/opportunities': {
      get: { summary: 'List internships, attachments, and scholarships' },
      post: { summary: 'Submit opportunity', security: [{ BearerAuth: [] }] },
    },
    '/campus/marketplace': {
      get: { summary: 'Search campus marketplace listings' },
      post: { summary: 'Create marketplace listing', security: [{ BearerAuth: [] }] },
    },
    '/campus/accommodation': {
      get: { summary: 'List university and private accommodations' },
      post: { summary: 'Create accommodation listing', security: [{ BearerAuth: [] }] },
    },
    '/campus/lost-found': {
      get: { summary: 'List lost and found reports' },
      post: { summary: 'Report lost or found item', security: [{ BearerAuth: [] }] },
    },
    '/campus/directory': {
      get: { summary: 'List campus buildings and configurable map coordinates' },
      post: { summary: 'Create campus location (Admin)', security: [{ BearerAuth: [] }] },
    },
    '/admin/overview': {
      get: { summary: 'Platform analytics and KPIs (Admin)', security: [{ BearerAuth: [] }] },
    },
    '/admin/users': {
      get: { summary: 'Manage users and approvals (Admin)', security: [{ BearerAuth: [] }] },
    },
    '/ai/chat': {
      post: { summary: 'Query TTU AI student assistant', security: [{ BearerAuth: [] }] },
    },
  },
};

const router = Router();

router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

router.get('/docs', (_req, res) => {
  const rows = Object.entries(openApiSpec.paths)
    .map(([pathKey, methods]) => {
      const methodBadges = Object.entries(methods as Record<string, { summary?: string }>)
        .map(
          ([m, info]) =>
            `<div style="margin:6px 0;"><code style="background:#0B1F3A;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${m.toUpperCase()}</code> <strong style="margin-left:8px;">/api${pathKey}</strong> — <span style="color:#475569;">${info.summary || ''}</span></div>`
        )
        .join('');
      return `<div style="border-bottom:1px solid #e2e8f0;padding:10px 0;">${methodBadges}</div>`;
    })
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TTU HUB OpenAPI Documentation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 920px; margin: 40px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; }
  </style>
</head>
<body>
  <h1 style="color:#0B1F3A;">TTU HUB REST API Documentation</h1>
  <p>OpenAPI 3.0 specification JSON: <a href="/api/openapi.json">/api/openapi.json</a></p>
  <div class="card">${rows}</div>
</body>
</html>`);
});

export default router;

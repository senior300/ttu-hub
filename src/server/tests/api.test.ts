import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.ts';
import { validateAcademicBuffer, validateImageBuffer, resolveSafeUploadPath } from '../utils/uploads.ts';

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

describe('TTU HUB API & Security Tests', () => {
  it('returns health check and OpenAPI specification', async () => {
    await withServer(async (baseUrl) => {
      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthRes.status, 200);
      const health = await healthRes.json();
      assert.equal(health.status, 'ok');

      const openApiRes = await fetch(`${baseUrl}/api/openapi.json`);
      assert.equal(openApiRes.status, 200);
      const spec = await openApiRes.json();
      assert.equal(spec.openapi, '3.0.3');
      assert.ok(spec.paths['/academics/resources']);
    });
  });

  it('blocks unauthenticated access to protected endpoints', async () => {
    await withServer(async (baseUrl) => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/auth/profile' },
        { method: 'GET', path: '/api/auth/dashboard' },
        { method: 'GET', path: '/api/admin/overview' },
        { method: 'POST', path: '/api/academics/resources' },
        { method: 'POST', path: '/api/communications/announcements' },
        { method: 'POST', path: '/api/campus/marketplace' },
        { method: 'GET', path: '/api/communications/notifications' },
      ];

      for (const ep of protectedEndpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
        assert.equal(
          res.status,
          401,
          `Expected 401 for ${ep.method} ${ep.path}, got ${res.status}`
        );
      }
    });
  });

  it('rejects invalid token on authenticated endpoints', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        headers: { Authorization: 'Bearer invalid.jwt.token' },
      });
      assert.equal(res.status, 401);
    });
  });

  it('validates academic and image file signatures properly', () => {
    const validPdf = Buffer.from('%PDF-1.4 sample content');
    assert.equal(
      validateAcademicBuffer(validPdf, 'notes.pdf', 'application/pdf').valid,
      true
    );

    const spoofedPdf = Buffer.from('MZ executable content');
    assert.equal(
      validateAcademicBuffer(spoofedPdf, 'fake.pdf', 'application/pdf').valid,
      false
    );

    assert.equal(
      validateAcademicBuffer(Buffer.from('hello'), 'script.sh', 'application/x-sh').valid,
      false
    );

    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(
      validateImageBuffer(validPng, 'photo.png', 'image/png').valid,
      true
    );

    const spoofedPng = Buffer.from('not really a png file');
    assert.equal(
      validateImageBuffer(spoofedPng, 'photo.png', 'image/png').valid,
      false
    );
  });

  it('prevents path traversal when resolving upload paths', () => {
    assert.equal(resolveSafeUploadPath('../../etc/passwd'), null);
    assert.ok(resolveSafeUploadPath('resources/sample.pdf'));
  });
});

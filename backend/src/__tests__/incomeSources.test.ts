/**
 * Income Sources API Integration Tests
 *
 * Uses supertest to make real HTTP requests against the Express app
 * with a fresh test database each run.
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Set test environment BEFORE any app imports
process.env.NODE_ENV = 'test';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-income-sources.db');
process.env.DB_PATH = TEST_DB_PATH;

// Remove stale test DB if it exists
function cleanDb(): void {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    for (const suffix of ['-wal', '-shm']) {
      const p = TEST_DB_PATH + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch { /* ok */ }
}

let app: any;
let token: string;
let sourceId: number;

describe('Income Sources API — Integration Tests', () => {
  beforeAll(() => {
    cleanDb();
    jest.resetModules();
    app = require('../index').default;
  });

  afterAll(() => {
    cleanDb();
  });

  // Helper: sign up a user and get a token
  async function signupAndGetToken(): Promise<string> {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `income-test-${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Income Test User',
      });
    return res.body.token;
  }

  beforeAll(async () => {
    token = await signupAndGetToken();
  });

  // ── Create ─────────────────────────────────────────────────

  describe('POST /api/income-sources', () => {
    test('creates an income source and returns it', async () => {
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Restaurant',
          hourly_rate: 18.5,
          pay_schedule: 'biweekly',
        })
        .expect(201);

      expect(res.body.id).toBeGreaterThan(0);
      expect(res.body.name).toBe('Restaurant');
      expect(res.body.hourly_rate).toBe(18.5);
      expect(res.body.pay_schedule).toBe('biweekly');
      expect(res.body.is_default).toBe(false);
      sourceId = res.body.id;
    });

    test('defaults pay_schedule to weekly when not provided', async () => {
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Freelance',
          hourly_rate: 50,
        })
        .expect(201);

      expect(res.body.pay_schedule).toBe('weekly');
    });

    test('sets is_default and unsets previous defaults', async () => {
      // Create a default source
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Main Job',
          hourly_rate: 25,
          is_default: true,
        })
        .expect(201);

      expect(res.body.is_default).toBe(true);

      // Create another default — should unset the previous one
      const res2 = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Main Job',
          hourly_rate: 30,
          is_default: true,
        })
        .expect(201);

      expect(res2.body.is_default).toBe(true);

      // Verify the old default was unset
      const list = await request(app)
        .get('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const oldDefault = list.body.find((s: any) => s.name === 'Main Job');
      expect(oldDefault.is_default).toBe(false);
    });

    test('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ hourly_rate: 20 })
        .expect(400);

      expect(res.body.error).toMatch(/name/i);
    });

    test('returns 400 for negative hourly_rate', async () => {
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', hourly_rate: -5 })
        .expect(400);

      expect(res.body.error).toMatch(/hourly_rate/i);
    });

    test('returns 400 for invalid pay_schedule', async () => {
      const res = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', hourly_rate: 20, pay_schedule: 'daily' })
        .expect(400);

      expect(res.body.error).toMatch(/pay_schedule/);
    });
  });

  // ── List ───────────────────────────────────────────────────

  describe('GET /api/income-sources', () => {
    test('lists income sources for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      // Default should come first
      expect(res.body[0].is_default).toBe(true);
    });

    test('returns 401 without auth', async () => {
      await request(app)
        .get('/api/income-sources')
        .expect(401);
    });
  });

  // ── Update ─────────────────────────────────────────────────

  describe('PUT /api/income-sources/:id', () => {
    test('updates an income source', async () => {
      const res = await request(app)
        .put(`/api/income-sources/${sourceId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Restaurant Updated',
          hourly_rate: 20,
          pay_schedule: 'weekly',
        })
        .expect(200);

      expect(res.body.name).toBe('Restaurant Updated');
      expect(res.body.hourly_rate).toBe(20);
      expect(res.body.pay_schedule).toBe('weekly');
    });

    test('returns 404 for non-existent source', async () => {
      await request(app)
        .put('/api/income-sources/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost', hourly_rate: 10 })
        .expect(404);
    });
  });

  // ── Stats ──────────────────────────────────────────────────

  describe('GET /api/income-sources/:id/stats', () => {
    test('returns stats for an income source with no shifts', async () => {
      const res = await request(app)
        .get(`/api/income-sources/${sourceId}/stats`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total_hours).toBe(0);
      expect(res.body.total_earnings).toBe(0);
      expect(res.body.shift_count).toBe(0);
      expect(res.body.period).toBe('last_4_weeks');
      expect(res.body.income_source).toBeDefined();
    });

    test('returns 404 for non-existent source', async () => {
      await request(app)
        .get('/api/income-sources/99999/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ── Delete ─────────────────────────────────────────────────

  describe('DELETE /api/income-sources/:id', () => {
    test('deletes an income source with no shifts', async () => {
      // Create a source with no shifts
      const create = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ToDelete', hourly_rate: 15 })
        .expect(201);

      const deleteId = create.body.id;

      await request(app)
        .delete(`/api/income-sources/${deleteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    test('prevents deletion when shifts reference the source', async () => {
      // First create a source
      const create = await request(app)
        .post('/api/income-sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'HasShifts', hourly_rate: 25 })
        .expect(201);

      const sourceIdWithShift = create.body.id;

      // Create a shift referencing it
      await request(app)
        .post('/api/shifts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2025-06-15',
          hours_worked: 8,
          hourly_rate: 25,
          income_source_id: sourceIdWithShift,
        })
        .expect(201);

      // Try to delete — should fail
      const res = await request(app)
        .delete(`/api/income-sources/${sourceIdWithShift}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.error).toMatch(/shifts assigned/i);
    });
  });
});

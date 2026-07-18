/**
 * Auth API Integration Tests
 *
 * Uses supertest to make real HTTP requests against the Express app
 * with a fresh test database each run.
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Set test environment BEFORE any app imports
process.env.NODE_ENV = 'test';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-auth.db');
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

describe('Auth API — Integration Tests', () => {
  beforeAll(() => {
    cleanDb();
    // Clear require cache so db.ts picks up the new DB_PATH
    jest.resetModules();
    // Dynamically require after env is set
    app = require('../index').default;
  });

  afterAll(() => {
    cleanDb();
  });

  // ── Signup ────────────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    test('creates a user and returns a token', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'testpassword123',
          name: 'Test User',
        })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toMatch(/test-/);
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.id).toBeGreaterThan(0);
      expect(res.body.user.pay_schedule).toBe('biweekly'); // default
    });

    test('duplicate email returns 409', async () => {
      const email = `dup-${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'testpassword123', name: 'Dup User' })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'testpassword123', name: 'Dup User' })
        .expect(409);

      expect(res.body.error).toMatch(/already registered/i);
    });

    test('missing email returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ password: '12345678', name: 'No Email' })
        .expect(400);

      expect(res.body.error).toMatch(/email/i);
    });

    test('invalid email format returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'notanemail', password: '12345678', name: 'Bad Email' })
        .expect(400);

      expect(res.body.error).toMatch(/invalid email/i);
    });

    test('short password returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'short@pw.com', password: '123', name: 'Short PW' })
        .expect(400);

      expect(res.body.error).toMatch(/at least 8/i);
    });

    test('custom pay_schedule is accepted', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `weekly-${Date.now()}@example.com`,
          password: 'weekly1234',
          name: 'Weekly Worker',
          pay_schedule: 'weekly',
        })
        .expect(201);

      expect(res.body.user.pay_schedule).toBe('weekly');
    });

    test('invalid pay_schedule returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `bad-sched-${Date.now()}@example.com`,
          password: 'password123',
          name: 'Bad Schedule',
          pay_schedule: 'daily',
        })
        .expect(400);

      expect(res.body.error).toMatch(/invalid pay_schedule/i);
    });
  });

  // ── Login ─────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const email = `login-${Date.now()}@example.com`;
    const password = 'loginpassword';

    beforeAll(async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ email, password, name: 'Login Test' })
        .expect(201);
    });

    test('correct credentials returns token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.name).toBe('Login Test');
    });

    test('wrong password returns 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' })
        .expect(401);

      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    test('non-existent email returns 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'whatever' })
        .expect(401);

      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    test('missing email returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'something' })
        .expect(400);

      expect(res.body.error).toMatch(/email and password are required/i);
    });
  });

  // ── GET /me ───────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `me-${Date.now()}@example.com`,
          password: 'metestpass',
          name: 'Me User',
        });
      token = res.body.token;
    });

    test('valid token returns user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toMatch(/me-/);
    });

    test('no token returns 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    test('invalid token returns 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer some.invalid.token.here')
        .expect(401);

      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    test('malformed auth header returns 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });
  });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('Entorno de pruebas', () => {
  it('el test runner ejecuta correctamente (1 + 1 = 2)', () => {
    expect(1 + 1).toBe(2);
  });

  it('GET /api/health responde 200 y status ok', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('message');
  });
});

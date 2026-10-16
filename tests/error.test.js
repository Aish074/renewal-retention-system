const request = require('supertest');
const app = require('../src/app');
const AppError = require('../src/utils/AppError');
const { errorHandler } = require('../src/middleware/errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('error handling', () => {
  it('returns a JSON 404 for an unknown route', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  describe('errorHandler', () => {
    it('uses the status and code of an AppError', () => {
      const res = mockRes();

      errorHandler(new AppError('Already exists', 409, 'CONFLICT'), {}, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: { code: 'CONFLICT', message: 'Already exists' },
      });
    });

    it('returns a generic 500 for unexpected errors', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = mockRes();

      errorHandler(new Error('db exploded'), {}, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
      spy.mockRestore();
    });
  });
});
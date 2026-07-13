process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://cleanops:cleanops@localhost:5432/cleanops_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

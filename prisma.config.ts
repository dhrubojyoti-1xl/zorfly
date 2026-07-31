import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'database/schema.prisma',
  migrations: {
    path: 'database/migrations'
  },
  datasource: {
    url:
      process.env.DATABASE_DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://zorfly:zorfly-local@localhost:5432/zorfly?schema=public'
  }
});

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import { createPrismaClient } from '@zorfly/database';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { passwordHasher } from '../src/modules/auth/password.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { createTokenService } from '../src/modules/auth/tokens.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma = connectionString ? createPrismaClient(connectionString) : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

integration('Prisma/PostgreSQL authentication repository', () => {
  it('registers, logs in, selects a tenant, and rotates a persisted session', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    const hashKey = 'integration-hash-key-with-at-least-32-characters';
    const tokens = createTokenService({
      signingKey: 'integration-signing-key-with-at-least-32-characters',
      hashKey,
      accessTokenTtlSeconds: 900
    });
    const service = new AuthService({
      repository: new PrismaAuthRepository(prisma, hashKey),
      passwordHasher,
      tokens,
      mailer: { send: () => Promise.resolve() },
      refreshTokenTtlSeconds: 604_800,
      appUrl: 'http://localhost:5173'
    });
    const email = `auth-${randomUUID()}@example.com`;
    const password = 'correct-password';
    const companySuffix = randomUUID().slice(0, 8);
    const firstCompanyName = `First Company ${companySuffix}`;
    const context = { requestId: randomUUID(), ip: '127.0.0.1', userAgent: 'vitest' };

    const first = await service.registerCompany(
      {
        companyName: firstCompanyName,
        fullName: 'Integration User',
        email,
        password,
        referralCode: ''
      },
      context
    );
    const second = await service.registerCompany(
      {
        companyName: `Second Company ${companySuffix}`,
        fullName: 'Integration User',
        email,
        password,
        referralCode: ''
      },
      context
    );

    expect(first.company?.id).not.toBe(second.company?.id);
    const login = await service.logIn({ email, password }, context);
    if (!('preAuthToken' in login) || !login.preAuthToken || !login.companies || !first.company) {
      throw new Error('Expected a multi-company login response.');
    }
    const companyIds = login.companies.map((company) => company.id);
    expect(login.requiresCompanySelection).toBe(true);
    expect(companyIds).toContain(first.company.id);
    expect(companyIds).toContain(second.company?.id);

    const selected = await service.selectCompany(
      { preAuthToken: login.preAuthToken, companyId: first.company.id },
      context
    );
    const refreshed = await service.refreshSession(selected.refreshToken, context);

    expect(refreshed.company?.id).toBe(first.company.id);
    expect(refreshed.refreshToken).not.toBe(selected.refreshToken);
    await expect(service.refreshSession(selected.refreshToken, context)).rejects.toMatchObject({
      statusCode: 401
    });

    const environment = parseApiEnvironment({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: connectionString,
      SESSION_SIGNING_KEY: 'integration-signing-key-with-at-least-32-characters',
      SESSION_HASH_KEY: hashKey
    });
    const app = createApp({
      environment,
      version: 'test',
      auth: { service, tokens },
      organization: { prisma }
    });
    const authorization = `Bearer ${selected.accessToken}`;
    const rolesResponse = await request(app)
      .get('/api/v1/roles')
      .set('authorization', authorization)
      .expect(200);
    const rolesBody = rolesResponse.body as {
      success: boolean;
      data: { builtIn: Array<{ key: string; fixed: boolean }> };
    };
    expect(rolesBody.success).toBe(true);
    expect(rolesBody.data.builtIn.find((role) => role.key === 'company_admin')?.fixed).toBe(true);

    const customRoleResponse = await request(app)
      .post('/api/v1/roles/custom')
      .set('authorization', authorization)
      .send({
        name: 'Quality Coach',
        permissions: ['tests:read', 'employees:read', 'not:a-real-permission']
      })
      .expect(201);
    const customRoleBody = customRoleResponse.body as {
      success: boolean;
      data: { key: string };
    };
    expect(customRoleBody.success).toBe(true);
    expect(customRoleBody.data.key).toBe('quality_coach');

    await request(app)
      .patch('/api/v1/companies/branding')
      .set('authorization', authorization)
      .send({ logoUrl: '/uploads/logo.png', primaryColour: '#1d4ed8' })
      .expect(200);
    const companyResponse = await request(app)
      .get('/api/v1/companies/current')
      .set('authorization', authorization)
      .expect(200);
    const companyBody = companyResponse.body as {
      success: boolean;
      data: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string;
        primaryColour: string;
      };
    };
    expect(companyBody.success).toBe(true);
    expect(companyBody.data).toEqual({
      id: first.company.id,
      name: firstCompanyName,
      slug: `first-company-${companySuffix}`,
      logoUrl: '/uploads/logo.png',
      primaryColour: '#1d4ed8'
    });

    const departmentResponse = await request(app)
      .post('/api/v1/departments')
      .set('authorization', authorization)
      .send({ name: 'Engineering' })
      .expect(201);
    const departmentBody = departmentResponse.body as {
      success: boolean;
      data: { id: string; name: string };
    };
    expect(departmentBody.data.name).toBe('Engineering');

    const branchResponse = await request(app)
      .post('/api/v1/branches')
      .set('authorization', authorization)
      .send({ name: 'Kolkata' })
      .expect(201);
    const branchBody = branchResponse.body as {
      success: boolean;
      data: { id: string; name: string };
    };
    expect(branchBody.data.name).toBe('Kolkata');

    const employeeEmail = `employee-${randomUUID()}@example.com`;
    const employeeResponse = await request(app)
      .post('/api/v1/employees')
      .set('authorization', authorization)
      .send({
        fullName: 'Team Leader',
        email: employeeEmail,
        contactNumber: '9876543210',
        role: 'team_leader',
        departmentId: departmentBody.data.id,
        branchId: branchBody.data.id,
        difficultyLevel: 'team_lead'
      })
      .expect(201);
    const employeeBody = employeeResponse.body as {
      success: boolean;
      data: {
        id: string;
        userId?: string;
        email: string;
        temporaryPassword: string | null;
      };
    };
    expect(employeeBody.data.email).toBe(employeeEmail);
    expect(employeeBody.data.temporaryPassword).toMatch(/^Zf@/);

    const createdMembership = await prisma.tenantMembership.findUniqueOrThrow({
      where: { id: employeeBody.data.id }
    });
    const teamResponse = await request(app)
      .post('/api/v1/teams')
      .set('authorization', authorization)
      .send({
        name: 'Platform',
        departmentId: departmentBody.data.id,
        branchId: branchBody.data.id,
        leaderUserId: createdMembership.userId
      })
      .expect(201);
    const teamBody = teamResponse.body as {
      success: boolean;
      data: { id: string; name: string };
    };
    expect(teamBody.data.name).toBe('Platform');

    await request(app)
      .patch(`/api/v1/employees/${employeeBody.data.id}`)
      .set('authorization', authorization)
      .send({ teamId: teamBody.data.id, difficultyLevel: 'manager' })
      .expect(200);
    const employeeListResponse = await request(app)
      .get('/api/v1/employees')
      .query({ search: employeeEmail })
      .set('authorization', authorization)
      .expect(200);
    const employeeListBody = employeeListResponse.body as {
      success: boolean;
      data: {
        rows: Array<{
          id: string;
          teamId: string | null;
          role: string;
          difficultyLevel: string;
        }>;
        totalCount: number;
      };
    };
    expect(employeeListBody.data.totalCount).toBe(1);
    expect(employeeListBody.data.rows[0]).toMatchObject({
      id: employeeBody.data.id,
      teamId: teamBody.data.id,
      role: 'team_leader',
      difficultyLevel: 'manager'
    });

    if (!second.company) throw new Error('Expected the second company session.');
    const secondBranchResponse = await request(app)
      .post('/api/v1/branches')
      .set('authorization', `Bearer ${second.accessToken}`)
      .send({ name: 'Foreign Branch' })
      .expect(201);
    const secondBranchBody = secondBranchResponse.body as {
      data: { id: string };
    };
    await request(app)
      .post('/api/v1/teams')
      .set('authorization', authorization)
      .send({ name: 'Cross Tenant Team', branchId: secondBranchBody.data.id })
      .expect(422);

    const categoryResponse = await request(app)
      .post('/api/v1/categories')
      .set('authorization', authorization)
      .send({ name: `Engineering ${randomUUID().slice(0, 8)}`, order: 10 })
      .expect(201);
    const categoryBody = categoryResponse.body as {
      data: { id: string; name: string };
    };
    const subCategoryResponse = await request(app)
      .post('/api/v1/categories')
      .set('authorization', authorization)
      .send({
        name: `Platform ${randomUUID().slice(0, 8)}`,
        parentId: categoryBody.data.id,
        order: 1
      })
      .expect(201);
    const subCategoryBody = subCategoryResponse.body as {
      data: { id: string };
    };
    const questionTitle = `Which platform behavior is correct ${randomUUID()}?`;
    const questionResponse = await request(app)
      .post('/api/v1/questions')
      .set('authorization', authorization)
      .send({
        title: questionTitle,
        type: 'mcq',
        categoryId: categoryBody.data.id,
        subCategoryId: subCategoryBody.data.id,
        difficulty: 'junior',
        marks: 10,
        negativeMarks: 1,
        explanation: 'Tenant references are always resolved server-side.',
        trainingLink: 'https://example.com/training',
        tags: ['security', 'platform'],
        content: {
          options: [
            { id: 'a', text: 'Trust a tenant ID from the request body.' },
            { id: 'b', text: 'Resolve tenant context from the authenticated session.' }
          ],
          correctOptionIds: ['b'],
          multiple: false,
          partialCredit: false
        }
      })
      .expect(201);
    const questionBody = questionResponse.body as {
      data: { id: string };
    };
    const questionDetailResponse = await request(app)
      .get(`/api/v1/questions/${questionBody.data.id}`)
      .set('authorization', authorization)
      .expect(200);
    const questionDetailBody = questionDetailResponse.body as {
      data: {
        categoryId: string;
        subCategoryId: string;
        type: string;
        difficulty: string;
        tags: string[];
      };
    };
    expect(questionDetailBody.data).toMatchObject({
      categoryId: categoryBody.data.id,
      subCategoryId: subCategoryBody.data.id,
      type: 'mcq',
      difficulty: 'junior'
    });
    expect(questionDetailBody.data.tags).toEqual(expect.arrayContaining(['security', 'platform']));

    await request(app)
      .put(`/api/v1/questions/${questionBody.data.id}`)
      .set('authorization', authorization)
      .send({
        title: questionTitle,
        type: 'true_false',
        categoryId: categoryBody.data.id,
        difficulty: 'senior',
        marks: 5,
        negativeMarks: 0,
        explanation: 'True.',
        trainingLink: '',
        tags: ['security'],
        content: { correctAnswer: true }
      })
      .expect(200);
    const storedQuestion = await prisma.question.findUniqueOrThrow({
      where: { id: questionBody.data.id },
      include: { versions: { orderBy: { versionNumber: 'asc' } } }
    });
    expect(storedQuestion.versions).toHaveLength(2);
    expect(storedQuestion.versions.map((version) => version.status)).toEqual([
      'SUPERSEDED',
      'PUBLISHED'
    ]);
    const questionListResponse = await request(app)
      .get('/api/v1/questions')
      .query({
        search: questionTitle,
        type: 'true_false',
        categoryId: categoryBody.data.id,
        difficulty: 'senior'
      })
      .set('authorization', authorization)
      .expect(200);
    const questionListBody = questionListResponse.body as {
      data: { rows: Array<{ id: string }>; totalCount: number };
    };
    expect(questionListBody.data.totalCount).toBe(1);
    expect(questionListBody.data.rows[0]?.id).toBe(questionBody.data.id);

    const secondCategoryResponse = await request(app)
      .post('/api/v1/categories')
      .set('authorization', `Bearer ${second.accessToken}`)
      .send({ name: `Foreign Category ${randomUUID().slice(0, 8)}` })
      .expect(201);
    const secondCategoryBody = secondCategoryResponse.body as {
      data: { id: string };
    };
    await request(app)
      .post('/api/v1/questions')
      .set('authorization', authorization)
      .send({
        title: 'Cross-company question must be rejected',
        type: 'true_false',
        categoryId: secondCategoryBody.data.id,
        difficulty: 'fresher',
        marks: 5,
        content: { correctAnswer: true }
      })
      .expect(422);

    const exportResponse = await request(app)
      .get('/api/v1/questions/export/csv')
      .set('authorization', authorization)
      .expect(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.text).toContain(questionTitle);

    await request(app)
      .delete(`/api/v1/employees/${employeeBody.data.id}`)
      .set('authorization', authorization)
      .expect(200);
    const removedMembership = await prisma.tenantMembership.findUniqueOrThrow({
      where: { id: employeeBody.data.id }
    });
    expect(removedMembership.status).toBe('TERMINATED');
    expect(removedMembership.deletedAt).not.toBeNull();
  }, 30_000);
});

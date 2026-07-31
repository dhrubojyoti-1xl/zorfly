export const roles = {
  companyAdmin: 'company_admin',
  hr: 'hr',
  teamLeader: 'team_leader',
  employee: 'employee',
  masterAdmin: 'master_admin'
} as const;

export const permissionCatalog = [
  'tests:manage',
  'tests:read',
  'questions:manage',
  'questions:read',
  'schedules:manage',
  'reviews:manage',
  'employees:create',
  'employees:read',
  'employees:update',
  'employees:delete',
  'departments:read',
  'departments:manage',
  'teams:read',
  'teams:manage',
  'branches:read',
  'branches:manage',
  'roles:manage',
  'learning:manage',
  'learning:read',
  'paths:manage',
  'certificates:read',
  'badges:read',
  'leaderboard:read',
  'reports:read',
  'drives:manage',
  'candidates:read',
  'settings:manage',
  'billing:manage',
  'notifications:read'
] as const;

export type PermissionKey = (typeof permissionCatalog)[number];
export type TenantRoleKey = Exclude<(typeof roles)[keyof typeof roles], 'master_admin'>;

export const defaultRolePermissions: Readonly<Record<TenantRoleKey, readonly PermissionKey[]>> = {
  company_admin: permissionCatalog,
  hr: [
    'tests:manage',
    'tests:read',
    'questions:manage',
    'questions:read',
    'schedules:manage',
    'reviews:manage',
    'employees:create',
    'employees:read',
    'employees:update',
    'departments:read',
    'teams:read',
    'branches:read',
    'learning:manage',
    'learning:read',
    'paths:manage',
    'certificates:read',
    'badges:read',
    'leaderboard:read',
    'reports:read',
    'drives:manage',
    'candidates:read',
    'notifications:read'
  ],
  team_leader: [
    'tests:read',
    'questions:read',
    'employees:read',
    'departments:read',
    'teams:read',
    'branches:read',
    'reviews:manage',
    'learning:read',
    'certificates:read',
    'badges:read',
    'leaderboard:read',
    'reports:read',
    'notifications:read'
  ],
  employee: [
    'tests:read',
    'learning:read',
    'certificates:read',
    'badges:read',
    'leaderboard:read',
    'notifications:read'
  ]
};

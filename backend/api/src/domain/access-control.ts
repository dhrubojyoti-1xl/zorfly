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

export const permissionCatalogView = [
  {
    group: 'Assessments',
    permissions: [
      ['tests:manage', 'Create, edit, publish & assign tests'],
      ['tests:read', 'View tests & results'],
      ['questions:manage', 'Manage the question bank'],
      ['questions:read', 'View questions'],
      ['schedules:manage', 'Manage recurring schedules'],
      ['reviews:manage', 'Handle the manual review queue']
    ]
  },
  {
    group: 'People',
    permissions: [
      ['employees:create', 'Add employees'],
      ['employees:read', 'View employees'],
      ['employees:update', 'Edit employees'],
      ['employees:delete', 'Remove employees'],
      ['departments:read', 'View departments'],
      ['departments:manage', 'Create & remove departments'],
      ['teams:read', 'View teams'],
      ['teams:manage', 'Create, edit & remove teams'],
      ['branches:read', 'View branches'],
      ['branches:manage', 'Create & remove branches'],
      ['roles:manage', 'Manage roles & permissions']
    ]
  },
  {
    group: 'Learning',
    permissions: [
      ['learning:manage', 'Manage learning content'],
      ['learning:read', 'Access learning content'],
      ['paths:manage', 'Manage learning paths'],
      ['certificates:read', 'View certificates'],
      ['badges:read', 'View badges & points']
    ]
  },
  {
    group: 'Performance',
    permissions: [
      ['leaderboard:read', 'View the leaderboard'],
      ['reports:read', 'View dashboards & reports']
    ]
  },
  {
    group: 'Recruitment',
    permissions: [
      ['drives:manage', 'Manage recruitment drives'],
      ['candidates:read', 'View & rank candidates']
    ]
  },
  {
    group: 'Company',
    permissions: [
      ['settings:manage', 'Manage company settings'],
      ['billing:manage', 'Manage billing & plans'],
      ['notifications:read', 'Receive notifications']
    ]
  }
].map((group) => ({
  group: group.group,
  permissions: group.permissions.map(([key, label]) => ({ key, label }))
}));

export const builtInRoles = [
  { key: roles.companyAdmin, name: 'Company Admin', fixed: true },
  { key: roles.hr, name: 'HR', fixed: false },
  { key: roles.teamLeader, name: 'Team Leader', fixed: false },
  { key: roles.employee, name: 'Employee', fixed: false }
] as const;

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
    'tests:manage',
    'tests:read',
    'questions:read',
    'schedules:manage',
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

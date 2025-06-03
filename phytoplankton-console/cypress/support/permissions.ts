import { PermissionStatements } from '../../src/apis';

const CASE_DETAILS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::case-management/case-details/*',
      'frn:console:cypress-tenant:::case-management/case-assignment/*',
    ],
  },
];
const CASE_OVERVIEW: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::case-management/case-overview/*',
      'frn:console:cypress-tenant:::case-management/case-assignment/*',
    ],
  },
];
const CASE_REOPEN: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::case-management/case-reopen/*'],
  },
];
const QA: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::case-management/qa/*'],
  },
];
const RULES: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::rules/my-rules/*',
      'frn:console:cypress-tenant:::rules/library/*',
    ],
  },
];
const RISK_SCORING_RISK_LEVELS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::risk-scoring/risk-levels/*'],
  },
];
const RISK_SCORING_RISK_FACTORS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::risk-scoring/risk-factors/*'],
  },
];
const RISK_SCORING_RISK_ALGORITHMS: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::risk-scoring/risk-algorithms/*'],
  },
];
const USERS_USER_OVERVIEW: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::users/user-overview/*',
      'frn:console:cypress-tenant:::users/user-tags/*',
      'frn:console:cypress-tenant:::users/user-manual-risk-levels/*',
    ],
  },
];
const USERS_USER_COMMENTS: PermissionStatements[] = [
  {
    actions: ['write'],
    resources: ['frn:console:cypress-tenant:::users/user-comments/*'],
  },
];
const USERS_USER_DETAILS: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::users/user-details/*'],
  },
];
const TRANSACTION_OVERVIEW: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::transactions/overview/*'],
  },
];
const TRANSACTION_DETAILS: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::transactions/details/*'],
  },
];
const DASHBOARD: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::dashboard/download-data/*'],
  },
];
const AUDIT_LOG: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::audit-log/export/*'],
  },
];
const COPILOT: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::copilot/narrative/*'],
  },
];
const REPORTS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::reports/schema/*',
      'frn:console:cypress-tenant:::reports/generated/*',
    ],
  },
];
const SETTINGS_ORGANIZATION: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: [
      'frn:console:cypress-tenant:::settings/transactions/*',
      'frn:console:cypress-tenant:::settings/users/*',
    ],
  },
];
const SETTINGS_USERS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::settings/users/*'],
  },
];
const ACCOUNTS: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::accounts/overview/*'],
  },
];
const ROLES: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::roles/overview/*'],
  },
];
const SANCTIONS: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::sanctions/search/*'],
  },
];
const SIMULATION: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::simulator/simulations/*'],
  },
];
const NOTIFICATIONS: PermissionStatements[] = [
  {
    actions: ['read'],
    resources: ['frn:console:cypress-tenant:::notifications/all/*'],
  },
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::settings/notifications/*'],
  },
];
const SETTINGS_DEVELOPER: PermissionStatements[] = [
  {
    actions: ['read', 'write'],
    resources: ['frn:console:cypress-tenant:::settings/developers/*'],
  },
];

export const PERMISSIONS: {
  [key: string]: PermissionStatements[];
} = {
  CASE_DETAILS,
  CASE_OVERVIEW,
  CASE_REOPEN,
  QA,
  RULES,
  RISK_SCORING_RISK_LEVELS,
  RISK_SCORING_RISK_FACTORS,
  RISK_SCORING_RISK_ALGORITHMS,
  USERS_USER_OVERVIEW,
  USERS_USER_COMMENTS,
  USERS_USER_DETAILS,
  TRANSACTION_OVERVIEW,
  TRANSACTION_DETAILS,
  DASHBOARD,
  AUDIT_LOG,
  COPILOT,
  REPORTS,
  SETTINGS_ORGANIZATION,
  SETTINGS_DEVELOPER,
  SIMULATION,
  NOTIFICATIONS,
  SANCTIONS,
  ACCOUNTS,
  ROLES,
  SETTINGS_USERS,
};

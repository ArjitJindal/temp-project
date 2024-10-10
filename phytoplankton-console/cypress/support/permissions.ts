import { Permission } from '../../src/apis';

const CASE_DETAILS: Permission[] = [
  'case-management:case-details:read',
  'case-management:case-details:write',
];
const CASE_OVERVIEW: Permission[] = [
  'case-management:case-overview:read',
  'case-management:case-overview:write',
];
const CASE_REOPEN: Permission[] = ['case-management:case-reopen:write'];
const QA: Permission[] = ['case-management:qa:read', 'case-management:qa:write'];
const RULES: Permission[] = ['rules:my-rules:read', 'rules:my-rules:write', 'rules:library:read'];
const RISK_SCORING_RISK_LEVELS: Permission[] = [
  'risk-scoring:risk-levels:read',
  'risk-scoring:risk-levels:write',
];
const RISK_SCORING_RISK_FACTORS: Permission[] = [
  'risk-scoring:risk-factors:read',
  'risk-scoring:risk-factors:write',
];
const RISK_SCORING_RISK_ALGORITHMS: Permission[] = ['risk-scoring:risk-algorithms:read'];
const USERS_USER_OVERVIEW: Permission[] = [
  'users:user-overview:read',
  'users:user-overview:write',
  'users:user-tags:write',
  'users:user-manual-risk-levels:write',
  'users:user-pep-status:write',
];
const USERS_USER_COMMENTS: Permission[] = ['users:user-comments:write'];
const USERS_USER_DETAILS: Permission[] = ['users:user-details:read'];
const TRANSACTION_OVERVIEW: Permission[] = [
  'transactions:overview:read',
  'transactions:overview:write',
];
const TRANSACTION_DETAILS: Permission[] = ['transactions:details:read'];
const DASHBOARD: Permission[] = ['dashboard:download-data:read'];
const AUDIT_LOG: Permission[] = ['audit-log:export:read'];
const COPILOT: Permission[] = ['copilot:narrative:read', 'copilot:narrative:write'];
const REPORTS: Permission[] = [
  'reports:schema:read',
  'reports:generated:read',
  'reports:generated:write',
];
const SETTINGS_ORGANIZATION: Permission[] = [
  'settings:organisation:read',
  'settings:organisation:write',
];
const ACCOUNTS: Permission[] = ['accounts:overview:read', 'accounts:overview:write'];
const ROLES: Permission[] = ['roles:overview:read', 'roles:overview:write'];
const SANCTIONS: Permission[] = ['sanctions:search:read'];
const SETTINGS_DEVELOPER: Permission[] = ['settings:developers:read', 'settings:developers:write'];
const SIMULATION: Permission[] = ['simulator:simulations:read', 'simulator:simulations:write'];
const NOTIFICATIONS: Permission[] = ['notifications:all:read'];

export const PERMISSIONS: {
  [key: string]: Permission[];
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
};

import { ManagedRoleName } from '@/@types/openapi-internal/ManagedRoleName'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { Permission } from '@/@types/openapi-internal/Permission'
import { FilterCondition } from '@/@types/openapi-internal/FilterCondition'

// Shared status filter values and filters to avoid repetition
const ALL_CASE_STATUS_VALUES = [
  'OPEN',
  'CLOSED',
  'REOPENED',
  'ESCALATED',
  'IN_REVIEW_OPEN',
  'IN_REVIEW_ESCALATED',
  'IN_REVIEW_CLOSED',
  'IN_REVIEW_REOPENED',
  'OPEN_IN_PROGRESS',
  'ESCALATED_IN_PROGRESS',
  'OPEN_ON_HOLD',
  'ESCALATED_ON_HOLD',
  'ESCALATED_L2',
]

const ALL_ALERT_STATUS_VALUES = [
  'OPEN',
  'CLOSED',
  'REOPENED',
  'ESCALATED',
  'IN_REVIEW_OPEN',
  'IN_REVIEW_ESCALATED',
  'IN_REVIEW_CLOSED',
  'IN_REVIEW_REOPENED',
  'OPEN_IN_PROGRESS',
  'ESCALATED_IN_PROGRESS',
  'OPEN_ON_HOLD',
  'ESCALATED_ON_HOLD',
  'ESCALATED_L2',
]

const STATUS_FILTERS_FULL: FilterCondition[] = [
  {
    permissionId: 'case-status',
    operator: 'Equals',
    param: 'filterCaseStatus',
    values: ALL_CASE_STATUS_VALUES,
  },
  {
    permissionId: 'alert-status',
    operator: 'Equals',
    param: 'filterAlertStatus',
    values: ALL_ALERT_STATUS_VALUES,
  },
]

export const DEFAULT_ROLES: {
  role: ManagedRoleName
  permissions: Permission[]
  description: string
}[] = [
  {
    role: 'admin',
    permissions: PERMISSIONS, // Admin has all permissions
    description:
      'Admin has unrestricted access to all features. They can invite new accounts to the console, and there can be multiple admins.',
  },
  {
    role: 'auditor',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-details:read',
      'case-management:case-reopen:write',
      'case-management:export:read',
      'sanctions:search:read',
      'rules:my-rules:read',
      'rules:library:read',
      'risk-scoring:risk-levels:read',
      'risk-scoring:risk-factors:read',
      'risk-scoring:risk-algorithms:read',
      'dashboard:download-data:read',
      'transactions:overview:read',
      'transactions:details:read',
      'transactions:export:read',
      'audit-log:export:read',
      'lists:whitelist:read',
      'lists:blacklist:read',
      'lists:export:read',
      'simulator:simulations:read',
      'notifications:all:read',
      'screening:search-profiles:read',
      'screening:screening-profiles:read',
    ],
    description:
      'Auditor has read-only access to the Dashboard, Case management, Rules, Risk scoring, and Audit log. They also have access to download information.',
  },
  {
    role: 'analyst',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-overview:write',
      'case-management:case-assignment:write',
      'case-management:case-details:read',
      'case-management:case-details:write',
      'case-management:case-reopen:write',
      'case-management:export:read',
      'sanctions:search:read',
      'sanctions:search:write',
      'rules:my-rules:read',
      'rules:library:read',
      'risk-scoring:risk-levels:read',
      'risk-scoring:risk-factors:read',
      'risk-scoring:risk-algorithms:read',
      'transactions:overview:read',
      'transactions:details:read',
      'transactions:export:read',
      'users:user-overview:read',
      'users:user-details:read',
      'risk-scoring:risk-score-details:read',
      'users:user-comments:write',
      'copilot:narrative:write',
      'copilot:narrative:read',
      'notifications:all:read',
      'screening:search-profiles:read',
      'screening:screening-profiles:read',
    ],
    description:
      'Analyst has unrestricted access to case management, but only has read-only rights to Audit log, Rules and Risk scoring.',
  },
  {
    role: 'approver',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-overview:write',
      'case-management:case-assignment:write',
      'case-management:case-details:read',
      'case-management:case-details:write',
      'case-management:case-reopen:write',
      'case-management:export:read',
      'sanctions:search:read',
      'sanctions:search:write',
      'rules:my-rules:read',
      'rules:library:read',
      'risk-scoring:risk-levels:read',
      'risk-scoring:risk-factors:read',
      'risk-scoring:risk-algorithms:read',
      'dashboard:download-data:read',
      'transactions:overview:read',
      'transactions:details:read',
      'transactions:export:read',
      'audit-log:export:read',
      'lists:whitelist:read',
      'lists:blacklist:read',
      'lists:export:read',
      'simulator:simulations:read',
      'users:user-overview:read',
      'users:user-details:read',
      'risk-scoring:risk-score-details:read',
      'users:user-comments:write',
      'notifications:all:read',
      'screening:search-profiles:read',
      'screening:screening-profiles:read',
    ],
    description:
      'Approver has unrestricted access to case management but only has read-only rights to Audit log, Rules and Risk scoring. Alerts are received when an analyst requires approval to close a case.',
  },
  {
    role: 'developer',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-details:read',
      'case-management:case-reopen:write',
      'case-management:export:read',
      'rules:my-rules:read',
      'rules:library:read',
      'risk-scoring:risk-levels:read',
      'risk-scoring:risk-factors:read',
      'risk-scoring:risk-algorithms:read',
      'users:user-overview:read',
      'users:user-details:read',
      'risk-scoring:risk-score-details:read',
      'dashboard:download-data:read',
      'settings:system-config:read',
      'settings:case-management:read',
      'settings:security:read',
      'settings:transactions:read',
      'settings:users:read',
      'settings:rules:read',
      'settings:screening:read',
      'settings:risk-scoring:read',
      'settings:notifications:read',
      'settings:add-ons:read',
      'settings:developers:read',
      'settings:developers:write',
      'transactions:overview:read',
      'transactions:details:read',
      'transactions:export:read',
      'audit-log:export:read',
      'lists:whitelist:read',
      'lists:blacklist:read',
      'lists:export:read',
      'simulator:simulations:read',
      'notifications:all:read',
      'screening:search-profiles:read',
      'screening:screening-profiles:read',
    ],
    description:
      'Developer have unrestricted access to the developer section on the console,  under settings. They have read-only access to all other features.',
  },
]

export const DEFAULT_ROLES_V2: {
  role: ManagedRoleName
  permissions: PermissionStatements[]
  description: string
  metadata?: {
    isRootRole?: boolean
    isWhitelabelRole?: boolean
  }
}[] = [
  {
    role: 'root',
    permissions: [
      { actions: ['read', 'write'], resources: ['frn:console:*:::*'] },
    ],
    description: 'Root role',
    metadata: {
      isRootRole: true,
    },
  },
  {
    role: 'whitelabel-root',
    permissions: [
      { actions: ['read', 'write'], resources: ['frn:console:*:::*'] },
    ],
    description: 'Whitelabel root role',
    metadata: {
      isWhitelabelRole: true,
      isRootRole: true,
    },
  },
  {
    role: 'admin',
    permissions: [
      { actions: ['read', 'write'], resources: ['frn:console:<default>:::*'] },
      {
        actions: ['read'],
        resources: [
          'frn:console:<default>:::case-management/case-status/*',
          'frn:console:<default>:::case-management/alert-status/*',
        ],
        filter: STATUS_FILTERS_FULL,
      },
    ],
    description:
      'Admin has unrestricted access to all features. They can invite new accounts to the console, and there can be multiple admins.',
  },
  {
    role: 'auditor',
    permissions: [
      {
        actions: ['read', 'write'],
        resources: [
          'frn:console:<default>:::case-management/case-reopen/*',
          'frn:console:<default>:::case-management/export/*',
          'frn:console:<default>:::rules/library/*',
          'frn:console:<default>:::risk-scoring/risk-algorithms/*',
          'frn:console:<default>:::dashboard/*',
          'frn:console:<default>:::transactions/details/*',
          'frn:console:<default>:::transactions/export/*',
          'frn:console:<default>:::audit-log/*',
          'frn:console:<default>:::lists/export/*',
          'frn:console:<default>:::notifications/*',
        ],
      },
      {
        actions: ['read'],
        resources: [
          'frn:console:<default>:::case-management/case-overview/*',
          'frn:console:<default>:::case-management/case-details/*',
          'frn:console:<default>:::sanctions/*',
          'frn:console:<default>:::rules/my-rules/*',
          'frn:console:<default>:::risk-scoring/risk-levels/*',
          'frn:console:<default>:::risk-scoring/risk-factors/*',
          'frn:console:<default>:::transactions/overview/*',
          'frn:console:<default>:::lists/whitelist/*',
          'frn:console:<default>:::lists/blacklist/*',
          'frn:console:<default>:::simulator/*',
          'frn:console:<default>:::screening/*',
          'frn:console:<default>:::case-management/case-status/*',
          'frn:console:<default>:::case-management/alert-status/*',
        ],
        filter: STATUS_FILTERS_FULL,
      },
    ],
    description:
      'Auditor has read-only access to the Dashboard, Case management, Rules, Risk scoring, and Audit log. They also have access to download information.',
  },
  {
    role: 'analyst',
    permissions: [
      {
        actions: ['read', 'write'],
        resources: [
          'frn:console:<default>:::case-management/case-overview/*',
          'frn:console:<default>:::case-management/case-assignment/*',
          'frn:console:<default>:::case-management/case-details/*',
          'frn:console:<default>:::case-management/case-reopen/*',
          'frn:console:<default>:::case-management/export/*',
          'frn:console:<default>:::sanctions/*',
          'frn:console:<default>:::rules/library/*',
          'frn:console:<default>:::risk-scoring/risk-algorithms/*',
          'frn:console:<default>:::risk-scoring/risk-score-details/*',
          'frn:console:<default>:::transactions/details/*',
          'frn:console:<default>:::transactions/export/*',
          'frn:console:<default>:::users/user-details/*',
          'frn:console:<default>:::users/user-comments/*',
          'frn:console:<default>:::copilot/*',
          'frn:console:<default>:::notifications/*',
        ],
      },
      {
        actions: ['read'],
        resources: [
          'frn:console:<default>:::rules/my-rules/*',
          'frn:console:<default>:::risk-scoring/risk-levels/*',
          'frn:console:<default>:::risk-scoring/risk-factors/*',
          'frn:console:<default>:::transactions/overview/*',
          'frn:console:<default>:::users/user-overview/*',
          'frn:console:<default>:::screening/*',
          'frn:console:<default>:::case-management/case-status/*',
          'frn:console:<default>:::case-management/alert-status/*',
        ],
        filter: STATUS_FILTERS_FULL,
      },
    ],
    description:
      'Analyst has unrestricted access to case management, but only has read-only rights to Audit log, Rules and Risk scoring.',
  },
  {
    role: 'approver',
    permissions: [
      {
        actions: ['read', 'write'],
        resources: [
          'frn:console:<default>:::case-management/case-overview/*',
          'frn:console:<default>:::case-management/case-assignment/*',
          'frn:console:<default>:::case-management/case-details/*',
          'frn:console:<default>:::case-management/case-reopen/*',
          'frn:console:<default>:::case-management/export/*',
          'frn:console:<default>:::sanctions/*',
          'frn:console:<default>:::rules/library/*',
          'frn:console:<default>:::risk-scoring/risk-algorithms/*',
          'frn:console:<default>:::risk-scoring/risk-score-details/*',
          'frn:console:<default>:::dashboard/*',
          'frn:console:<default>:::transactions/details/*',
          'frn:console:<default>:::transactions/export/*',
          'frn:console:<default>:::audit-log/*',
          'frn:console:<default>:::lists/export/*',
          'frn:console:<default>:::users/user-details/*',
          'frn:console:<default>:::users/user-comments/*',
          'frn:console:<default>:::notifications/*',
        ],
      },
      {
        actions: ['read'],
        resources: [
          'frn:console:<default>:::rules/my-rules/*',
          'frn:console:<default>:::risk-scoring/risk-levels/*',
          'frn:console:<default>:::risk-scoring/risk-factors/*',
          'frn:console:<default>:::transactions/overview/*',
          'frn:console:<default>:::lists/whitelist/*',
          'frn:console:<default>:::lists/blacklist/*',
          'frn:console:<default>:::simulator/*',
          'frn:console:<default>:::users/user-overview/*',
          'frn:console:<default>:::screening/*',
          'frn:console:<default>:::case-management/case-status/*',
          'frn:console:<default>:::case-management/alert-status/*',
        ],
        filter: STATUS_FILTERS_FULL,
      },
    ],
    description:
      'Approver has unrestricted access to case management but only has read-only rights to Audit log, Rules and Risk scoring. Alerts are received when an analyst requires approval to close a case.',
  },
  {
    role: 'developer',
    permissions: [
      {
        actions: ['read', 'write'],
        resources: [
          'frn:console:<default>:::case-management/case-reopen/*',
          'frn:console:<default>:::case-management/export/*',
          'frn:console:<default>:::rules/library/*',
          'frn:console:<default>:::risk-scoring/risk-algorithms/*',
          'frn:console:<default>:::risk-scoring/risk-score-details/*',
          'frn:console:<default>:::users/user-details/*',
          'frn:console:<default>:::dashboard/*',
          'frn:console:<default>:::settings/developers/*',
          'frn:console:<default>:::transactions/details/*',
          'frn:console:<default>:::transactions/export/*',
          'frn:console:<default>:::audit-log/*',
          'frn:console:<default>:::lists/export/*',
          'frn:console:<default>:::notifications/*',
        ],
      },
      {
        actions: ['read'],
        resources: [
          'frn:console:<default>:::case-management/case-overview/*',
          'frn:console:<default>:::case-management/case-details/*',
          'frn:console:<default>:::rules/my-rules/*',
          'frn:console:<default>:::risk-scoring/risk-levels/*',
          'frn:console:<default>:::risk-scoring/risk-factors/*',
          'frn:console:<default>:::users/user-overview/*',
          'frn:console:<default>:::settings/system-config/*',
          'frn:console:<default>:::settings/case-management/*',
          'frn:console:<default>:::settings/security/*',
          'frn:console:<default>:::settings/transactions/*',
          'frn:console:<default>:::settings/users/*',
          'frn:console:<default>:::settings/rules/*',
          'frn:console:<default>:::settings/screening/*',
          'frn:console:<default>:::settings/risk-scoring/*',
          'frn:console:<default>:::settings/notifications/*',
          'frn:console:<default>:::settings/add-ons/*',
          'frn:console:<default>:::transactions/overview/*',
          'frn:console:<default>:::lists/whitelist/*',
          'frn:console:<default>:::lists/blacklist/*',
          'frn:console:<default>:::simulator/*',
          'frn:console:<default>:::screening/*',
          'frn:console:<default>:::case-management/case-status/*',
          'frn:console:<default>:::case-management/alert-status/*',
        ],
        filter: STATUS_FILTERS_FULL,
      },
    ],
    description:
      'Developer have unrestricted access to the developer section on the console,  under settings. They have read-only access to all other features.',
  },
]

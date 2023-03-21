import { ManagedRoleName } from '@/@types/openapi-internal/ManagedRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'

export const DEFAULT_ROLES: {
  role: ManagedRoleName
  permissions: Permission[]
  description: string
}[] = [
  {
    role: 'admin',
    permissions: PERMISSIONS, // Admin has all permissions
    description:
      'Admin has unrestricted access to all features, can invite new accounts to console. A tenant can have multiple admins.',
  },
  {
    role: 'auditor',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-details:read',
      'case-management:export:read',
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
      'lists:all:read',
      'lists:all:read',
      'lists:export:read',
      'simulator:rules:read',
      'simulator:risk-scoring:read',
    ],
    description:
      'Auditor has read-only access to Dashboard, Case Management, Rules, Risk Scoring, Audit Log and has access to download information.',
  },
  {
    role: 'analyst',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-overview:write',
      'case-management:case-details:read',
      'case-management:case-details:write',
      'case-management:export:read',
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
    ],
    description:
      'Analyst has unrestricted access to Case management but read-only rights to Audit Log, Rules & Risk Scoring.',
  },
  {
    role: 'approver',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-overview:write',
      'case-management:case-details:read',
      'case-management:case-details:write',
      'case-management:export:read',
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
      'lists:all:read',
      'lists:all:read',
      'lists:export:read',
      'simulator:rules:read',
      'simulator:risk-scoring:read',
      'users:user-overview:read',
      'users:user-details:read',
    ],
    description:
      'Approver has unrestricted access to Case management but read-only rights to Audit Log, Rules & Risk Scoring. Alerts are received when an analyst requires approval to close a case.',
  },
  {
    role: 'developer',
    permissions: [
      'case-management:case-overview:read',
      'case-management:case-details:read',
      'case-management:export:read',
      'rules:my-rules:read',
      'rules:library:read',
      'risk-scoring:risk-levels:read',
      'risk-scoring:risk-factors:read',
      'risk-scoring:risk-algorithms:read',
      'users:user-overview:read',
      'users:user-details:read',
      'dashboard:download-data:read',
      'settings:organisation:read',
      'settings:developers:read',
      'settings:developers:write',
      'transactions:overview:read',
      'transactions:details:read',
      'transactions:export:read',
      'audit-log:export:read',
      'lists:all:read',
      'lists:export:read',
      'simulator:rules:read',
      'simulator:risk-scoring:read',
    ],
    description:
      'Developer has unrestricted access to the ‘Developer’ section found under settings, and read-only access to all other features.',
  },
]

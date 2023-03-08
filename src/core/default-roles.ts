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
      'The following is the default permissions set for the Admin role.',
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
      'The following is the default permissions set for the Auditor role.',
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
      'The following is the default permissions set for the Analyst role.',
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
    ],
    description:
      'The following is the default permissions set for the Approver role.',
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
      'The following is the default permissions set for the Developer role.',
  },
]

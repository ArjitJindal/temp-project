import { ManagedRoleName } from '@/@types/openapi-internal/ManagedRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { convertV1PermissionToV2 } from '@/services/rbac/utils/permissions'

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
      {
        actions: ['read', 'write'],
        resources: ['frn:console:*:::*'], // Permissions for all resources in all tenants
      },
    ],
    description: 'Root role',
    metadata: {
      isRootRole: true,
    },
  },
  {
    role: 'whitelabel-root',
    permissions: [
      {
        actions: ['read', 'write'],
        resources: ['frn:console:*:::*'], // Permissions for all resources in all tenants
      },
    ],
    description: 'Whitelabel root role',
    metadata: {
      isWhitelabelRole: true,
      isRootRole: true,
    },
  },
  {
    role: 'admin',
    permissions: convertV1PermissionToV2(
      '<default>',
      DEFAULT_ROLES.find((role) => role.role === 'admin')?.permissions ?? []
    ),
    description:
      'Admin has unrestricted access to all features. They can invite new accounts to the console, and there can be multiple admins.',
  },
  {
    role: 'auditor',
    permissions: convertV1PermissionToV2(
      '<default>',
      DEFAULT_ROLES.find((role) => role.role === 'auditor')?.permissions ?? []
    ),
    description:
      'Auditor has read-only access to the Dashboard, Case management, Rules, Risk scoring, and Audit log. They also have access to download information.',
  },
  {
    role: 'analyst',
    permissions: convertV1PermissionToV2(
      '<default>',
      DEFAULT_ROLES.find((role) => role.role === 'analyst')?.permissions ?? []
    ),
    description:
      'Analyst has unrestricted access to case management, but only has read-only rights to Audit log, Rules and Risk scoring.',
  },
  {
    role: 'approver',
    permissions: convertV1PermissionToV2(
      '<default>',
      DEFAULT_ROLES.find((role) => role.role === 'approver')?.permissions ?? []
    ),
    description:
      'Approver has unrestricted access to case management but only has read-only rights to Audit log, Rules and Risk scoring. Alerts are received when an analyst requires approval to close a case.',
  },
  {
    role: 'developer',
    permissions: convertV1PermissionToV2(
      '<default>',
      DEFAULT_ROLES.find((role) => role.role === 'developer')?.permissions ?? []
    ),
    description:
      'Developer have unrestricted access to the developer section on the console,  under settings. They have read-only access to all other features.',
  },
]

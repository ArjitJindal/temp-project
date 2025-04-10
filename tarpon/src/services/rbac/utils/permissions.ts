import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionsResponse } from '@/@types/openapi-internal/PermissionsResponse'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { Permissions, PermissionsNode } from '@/@types/rbac/permissions'

export const PERMISSIONS_LIBRARY: Permissions = [
  {
    id: 'case-management',
    name: 'Case management',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'case-overview',
        name: 'Case overview',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'case-details',
        name: 'Case details',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'case-reopen',
        name: 'Case reopen',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'export',
        name: 'Export',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'case-assignment',
        name: 'Case assignment',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'qa',
        name: 'QA',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'rules',
    name: 'Rules',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'my-rules',
        name: 'My rules',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'library',
        name: 'Library',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    actions: ['read'],
    type: 'STATIC',
    children: [
      {
        id: 'download-data',
        name: 'Download data',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'risk-scoring',
    name: 'Risk scoring',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'risk-levels',
        name: 'Risk levels',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'risk-factors',
        name: 'Risk factors',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'risk-algorithms',
        name: 'Risk algorithms',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'risk-score-details',
        name: 'Risk score details',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'users',
    name: 'Users',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'user-overview',
        name: 'User overview',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'user-comments',
        name: 'User comments',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'user-details',
        name: 'User details',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'user-pep-status',
        name: 'User PEP status',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'user-tags',
        name: 'User tags',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'user-manual-risk-levels',
        name: 'User manual risk levels',
        actions: ['write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'system-config',
        name: 'System config',
        actions: ['read', 'write'],
        type: 'STATIC',
        children: [
          {
            id: 'default-values',
            name: 'Default values',
            actions: ['read', 'write'],
            type: 'STATIC',
            children: [
              {
                id: 'currency',
                name: 'Currency',
                actions: ['read', 'write'],
                type: 'STATIC',
              },
              {
                id: 'timezone',
                name: 'Timezone',
                actions: ['read', 'write'],
                type: 'STATIC',
              },
            ],
          },
          {
            id: 'production-access-control',
            name: 'Production access control',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
        ],
      },
      {
        id: 'security',
        name: 'Security',
        actions: ['read', 'write'],
        type: 'STATIC',
        children: [
          {
            id: 'mfa',
            name: 'MFA',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'password-expiration',
            name: 'Password expiration policy',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'account-dormancy',
            name: 'Account dormancy period',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'session-timeout',
            name: 'Session timeout',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'concurrent-sessions',
            name: 'Max concurrent sessions',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'brute-force',
            name: 'Brute force protection',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
        ],
      },
      {
        id: 'case-management',
        name: 'Case management',
        actions: ['read', 'write'],
        type: 'STATIC',
        children: [
          {
            id: 'narrative-templates',
            name: 'Narrative templates',
            actions: ['read', 'write'],
            type: 'STATIC',
            children: [
              {
                id: 'narrative-template-1',
                actions: ['read', 'write'],
                type: 'DYNAMIC',
                subType: 'NARRATIVE_TEMPLATES',
              },
            ],
          },
        ],
      },
      {
        id: 'transactions',
        name: 'Transactions',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'users',
        name: 'Users',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'rules',
        name: 'Rules',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'risk-scoring',
        name: 'Risk scoring',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'notifications',
        name: 'Notifications',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'screening',
        name: 'Screening',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'add-ons',
        name: 'Add-ons',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'developers',
        name: 'Developers',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'transactions',
    name: 'Transactions',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'overview',
        name: 'Overview',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'details',
        name: 'Details',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'export',
        name: 'Export',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'audit-log',
    name: 'Audit log',
    actions: ['read'],
    type: 'STATIC',
    children: [
      {
        id: 'export',
        name: 'Export',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'lists',
    name: 'Lists',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'all',
        name: 'All',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'whitelist',
        name: 'Whitelist',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'blacklist',
        name: 'Blacklist',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'export',
        name: 'Export',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'simulator',
    name: 'Simulator',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'simulations',
        name: 'Simulations',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'schema',
        name: 'Schema',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'generated',
        name: 'Generated',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'narrative',
        name: 'Narrative',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'all',
        name: 'All',
        actions: ['read'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'accounts',
    name: 'Accounts',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'overview',
        name: 'Overview',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'roles',
    name: 'Roles',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'overview',
        name: 'Overview',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'screening',
    name: 'Screening',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'search-profiles',
        name: 'Search profiles',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
]

export const hydratePermissions = (
  permissions: Permissions
): PermissionsResponse['permissions'] => {
  return permissions.map(traverseNode)
}

const traverseNode = (node: PermissionsNode) => {
  if (node.type === 'DYNAMIC') {
    delete node.validator
    delete node.queryGenerator
    delete node.fetcher
  }

  if (node.children) {
    node.children.forEach(traverseNode)
  }

  return node
}

export const convertV1PermissionToV2 = (
  tenantId: string,
  permissionsToConvert: Permission[]
): PermissionStatements[] => {
  const allReadPermissions = new Set<string>()
  const allWritePermissions = new Set<string>()

  for (const perm of PERMISSIONS) {
    const [first, second, action] = perm.split(':')
    const resource = `${first}:${second}`
    if (action === 'read') {
      allReadPermissions.add(resource)
    }
    if (action === 'write') {
      allWritePermissions.add(resource)
    }
  }

  const currentRead = new Set<string>()
  const currentWrite = new Set<string>()

  for (const perm of permissionsToConvert) {
    const [first, second, action] = perm.split(':')
    const resource = `${first}:${second}`
    if (action === 'read') {
      currentRead.add(resource)
    }
    if (action === 'write') {
      currentWrite.add(resource)
    }
  }

  const readOnly = new Set<string>()
  const readWrite = new Set<string>()

  const uniqueResources = new Set(
    permissionsToConvert.map((perm) => {
      const [first, second] = perm.split(':')
      return `${first}:${second}`
    })
  )

  for (const resource of uniqueResources) {
    const [first, second] = resource.split(':')
    const frn = `frn:console:${tenantId}:::${first}/${second}/*`

    if (
      !allReadPermissions.has(resource) &&
      !allWritePermissions.has(resource)
    ) {
      throw new Error(
        `Resource ${resource} not found in allReadPermissions or allWritePermissions`
      )
    }

    const hasRead = currentRead.has(resource)
    const hasWrite = currentWrite.has(resource)
    const eligibleRead = allReadPermissions.has(resource)
    const eligibleWrite = allWritePermissions.has(resource)

    if (hasRead && !hasWrite && eligibleRead && eligibleWrite) {
      readOnly.add(frn)
    } else {
      readWrite.add(frn)
    }
  }

  return [
    { actions: ['read', 'write'], resources: Array.from(readWrite) },
    { actions: ['read'], resources: Array.from(readOnly) },
  ]
}

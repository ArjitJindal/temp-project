import { compact } from 'lodash'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionsAction } from '@/@types/openapi-internal/PermissionsAction'
import { PermissionsResponse } from '@/@types/openapi-internal/PermissionsResponse'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { Permissions, PermissionsNode } from '@/@types/rbac/permissions'
import { generateChecksum } from '@/utils/object'
import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'

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
        name: 'Templates',
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
      {
        id: 'batch-rerun-risk-scoring-settings',
        name: 'Batch rerun risk scoring settings',
        actions: ['read', 'write'],
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
                id: 'template',
                actions: ['read', 'write'],
                type: 'DYNAMIC',
                subType: 'NARRATIVE_TEMPLATES',
              },
            ],
          },
          {
            id: 'checklist-templates',
            name: 'Checklist templates',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'rule-queues',
            name: 'Rule queues',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'sla-policy',
            name: 'SLA policy',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'ai-sources',
            name: 'AI sources',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'narrative-copilot',
            name: 'Narrative copilot',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'closure-reasons',
            name: 'Closure reasons',
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
            id: 'payment-approval',
            name: 'Payment approval',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'transaction-state-aliases',
            name: 'Transaction state aliases',
            actions: ['read', 'write'],
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
            id: 'kyc-user-status-lock',
            name: 'KYC/User status lock',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'pep-status-lock',
            name: 'PEP status lock',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'tag-lock',
            name: 'Tags',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'user-alias',
            name: 'User alias',
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
            id: 'rule-action-alias',
            name: 'Rule action alias',
            actions: ['read', 'write'],
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
            id: 'risk-algorithms',
            name: 'Risk algorithms',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'risk-scoring-cra',
            name: 'Risk scoring CRA',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'risk-algorithms-cra',
            name: 'Risk algorithms for CRA',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'rerun-trigger-settings',
            name: 'Rerun trigger settings',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'risk-levels-alias',
            name: 'Risk levels alias',
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
            id: 'slack-notifications',
            name: 'Slack notifications',
            actions: ['write'],
            type: 'STATIC',
          },
          {
            id: 'email-notifications',
            name: 'Email notifications',
            actions: ['write'],
            type: 'STATIC',
          },
          {
            id: 'notification-settings',
            name: 'Notification settings',
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
          {
            id: 'screening-profiles',
            name: 'Screening profiles',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'screening-profile-default-filters',
            name: 'Screening profile default filters',
            actions: ['write'],
            type: 'STATIC',
          },
          {
            id: 'screening-settings',
            name: 'Screening settings',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'screening-sources',
            name: 'Screening sources',
            actions: ['write'],
            type: 'STATIC',
          },
        ],
      },
      {
        id: 'add-ons',
        name: 'Add-ons',
        actions: ['read', 'write'],
        type: 'STATIC',
        children: [
          {
            id: 'ai-features',
            name: 'AI features',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'ai-detections',
            name: 'AI detections',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'crm-integrations',
            name: 'CRM integrations',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
        ],
      },
      {
        id: 'developers',
        name: 'Developers',
        actions: ['read', 'write'],
        type: 'STATIC',
        children: [
          {
            id: 'api-keys',
            name: 'API keys',
            actions: ['read'],
            type: 'STATIC',
          },
          {
            id: 'quotas',
            name: 'Quotas',
            actions: ['read'],
            type: 'STATIC',
          },
          {
            id: 'webhook-settings',
            name: 'Webhook settings',
            actions: ['read', 'write'],
            type: 'STATIC',
          },
          {
            id: 'webhooks-configurations',
            name: 'Webhooks configurations',
            actions: ['read', 'write'],
            type: 'STATIC',
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
      {
        id: 'screening-profiles',
        name: 'Screening profiles',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
    ],
  },
  {
    id: 'sanctions',
    name: 'Sanctions',
    actions: ['read', 'write'],
    type: 'STATIC',
    children: [
      {
        id: 'search',
        name: 'Search',
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
  if (node.children) {
    node.children.forEach(traverseNode)
  }

  return node
}

export const isValidResource = (
  resource: string,
  action: PermissionsAction[]
) => {
  const pathParts = resource.split('/')
  const currentActions = action

  const validateNode = (
    node: PermissionsNode | undefined,
    templateId?: string
  ) => {
    if (!node) {
      return false
    }

    if (node.type === 'DYNAMIC' && !templateId) {
      return false
    }

    if (node.type !== (templateId ? 'DYNAMIC' : 'STATIC')) {
      return false
    }

    const hasAllActions = node.actions.every((action) =>
      currentActions.includes(action)
    )

    if (hasAllActions) {
      return true
    }

    return node.actions.some((action) => currentActions.includes(action))
  }

  const validatePath = (pathParts: string[], libraryChildren: Permissions) => {
    if (pathParts.length === 0) {
      return true
    }

    const [first, ...rest] = pathParts
    if (first === '*') {
      return true
    }

    let currentNode: PermissionsNode | undefined
    let templateId: string | undefined

    if (first.includes(':')) {
      const [resourceId, template] = first.split(':')
      currentNode = libraryChildren.find((child) => child.id === resourceId)
      templateId = template
    } else {
      currentNode = libraryChildren.find((child) => child.id === first)
    }

    if (!validateNode(currentNode, templateId)) {
      return false
    }

    return validatePath(rest, currentNode?.children || [])
  }

  return validatePath(pathParts, PERMISSIONS_LIBRARY)
}

export const isPermissionValidFromTree = (data: {
  tenantId: string
  permission: string
  action: PermissionsAction[]
}) => {
  const { tenantId, permission, action } = data
  const [prefix, permissionPath] = permission.split(':::')

  const splitPrefix = prefix.split(':')

  // first part of prefix should be frn
  if (splitPrefix[0] !== 'frn') {
    return false
  }

  // second part of prefix should be console right now we hard code it
  if (splitPrefix[1] !== 'console' && splitPrefix[1] !== '*') {
    return false
  }

  // third part of prefix should be tenantId
  if (splitPrefix[2] !== tenantId && splitPrefix[2] !== '*') {
    return false
  }

  return isValidResource(permissionPath, action)
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
      const isPermissionValid = isPermissionValidFromTree({
        tenantId,
        permission: frn,
        action: ['read'],
      })

      if (!isPermissionValid) {
        throw new Error(
          `Resource ${frn} is valid for read but not valid from tree`
        )
      }

      readOnly.add(frn)
    } else {
      const isPermissionValid = isPermissionValidFromTree({
        tenantId,
        permission: frn,
        action: ['read', 'write'],
      })

      if (!isPermissionValid) {
        throw new Error(
          `Resource ${frn} is valid for read but not valid from tree`
        )
      }

      readWrite.add(frn)
    }
  }

  const optimized = getOptimizedPermissions(tenantId, [
    { actions: ['read', 'write'], resources: Array.from(readWrite) },
    { actions: ['read'], resources: Array.from(readOnly) },
  ])

  return optimized
}

type Resource = {
  id: string
  children?: Resource[]
  items?: string[]
}

const parsePath = (resource: string): string[] => {
  return compact(resource.replace(/^frn:console:[^:]*:::/, '').split('/'))
}

const buildGrantedTree = (resources: string[]): Resource[] => {
  const root: Resource = { id: 'root', children: [] }

  for (const path of resources) {
    const parts = parsePath(path)
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (part === '*' && i === parts.length - 1) {
        break
      }

      if (!current.children) {
        current.children = []
      }

      if (part.includes(':')) {
        const [id, resource] = part.split(':')
        let next = current.children.find((child) => child.id === id)
        if (!next) {
          next = { id, items: [] }
          current.children.push(next)
        }
        if (!next.items) {
          next.items = []
        }
        if (!next.items.includes(resource)) {
          next.items.push(resource)
        }
        current = next
        continue
      }

      let next = current.children.find((child) => child.id === part)
      if (!next) {
        next = { id: part }
        if (parts[i + 1] !== '*') {
          next.children = []
        }
        current.children.push(next)
      }
      current = next
    }
  }

  return root.children ?? []
}

export const convertToFrns = (
  tenantId: string,
  permissions: Resource[] | string,
  base = `frn:console:${tenantId}:::`,
  parentPath: string[] = []
): string[] => {
  if (typeof permissions === 'string') {
    return [permissions]
  }

  const frns: string[] = []

  for (const node of permissions) {
    const path = [...parentPath, node.id]

    if (!node.children || node.children.length === 0) {
      if (node.items) {
        node.items.forEach((item) => {
          frns.push(`${base}${path.join('/')}:${item}/*`)
        })
      } else {
        frns.push(`${base}${path.join('/')}` + '/*')
      }
    } else {
      const childFrns = convertToFrns(tenantId, node.children, base, path)
      frns.push(...childFrns)
    }
  }

  return frns
}

export const getOptimizedPermissions = (
  tenantId: string,
  resources: PermissionStatements[]
): PermissionStatements[] => {
  const actionMap = new Map<
    string,
    { actions: PermissionsAction[]; resources: Set<string> }
  >()
  const optimizedPermissions: PermissionStatements[] = []

  // Group resources by action hash and handle wildcards
  resources.forEach((statement) => {
    const actionHash = generateChecksum(statement.actions)
    const hasWildcard = statement.resources.some((resource) =>
      resource.endsWith(':::*')
    )

    if (!actionMap.has(actionHash)) {
      actionMap.set(actionHash, {
        actions: statement.actions,
        resources: new Set(
          hasWildcard ? [`frn:console:${tenantId}:::*`] : statement.resources
        ),
      })
    } else if (!hasWildcard) {
      statement.resources.forEach((resource) =>
        actionMap.get(actionHash)?.resources.add(resource)
      )
    }
  })

  // Process each action group
  for (const { actions, resources } of actionMap.values()) {
    if (resources.has(`frn:console:${tenantId}:::*`)) {
      optimizedPermissions.push({
        actions,
        resources: [`frn:console:${tenantId}:::*`],
      })
      continue
    }

    const grantedTree = buildGrantedTree(Array.from(resources))
    if (!grantedTree.length) {
      continue
    }

    const { optimized } = optimizePermissions(grantedTree, PERMISSIONS_LIBRARY)
    const noChildrenInAll = optimized.every((node) => !node.children?.length)

    if (noChildrenInAll) {
      const allFirstLevelResources = new Set(
        PERMISSIONS_LIBRARY.map((node) => node.id)
      )
      const optimizedFirstLevel = new Set(optimized.map((node) => node.id))

      if (
        Array.from(allFirstLevelResources).every((node) =>
          optimizedFirstLevel.has(node)
        )
      ) {
        optimizedPermissions.push({
          actions,
          resources: [`frn:console:${tenantId}:::*`],
        })
        continue
      }
    }

    optimizedPermissions.push({
      actions,
      resources: convertToFrns(tenantId, optimized),
    })
  }

  return optimizedPermissions
}

export const optimizePermissions = (
  grantedTree: Resource[],
  permissionLib: PermissionsNode[]
): { optimized: Resource[]; skipped: boolean } => {
  const optimized: Resource[] = []
  let skipped = false

  for (const node of grantedTree) {
    const libNode = permissionLib.find((n) => n.id === node.id)
    if (!libNode) {
      continue
    }
    if (node.items) {
      skipped = true
      optimized.push({
        id: node.id,
        items: node.items,
      })
      continue
    }

    if (!libNode.children || !node.children) {
      optimized.push({ id: node.id })
      continue
    }

    const { optimized: optimizedChildren, skipped: skippedChildren } =
      optimizePermissions(node.children, libNode.children)

    skipped = skipped || skippedChildren
    if (Array.isArray(optimizedChildren)) {
      const checkAllIdsExists = libNode.children.every((child) =>
        optimizedChildren.some(
          (optimizedChild) =>
            optimizedChild.id === child.id && !optimizedChild.items?.length
        )
      )
      if (checkAllIdsExists && !skippedChildren) {
        optimized.push({ id: node.id })
      } else if (optimizedChildren.length > 0) {
        optimized.push({
          id: node.id,
          children: optimizedChildren,
        })
      }
    } else {
      optimized.push({ id: node.id })
    }
  }

  return { optimized, skipped }
}

export const getDynamicPermissionsType = (
  statements: string[]
): { subType: DynamicPermissionsNodeSubType; ids: string[] }[] => {
  const uniqueIdsDynamic = new Map<string, Set<string>>()

  statements.forEach((statement) => {
    const [_, requiredResourcePath] = statement.split(':::')
    const pathParts = requiredResourcePath.split('/')

    pathParts.forEach((part) => {
      if (part.includes(':')) {
        const [id, resource] = part.split(':')
        if (!uniqueIdsDynamic.has(id)) {
          uniqueIdsDynamic.set(id, new Set([resource])) // Fix: Pass array to Set constructor
        } else {
          uniqueIdsDynamic.get(id)?.add(resource)
        }
      }
    })
  })

  const data: { subType: DynamicPermissionsNodeSubType; ids: string[] }[] = []

  const traverseNode = (node: PermissionsNode) => {
    if (node.type === 'DYNAMIC' && uniqueIdsDynamic.has(node.id)) {
      data.push({
        subType: node.subType,
        ids: Array.from(uniqueIdsDynamic.get(node.id) || []),
      })
    }

    if (node.children) {
      node.children.forEach(traverseNode)
    }
  }

  for (const libNode of PERMISSIONS_LIBRARY) {
    traverseNode(libNode)
  }

  return data
}

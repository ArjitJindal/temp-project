import compact from 'lodash/compact'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionsAction } from '@/@types/openapi-internal/PermissionsAction'
import { PermissionsResponse } from '@/@types/openapi-internal/PermissionsResponse'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { FilterCondition } from '@/@types/openapi-internal/FilterCondition'
import { Permissions, PermissionsNode } from '@/@types/rbac/permissions'
import { generateChecksum } from '@/utils/object'
import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'
import {
  StaticPermissionsNode as OpenAPIStaticNode,
  StaticPermissionsNode,
} from '@/@types/openapi-internal/StaticPermissionsNode'
import { DynamicPermissionsNode as OpenAPIDynamicNode } from '@/@types/openapi-internal/DynamicPermissionsNode'

/**
 * PERMISSIONS_LIBRARY overview
 *
 * The library is a tree of permissions organized by node `id`. This hierarchy mirrors the
 * FRN resource paths (part after ':::'). For example, an FRN like:
 *   frn:console:tenant:::case-management/alert-status/open/*
 * maps to library nodes with ids:
 *   "case-management" -> "alert-status" -> "open"
 *
 * Filterable nodes:
 * - A node can define a `filter` with `param` (query param name) and optional `operators`.
 * - Example: node id "case-status" has filter { param: 'filterCaseStatus' }.
 * - When a route requires resources under such a node, the middleware can derive the relevant
 *   filter param for that route (see rbac.ts) and inject default values when appropriate.
 *
 * allowedValues on children (optional, UI-friendly):
 * - Child nodes may declare `allowedValues` to indicate what enum values should be infused
 *   into a filter condition when this child is granted (e.g. child id 'in-review' expands to
 *   ['IN_REVIEW_OPEN','IN_REVIEW_ESCALATED',...]).
 * - If `allowedValues` is absent, we fallback to a normalized child id (e.g. 'open' -> 'OPEN').
 */

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
      {
        id: 'case-status',
        name: 'Case status',
        actions: ['read'],
        type: 'STATIC',
        filter: {
          type: 'enum',
          param: 'filterCaseStatus',
          operators: 'Equals',
        },
        children: [
          {
            id: 'open',
            name: 'Case status: Open',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN'],
          },
          {
            id: 'closed',
            name: 'Case status: Closed',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['CLOSED'],
          },
          {
            id: 'reopened',
            name: 'Case status: Reopened',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['REOPENED'],
          },
          {
            id: 'escalated',
            name: 'Case status: Escalated',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['ESCALATED'],
          },
          {
            id: 'in-review',
            name: 'Case status: In review',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: [
              'IN_REVIEW_OPEN',
              'IN_REVIEW_ESCALATED',
              'IN_REVIEW_CLOSED',
              'IN_REVIEW_REOPENED',
            ],
          },
          {
            id: 'in-progress',
            name: 'Case status: In progress',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
          },
          {
            id: 'on-hold',
            name: 'Case status: On hold',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'],
          },
          {
            id: 'escalated-l2',
            name: 'Case status: Escalated L2',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['ESCALATED_L2'],
          },
        ],
      } as StaticPermissionsNode,
      {
        id: 'alert-status',
        name: 'Alert status',
        actions: ['read'],
        type: 'STATIC',
        filter: {
          type: 'enum',
          param: 'filterAlertStatus',
          operator: 'Equals',
        },
        children: [
          {
            id: 'open',
            name: 'Alert status: Open',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN'],
          },
          {
            id: 'closed',
            name: 'Alert status: Closed',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['CLOSED'],
          },
          {
            id: 'reopened',
            name: 'Alert status: Reopened',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['REOPENED'],
          },
          {
            id: 'escalated',
            name: 'Alert status: Escalated',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['ESCALATED'],
          },
          {
            id: 'in-review',
            name: 'Alert status: In review',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: [
              'IN_REVIEW_OPEN',
              'IN_REVIEW_ESCALATED',
              'IN_REVIEW_CLOSED',
              'IN_REVIEW_REOPENED',
            ],
          },
          {
            id: 'in-review-escalated',
            name: 'Alert status: In review escalated',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
          },
          {
            id: 'in-progress',
            name: 'Alert status: In progress',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
          },
          {
            id: 'on-hold',
            name: 'Alert status: On hold',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'],
          },
          {
            id: 'escalated-l2',
            name: 'Alert status: Escalated L2',
            actions: ['read'],
            type: 'STATIC',
            allowedValues: ['ESCALATED_L2'],
          },
        ],
      } as PermissionsNode,
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
      {
        id: 'ai-models',
        name: 'AI models',
        actions: ['read', 'write'],
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
      {
        id: 'manual-screening-filters',
        name: 'Manual screening filters',
        actions: ['write'],
        type: 'STATIC',
      },
      {
        id: 'manual-screening',
        name: 'Manual screening',
        actions: ['read', 'write'],
        type: 'STATIC',
      },
      {
        id: 'activity',
        name: 'Screening activity',
        actions: ['read'],
        type: 'STATIC',
      },
      {
        id: 'whitelist',
        name: 'Screening whitelist',
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
] as any

export const hydratePermissions = (
  permissions: Permissions
): PermissionsResponse['permissions'] => {
  return permissions.map(traverseNode)
}

const traverseNode = (
  node: PermissionsNode
): OpenAPIStaticNode | OpenAPIDynamicNode => {
  const baseNode = {
    id: node.id,
    actions: node.actions,
    children: node.children?.map(traverseNode),
  }

  if (node.type === 'STATIC') {
    return {
      ...baseNode,
      type: 'STATIC',
      name: node.name || node.id, // Use id as name if name is not provided
      filter: node.filter,
    } as OpenAPIStaticNode
  } else {
    return {
      ...baseNode,
      type: 'DYNAMIC',
      subType: node.subType,
    } as OpenAPIDynamicNode
  }
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

/**
 * Resolves the allowed values for a specific child of a filterable static node.
 * @param staticNode - The static permissions node.
 * @param childId - The ID of the child node.
 * @returns An array of allowed values.
 */
const resolveChildValues = (
  staticNode: StaticPermissionsNode,
  childId: string
): string[] => {
  const child = staticNode.children?.find((c) => c.id === childId)
  const allowed =
    child && child.type === 'STATIC'
      ? (child as StaticPermissionsNode).allowedValues
      : undefined
  return allowed && allowed.length > 0
    ? allowed
    : [childId.toUpperCase().replace(/-/g, '_')]
}

/**
 * Resolves all allowed values for all children of a filterable static node.
 * This is used for wildcard grants.
 * @param staticNode - The static permissions node.
 * @returns An array of all allowed values for the children.
 */
const resolveAllChildValues = (staticNode: StaticPermissionsNode): string[] => {
  const set = new Set<string>()
  staticNode.children?.forEach((c) => {
    if (c.type === 'STATIC') {
      const s = c as StaticPermissionsNode
      if (s.allowedValues && s.allowedValues.length > 0) {
        s.allowedValues.forEach((v) => set.add(v))
      } else {
        set.add(c.id.toUpperCase().replace(/-/g, '_'))
      }
    }
  })
  return Array.from(set)
}

/**
 * Merges values into the filter conditions for a given permission ID.
 * If a filter for the permission ID already exists, the new values are added to it.
 * Otherwise, a new filter condition is created.
 * @param filters - The array of filter conditions.
 * @param staticNode - The static permissions node containing filter information.
 * @param values - The values to merge.
 */
const mergeFilterValues = (
  filters: FilterCondition[],
  staticNode: StaticPermissionsNode,
  values: string[]
) => {
  const existing = filters.find((f) => f.permissionId === staticNode.id)
  if (existing) {
    const s = new Set(existing.values)
    values.forEach((v) => s.add(v))
    existing.values = Array.from(s)
    return
  }
  filters.push({
    permissionId: staticNode.id,
    operator: staticNode.filter?.operator || 'Equals',
    param: staticNode.filter?.param || '',
    values,
  })
}

/**
 * Builds filter conditions from a list of resource paths.
 * It parses resource paths to identify filterable nodes and extracts the corresponding values.
 * @param tenantId - The tenant ID.
 * @param resourcePaths - An array of resource paths (FRNs).
 * @returns An array of filter conditions.
 */
const buildFiltersFromResources = (
  tenantId: string,
  resourcePaths: string[]
): FilterCondition[] => {
  const filters: FilterCondition[] = []
  for (const r of resourcePaths) {
    const path = r.replace(`frn:console:${tenantId}:::`, '')
    const parts = path.split('/')
    const isWildcard = parts[parts.length - 1] === '*'

    // Handle specific child paths (e.g. case-status/open/*)
    if (isWildcard && parts.length > 2) {
      const childId = parts[parts.length - 2] // Get specific status (e.g. 'open')
      const parentPath = parts.slice(0, -2).join('/') // Get parent path (e.g. 'case-management/case-status')
      const parentNode = getPermissionsNodeByPath(parentPath)

      if (parentNode?.type === 'STATIC') {
        const staticNode = parentNode as StaticPermissionsNode
        if (staticNode.filter) {
          const values = resolveChildValues(staticNode, childId)
          mergeFilterValues(filters, staticNode, values)
          continue
        }
      }
    }

    // Handle wildcard paths (e.g. case-status/*)
    if (isWildcard) {
      const wildcardNodePath = parts.slice(0, -1).join('/')
      const wildcardNode = getPermissionsNodeByPath(wildcardNodePath)
      if (wildcardNode?.type === 'STATIC') {
        const staticNode = wildcardNode as StaticPermissionsNode
        if (staticNode.filter) {
          const values = resolveAllChildValues(staticNode)
          mergeFilterValues(filters, staticNode, values)
          continue
        }
      }
    }
  }
  return filters
}

type PermissionGroup = {
  actions: PermissionsAction[]
  resources: Set<string>
  filters: FilterCondition[]
}

/**
 * Groups permission statements by their action hash.
 * This allows processing all statements with the same actions together.
 * Wildcard resources (`*`) are handled specially to consolidate permissions.
 * @param tenantId - The tenant ID.
 * @param statements - An array of permission statements.
 * @returns A map of action hashes to permission groups.
 */
const groupStatementsByAction = (
  tenantId: string,
  statements: PermissionStatements[]
): Map<string, PermissionGroup> => {
  const actionMap = new Map<string, PermissionGroup>()

  statements.forEach((statement) => {
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
        filters: statement.filter || [],
      })
    } else if (!hasWildcard) {
      const entry = actionMap.get(actionHash)
      if (entry) {
        statement.resources.forEach((resource) => entry.resources.add(resource))
        if (statement.filter) {
          entry.filters.push(...statement.filter)
        }
      }
    }
  })

  return actionMap
}

/**
 * Processes a single group of permissions with the same actions.
 * It optimizes the resources to their most compact form and ensures that
 * the filter conditions are consistent with the final set of resources.
 * @param tenantId - The tenant ID.
 * @param group - The permission group to process.
 * @returns An optimized permission statement.
 */
const processPermissionGroup = (
  tenantId: string,
  group: PermissionGroup
): PermissionStatements => {
  const { actions, resources, filters } = group
  const resourceArray = Array.from(resources)

  if (resourceArray.includes(`frn:console:${tenantId}:::*`)) {
    return {
      actions,
      resources: [`frn:console:${tenantId}:::*`],
      filter: filters.length > 0 ? filters : undefined,
    }
  }

  const grantedTree = buildGrantedTree(resourceArray)
  const { optimized } = optimizePermissions(grantedTree, PERMISSIONS_LIBRARY)
  const finalResources = convertToFrns(tenantId, optimized)

  const resourceFilters = buildFiltersFromResources(tenantId, finalResources)
  const resourceFilterIds = new Set(resourceFilters.map((f) => f.permissionId))
  const otherFilters = filters.filter(
    (f) => !resourceFilterIds.has(f.permissionId)
  )
  const finalFilters = [...resourceFilters, ...otherFilters]

  return {
    actions,
    resources: finalResources,
    filter: finalFilters.length > 0 ? finalFilters : undefined,
  }
}

/**
 * Optimizes a list of permission statements.
 *
 * This function performs several key optimizations:
 * 1.  **Grouping by Action**: It groups statements that have the same set of actions to reduce redundancy.
 * 2.  **Resource Consolidation**: It takes the resources within each group and optimizes them into the most compact representation (e.g., collapsing specific resource grants into a wildcard if possible).
 * 3.  **Filter Synchronization**: It ensures that the filter conditions attached to the statements are consistent with the final, optimized set of resources. Any filters that are no longer relevant after resource optimization are removed.
 *
 * This process results in a minimal and consistent set of permission statements that are easier to manage and evaluate.
 *
 * @param tenantId - The tenant ID.
 * @param statements - An array of permission statements to be optimized.
 * @returns An array of optimized permission statements.
 */
export const getOptimizedPermissions = (
  tenantId: string,
  statements: PermissionStatements[]
): PermissionStatements[] => {
  const actionMap = groupStatementsByAction(tenantId, statements)

  const optimizedPermissions: PermissionStatements[] = []
  for (const group of actionMap.values()) {
    optimizedPermissions.push(processPermissionGroup(tenantId, group))
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

// Resolve a permissions node from PERMISSIONS_LIBRARY by a slash-delimited path (e.g., "case-management/case-status")
const getPermissionsNodeByPath = (
  path: string
): PermissionsNode | undefined => {
  if (!permissionsPathMap) {
    createPermissionsPathMap()
  }
  return permissionsPathMap?.get(path)
}

let permissionsPathMap: Map<string, PermissionsNode> | undefined

const createPermissionsPathMap = (): Map<string, PermissionsNode> => {
  if (permissionsPathMap) {
    return permissionsPathMap
  }

  const map = new Map<string, PermissionsNode>()
  const traverse = (nodes: PermissionsNode[], path: string) => {
    for (const node of nodes) {
      const currentPath = path ? `${path}/${node.id}` : node.id
      map.set(currentPath, node)
      if (node.children) {
        traverse(node.children, currentPath)
      }
    }
  }

  traverse(PERMISSIONS_LIBRARY, '')
  permissionsPathMap = map
  return permissionsPathMap
}

// Initialize the map on startup
createPermissionsPathMap()

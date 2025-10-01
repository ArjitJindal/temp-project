/**
 * Should be in format `read::case-management/case-details/*`
 * If requiredPermission is case-management/case-details/*, and user has already * or case-management/* then return true
 * Example permissions is
 * {
 *   "statements": [
 *     {
 *       "actions": ["read", "write"],
 *       "resources": ["frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template/*",
 *                     "frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template-2/*"
 *       ]
 *     }
 *   ]
 * }
 *
 * or
 * {
 *   "statements": [
 *     {
 *       "actions": ["read"],
 *       "resources": ["frn:console:test-tenant:::case-management/narrative-templates/*"]
 *     }
 *   ]
 * }
 *
 */

type PermissionsAction = 'read' | 'write'

export type Resource = `${PermissionsAction}:::${string}/*`

type PermissionStatements = {
  actions: PermissionsAction[]
  resources: string[]
}

export function hasResources(
  statements: PermissionStatements[],
  requiredResources: Resource[]
): boolean {
  if (requiredResources.length === 0) {
    return true
  }

  for (const requiredStatement of requiredResources) {
    const [requiredAction, requiredResource] = requiredStatement.split(':::')

    if (!requiredAction || !requiredResource) {
      return false
    }

    if (requiredAction !== 'read' && requiredAction !== 'write') {
      return false
    }

    // Check if any statement grants the required permission
    const hasPermission = statements.some((statement) => {
      // Check if the statement includes the required action
      const hasAction = statement.actions.includes(
        requiredAction as 'read' | 'write'
      )

      // Check if any resource in the statement matches or is more permissive than the required resource
      const hasResource = statement.resources.some((resource) => {
        // Remove tenant-specific prefix for comparison
        const splitResource = resource.split(':::')

        if (splitResource.length !== 2) {
          return false
        }

        const normalizedResource = splitResource.pop()

        if (!normalizedResource) {
          return false
        }

        const normalizedRequiredResource = requiredResource

        // Check for exact match or wildcard match
        return (
          normalizedResource === normalizedRequiredResource ||
          normalizedResource === '*' ||
          (normalizedResource.endsWith('/*') &&
            normalizedRequiredResource.startsWith(
              normalizedResource.slice(0, -1)
            ))
        )
      })

      return hasAction && hasResource
    })

    if (!hasPermission) {
      return false
    }
  }

  return true
}

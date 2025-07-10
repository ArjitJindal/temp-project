import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { stageAndRegion } from '@flagright/lib/utils'
import { DEFAULT_ROLES_V2 } from '@/core/default-roles'
import { DynamoRolesRepository } from '@/services/roles/repository/dynamo'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getAuth0Domain } from '@/utils/auth0-utils'
import { getRoleDisplayName } from '@/services/roles/utils'

export const syncPermissions = async () => {
  const [stage, region] = stageAndRegion()
  const allAuth0Domains = getAuth0TenantConfigs(
    stage as Stage,
    region as FlagrightRegion
  )
  const dynamoDb = getDynamoDbClient()
  for (const tenantConfig of allAuth0Domains) {
    const rolesRepository = new DynamoRolesRepository(
      getAuth0Domain(tenantConfig.tenantName, tenantConfig.region),
      dynamoDb
    )
    const tenantRoles = await rolesRepository.getTenantRoles('default', true)

    await Promise.all(
      DEFAULT_ROLES_V2.map(async (defaultRole) => {
        const role = tenantRoles.find(
          (r) => getRoleDisplayName(r.name) === defaultRole.role
        )
        if (!role) {
          throw new Error(`Role ${defaultRole.role} not found`)
        }
        await rolesRepository.createRole(`<default>`, {
          type: 'DATABASE',
          params: {
            ...role,
            description: defaultRole.description,
            permissions: [],
            statements:
              DEFAULT_ROLES_V2.find((r) => r.role === defaultRole.role)
                ?.permissions ?? [],
          },
        })
        return role
      })
    )
  }
}

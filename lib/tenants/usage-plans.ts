import {
  APIGatewayClient,
  GetUsagePlanKeysCommand,
  GetUsagePlansCommand,
  UsagePlan,
} from '@aws-sdk/client-api-gateway'

export const USAGE_PLAN_REGEX = /tarpon:(.*):(.*)/

export function getTenantIdFromUsagePlanName(
  usagePlanName: string
): string | null {
  const matches = usagePlanName.match(USAGE_PLAN_REGEX)
  return matches?.[1] || null
}

export const getAllUsagePlans = async (
  region: string
): Promise<UsagePlan[]> => {
  const apigateway = new APIGatewayClient({
    region,
  })
  let position: string | undefined
  let usagePlans: UsagePlan[] = []
  do {
    const usagePlansCommand = new GetUsagePlansCommand({
      limit: 500,
      position,
    })
    const retrivedPlans = await apigateway.send(usagePlansCommand)
    position = retrivedPlans.position
    usagePlans = usagePlans?.concat(retrivedPlans.items || [])
  } while (position)

  return usagePlans
}

type UsagePlanWithTenantId = UsagePlan & { tenantId: string }
export const getTenantInfoFromUsagePlans = async (
  region: string
): Promise<TenantBasic[]> => {
  const apigateway = new APIGatewayClient({
    region,
    maxAttempts: 10,
  })

  const allUsagePlans = await getAllUsagePlans(region)

  const usagePlanKeys = (
    await Promise.all(
      allUsagePlans.map(async (usagePlan) => {
        const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
          usagePlanId: usagePlan.id,
        })

        const usagePlanKeys = await apigateway.send(usagePlanKeysCommand)

        if (usagePlanKeys.items?.length) {
          return {
            ...usagePlan,
            tenantId: usagePlanKeys.items[0].name,
          }
        } else {
          console.warn(
            `Usage plan ${usagePlan.id} does not have any keys associated with it`
          )
          return null
        }
      })
    )
  ).filter((u): u is UsagePlanWithTenantId => Boolean(u))

  return usagePlanKeys
    .filter((usagePlan): usagePlan is UsagePlanWithTenantId =>
      Boolean(usagePlan)
    )
    .map((usagePlan): TenantBasic | null => {
      if (
        usagePlan.name &&
        USAGE_PLAN_REGEX.test(usagePlan.name) &&
        usagePlan.tenantId &&
        usagePlan.name?.includes(usagePlan.tenantId)
      ) {
        return {
          id: usagePlan.tenantId,
          usagePlanId: usagePlan.id,
          name: usagePlan.name
            .replace('tarpon:', '')
            .replace(':', '')
            .replace(usagePlan.tenantId, ''),
        }
      }
      console.warn(
        `Invalid usage plan name ${usagePlan.name} for usage plan ${usagePlan.id}`
      )
      return null
    })
    .filter((t): t is TenantBasic => Boolean(t)) // Another replacement for compact
}

export const doesUsagePlanExist = async (
  planName: string,
  region: string
): Promise<boolean> => {
  const usagePlans = await getAllUsagePlans(region)

  const usagePlan = usagePlans?.find((x) => x.name?.includes(`${planName}`))
  const usagePlanName = usagePlan?.name

  if (usagePlanName == null) {
    return false
  }

  if (usagePlanName.match(USAGE_PLAN_REGEX)?.[2] === planName) {
    return true
  }
  return false
}

type TenantBasic = {
  id: string
  name: string
  auth0Domain?: string
  usagePlanId?: string
}

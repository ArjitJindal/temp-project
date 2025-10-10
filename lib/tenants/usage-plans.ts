import {
  APIGatewayClient,
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

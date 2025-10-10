import { KYC_STATUSS } from '@/@types/openapi-public-custom/KYCStatus'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

export const userStatsMVQuery = async (
  timeFormat: string,
  tenantId: string
) => {
  const riskRepository = new RiskRepository(tenantId, {
    dynamoDb: getDynamoDbClient(),
  })

  const riskClassifications = await riskRepository.getRiskClassificationValues()

  const riskClassificationQuery = (type: 'krs' | 'drs') =>
    riskClassifications
      .map(
        (item) =>
          `countIf(${type}Score_${type}Score >= ${item.lowerBoundRiskScore} AND ${type}Score_${type}Score < ${item.upperBoundRiskScore}) AS ${type}RiskLevel_${item.riskLevel}`
      )
      .join(',\n')
  const userStateQuery = USER_STATES.map(
    (item) => `countIf(userStateDetails_state = '${item}') AS userState_${item}`
  ).join(',\n')

  const kycStatusQuery = KYC_STATUSS.map(
    (item) =>
      `countIf(kycStatusDetails_status = '${item}') AS kycStatus_${item}`
  ).join(',\n')
  const query = `
  SELECT 
    ${timeFormat} AS time,
    type,

    -- KRS Risk Levels
    ${riskClassificationQuery('krs')},

    -- DRS Risk Levels
    ${riskClassificationQuery('drs')},

    -- User State Counts
    ${userStateQuery},

    -- KYC Status Counts
    ${kycStatusQuery}

  FROM users
  WHERE toDateTime(timestamp / 1000) > toDateTime(0)
  GROUP BY timestamp, type;
`
  return query
}

export const userStatsColumns = [
  { name: 'time', type: 'DateTime' },
  { name: 'type', type: 'String' },
  { name: 'krsRiskLevel_VERY_LOW', type: 'UInt64' },
  { name: 'krsRiskLevel_LOW', type: 'UInt64' },
  { name: 'krsRiskLevel_MEDIUM', type: 'UInt64' },
  { name: 'krsRiskLevel_HIGH', type: 'UInt64' },
  { name: 'krsRiskLevel_VERY_HIGH', type: 'UInt64' },
  { name: 'drsRiskLevel_VERY_LOW', type: 'UInt64' },
  { name: 'drsRiskLevel_LOW', type: 'UInt64' },
  { name: 'drsRiskLevel_MEDIUM', type: 'UInt64' },
  { name: 'drsRiskLevel_HIGH', type: 'UInt64' },
  { name: 'drsRiskLevel_VERY_HIGH', type: 'UInt64' },
  { name: 'userState_UNACCEPTABLE', type: 'UInt64' },
  { name: 'userState_TERMINATED', type: 'UInt64' },
  { name: 'userState_ACTIVE', type: 'UInt64' },
  { name: 'userState_DORMANT', type: 'UInt64' },
  { name: 'userState_CREATED', type: 'UInt64' },
  { name: 'userState_SUSPENDED', type: 'UInt64' },
  { name: 'userState_BLOCKED', type: 'UInt64' },
  { name: 'kycStatus_SUCCESSFUL', type: 'UInt64' },
  { name: 'kycStatus_FAILED', type: 'UInt64' },
  { name: 'kycStatus_NOT_STARTED', type: 'UInt64' },
  { name: 'kycStatus_IN_PROGRESS', type: 'UInt64' },
  { name: 'kycStatus_EXPIRED', type: 'UInt64' },
  { name: 'kycStatus_NEW', type: 'UInt64' },
  { name: 'kycStatus_CANCELLED', type: 'UInt64' },
  { name: 'kycStatus_MANUAL_REVIEW', type: 'UInt64' },
  { name: 'kycStatus_EDD_IN_PROGRESS', type: 'UInt64' },
]

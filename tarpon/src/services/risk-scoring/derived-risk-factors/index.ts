import { keyBy } from 'lodash'
import {
  ARS_USER_AGE_RISK_HANDLERS,
  KRS_USER_AGE_RISK_HANDLERS,
} from './user-age'
import { ARS_DOMESTIC_FOREIGN_COUNTRY_RISK_HANDLERS } from './domestic-foreign-country'
import { ARS_3DSDONE_RISK_HANDLERS } from './3dsDone'
import { ARS_IPADDRESSCOUNTRY_RISK_HANDLERS } from './ipAddressCountry'
import { ARS_CARD_ISSUED_COUNTRY_RISK_HANDLERS } from './card-issued-country'
import { KRS_USER_TYPE_RISK_HANDLERS } from './user-type'
import { ARS_BANK_NAME_RISK_HANDLERS } from './bank-name'
import { ARS_SAR_FILED_RISK_HANDLERS } from './sar-filed'
import { ARS_TRANSACTION_AMOUNT_RISK_HANDLERS } from './transaction-amount'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { Transaction } from '@/@types/openapi-public/Transaction'

function getRiskFactorKey(
  entityType: RiskEntityType,
  parameter: ParameterAttributeRiskValuesParameterEnum
) {
  return `${entityType}:${parameter}`
}

export type UserRiskFactorValueHandler<T> = {
  entityType: RiskEntityType
  parameter: ParameterAttributeRiskValuesParameterEnum
  handler: (
    user: Business | User,
    parameter: ParameterAttributeRiskValuesParameterEnum
  ) => Promise<Array<T | undefined>>
}

export type TransactionRiskFactorValueHandler<T> = {
  entityType: RiskEntityType
  parameter: ParameterAttributeRiskValuesParameterEnum
  handler: (
    transaction: Transaction,
    users: {
      originUser: Business | User | undefined
      destinationUser: Business | User | undefined
    },
    parameter: ParameterAttributeRiskValuesParameterEnum,
    tenantId: string
  ) => Promise<Array<T | undefined>>
}

const USER_RISK_FACTOR_HANDLERS: Array<UserRiskFactorValueHandler<any>> = [
  ...KRS_USER_AGE_RISK_HANDLERS,
  ...KRS_USER_TYPE_RISK_HANDLERS,
]

const USER_RISK_FACTOR_HANDLERS_MAP = keyBy(
  USER_RISK_FACTOR_HANDLERS,
  (entry) => getRiskFactorKey(entry.entityType, entry.parameter)
)

const TRANSACTION_RISK_FACTOR_HANDLERS: Array<
  TransactionRiskFactorValueHandler<any>
> = [
  ...ARS_USER_AGE_RISK_HANDLERS,
  ...ARS_DOMESTIC_FOREIGN_COUNTRY_RISK_HANDLERS,
  ...ARS_3DSDONE_RISK_HANDLERS,
  ...ARS_IPADDRESSCOUNTRY_RISK_HANDLERS,
  ...ARS_CARD_ISSUED_COUNTRY_RISK_HANDLERS,
  ...ARS_BANK_NAME_RISK_HANDLERS,
  ...ARS_SAR_FILED_RISK_HANDLERS,
  ...ARS_TRANSACTION_AMOUNT_RISK_HANDLERS,
]

const TRANSACTION_RISK_FACTOR_HANDLERS_MAP = keyBy(
  TRANSACTION_RISK_FACTOR_HANDLERS,
  (entry) => getRiskFactorKey(entry.entityType, entry.parameter)
)

export function getUserDerivedRiskFactorHandler(
  entityType: RiskEntityType,
  parameter: ParameterAttributeRiskValuesParameterEnum
) {
  const handler =
    USER_RISK_FACTOR_HANDLERS_MAP[getRiskFactorKey(entityType, parameter)]
  return handler ? handler.handler : undefined
}

export function getTransactionDerivedRiskFactorHandler(
  entityType: RiskEntityType,
  parameter: ParameterAttributeRiskValuesParameterEnum
) {
  const handler =
    TRANSACTION_RISK_FACTOR_HANDLERS_MAP[
      getRiskFactorKey(entityType, parameter)
    ]
  return handler ? handler.handler : undefined
}

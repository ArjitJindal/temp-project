import _ from 'lodash'
import {
  ARS_USER_AGE_RISK_HANDLERS,
  KRS_USER_AGE_RISK_HANDLERS,
} from './user-age'
import { ARS_DOMESTIC_FOREIGN_COUNTRY_RISK_HANDLERS } from './domestic-foreign-country'
import { ARS_3DSDONE_RISK_HANDLERS } from './3dsDone'
import { ARS_IPADDRESSCOUNTRY_RISK_HANDLERS } from './ipAddressCountry'
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
    parameter: ParameterAttributeRiskValuesParameterEnum
  ) => Promise<Array<T | undefined>>
}

const USER_RISK_FACTOR_HANDLERS: Array<UserRiskFactorValueHandler<any>> = [
  ...KRS_USER_AGE_RISK_HANDLERS,
]

const USER_RISK_FACTOR_HANDLERS_MAP = _.keyBy(
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
]

const TRANSACTION_RISK_FACTOR_HANDLERS_MAP = _.keyBy(
  TRANSACTION_RISK_FACTOR_HANDLERS,
  (entry) => getRiskFactorKey(entry.entityType, entry.parameter)
)

export function getUserDerivedRiskFactorHandler(
  entityType: RiskEntityType,
  parameter: ParameterAttributeRiskValuesParameterEnum
) {
  return USER_RISK_FACTOR_HANDLERS_MAP[getRiskFactorKey(entityType, parameter)]
    ?.handler
}

export function getTransactionDerivedRiskFactorHandler(
  entityType: RiskEntityType,
  parameter: ParameterAttributeRiskValuesParameterEnum
) {
  return TRANSACTION_RISK_FACTOR_HANDLERS_MAP[
    getRiskFactorKey(entityType, parameter)
  ]?.handler
}

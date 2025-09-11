import compact from 'lodash/compact'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { AuxiliaryIndexTransaction } from '@/services/rules-engine/repositories/transaction-repository-interface'

export function getAllIpAddresses(
  transaction: AuxiliaryIndexTransaction | Transaction
): string[] {
  return compact([
    transaction?.originDeviceData?.ipAddress,
    transaction?.destinationDeviceData?.ipAddress,
  ])
}

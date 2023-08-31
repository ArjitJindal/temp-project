// TODO: once we remove the old IP address, we can remove this function

import { compact } from 'lodash'
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

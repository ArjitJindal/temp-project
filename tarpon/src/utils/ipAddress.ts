// TODO: once we remove the old IP address, we can remove this function

import { compact } from 'lodash'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function getOriginIpAddress(
  transaction: Transaction['deviceData']
): string | undefined {
  return transaction?.originIpAddress ?? transaction?.ipAddress
}

export function getAllIpAddresses(
  transaction: Transaction['deviceData']
): string[] {
  return compact([
    transaction?.originIpAddress,
    transaction?.ipAddress,
    transaction?.destinationIpAddress,
  ])
}

import { getContext } from '@/core/utils/context'

export function isDemoMode() {
  return getContext()?.tenantId?.endsWith('-test')
}

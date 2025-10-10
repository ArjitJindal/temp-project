import { getContext } from '@/core/utils/context-storage'

export function isDemoMode() {
  return getContext()?.tenantId?.endsWith('-test')
}

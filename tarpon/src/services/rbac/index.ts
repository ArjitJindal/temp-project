import { hydratePermissions, PERMISSIONS_LIBRARY } from './utils/permissions'
import { PermissionsResponse } from '@/@types/openapi-internal/PermissionsResponse'
import { traceable } from '@/core/xray'

@traceable
export class RBACService {
  static getAllPermissions(): PermissionsResponse {
    return {
      permissions: hydratePermissions(PERMISSIONS_LIBRARY),
    }
  }
}

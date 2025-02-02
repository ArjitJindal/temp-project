import { isFlagrightInternalUser } from '@/@types/jwt'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { CreateAccountRole } from '@/@types/openapi-internal/CreateAccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getContext } from '@/core/utils/context'

export type CreateRoleInternal =
  | { type: 'DATABASE'; params: AccountRole }
  | { type: 'AUTH0'; params: CreateAccountRole }

export const DEFAULT_NAMESPACE = 'default'

export abstract class BaseRolesRepository {
  abstract getTenantRoles(tenantId: string): Promise<AccountRole[]>
  abstract createRole(
    tenantId: string,
    inputRole: CreateRoleInternal
  ): Promise<AccountRole>
  abstract updateRole(
    tenantId: string,
    id: string,
    data: Partial<AccountRole>
  ): Promise<void>
  abstract getRole(id: string): Promise<AccountRole | null>
  abstract deleteRole(id: string): Promise<void>
  abstract updateRolePermissions(
    roleId: string,
    permissions: Permission[]
  ): Promise<void>

  protected shouldFetchRootRole(): boolean {
    return !!isFlagrightInternalUser() && getContext()?.user?.role === 'root'
  }
}

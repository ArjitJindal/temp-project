import { Forbidden } from 'http-errors'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { FilterCondition } from '@/@types/openapi-internal/FilterCondition'

const normalize = (v?: string): string =>
  (v || '').toUpperCase().replace(/-/g, '_')

export const getAllowedValues = (
  statements: PermissionStatements[],
  opts: { permissionId: string; param: string }
): Set<string> => {
  const allowed = new Set<string>()
  for (const st of statements || []) {
    const filters: FilterCondition[] | undefined = (st as any)?.filter
    if (!filters || !Array.isArray(filters)) {
      continue
    }
    for (const f of filters) {
      if (f?.permissionId === opts.permissionId && f?.param === opts.param) {
        for (const val of f.values || []) {
          allowed.add(normalize(val))
        }
      }
    }
  }
  return allowed
}

export const assertAccessForValue = (
  statements: PermissionStatements[],
  value: string | undefined,
  opts: { permissionId: string; param: string; label?: string }
) => {
  const allowed = getAllowedValues(statements, opts)
  if (allowed.size === 0) {
    return
  }

  const normalized = normalize(value)
  if (!allowed.has(normalized)) {
    const label = opts.label || 'value'
    throw new Forbidden(`Access denied for ${label}: ${value || 'UNKNOWN'}`)
  }
}

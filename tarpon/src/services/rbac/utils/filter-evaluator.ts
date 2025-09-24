import { Forbidden } from 'http-errors'
import { FilterConditions } from '@/@types/rbac/filters'

// Build allowed index purely from statements
//
// What it does:
// - Reads all statement.filters and builds a map: param -> {permissionId, allowed values}
// - Example input statements:
//   [
//     { filter: [ { permissionId: 'case-status', param: 'filterCaseStatus', values: ['OPEN','CLOSED'] } ] },
//     { filter: [ { permissionId: 'alert-status', param: 'filterAlertStatus', values: ['OPEN'] } ] }
//   ]
// - Output index:
//   {
//     filterCaseStatus -> { permissionId: 'case-status', values: Set('OPEN','CLOSED') },
//     filterAlertStatus -> { permissionId: 'alert-status', values: Set('OPEN') }
//   }
// Notes:
// - If multiple statements mention the same param, values are unioned.
// - permissionId defaults to param if omitted in the statement.
// - This function never mutates the original statements.
//
// Why needed:
// - Downstream we only allow/inject filters that appear in this index.
// - Keeps enforcement generic and data-driven.
//
// Performance:
// - O(n) over total filter entries; safe to run per request.
type AllowedIndex = Map<string, { permissionId: string; values: Set<string> }>

function buildAllowedIndexFromStatements(
  statements: Array<{
    filter?: Array<{ param: string; values: string[]; permissionId?: string }>
  }>
): AllowedIndex {
  const index: AllowedIndex = new Map()
  ;(Array.isArray(statements) ? statements : []).forEach((st) => {
    ;(Array.isArray(st?.filter) ? st.filter : []).forEach((f) => {
      if (!index.has(f.param)) {
        index.set(f.param, {
          permissionId: f.permissionId || f.param,
          values: new Set(),
        })
      }
      const item = index.get(f.param)
      if (item) {
        f.values?.forEach((v) => item.values.add(v))
        if (f.permissionId) {
          item.permissionId = f.permissionId
        }
      }
    })
  })
  return index
}

// Convert query params to filters using only what statements allow
//
// What it does:
// - From request query params, builds a FilterConditions array limited to parameters present in the AllowedIndex.
// - Each produced filter uses operator 'Equals' and splits comma-separated values.
//
// Example:
//   queryParams = { filterCaseStatus: 'OPEN,CLOSED', page: '1' }
//   allowedIndex has only 'filterCaseStatus'
//   => [{ permissionId: 'case-status', operator: 'Equals', param: 'filterCaseStatus', values: ['OPEN','CLOSED'] }]
//
// Notes:
// - Unknown params (not in AllowedIndex) are ignored.
// - Empty values are ignored.
function buildRequestFiltersFromQuery(
  queryParams: Record<string, string | undefined> | null,
  allowedIndex: AllowedIndex
): FilterConditions {
  if (!queryParams) {
    return []
  }
  const filters: FilterConditions = []
  Object.entries(queryParams).forEach(([param, value]) => {
    if (!value) {
      return
    }
    const allowed = allowedIndex.get(param)
    if (!allowed) {
      return
    }
    filters.push({
      permissionId: allowed.permissionId,
      operator: 'Equals',
      param,
      values: value.split(','),
    })
  })
  return filters
}

// Consolidated enforcement that:
// 1) Validates request filters are within allowed values
// 2) Injects default values for any missing allowed params (scoped by allowParams)
// 3) Returns both built filters and the nextQueryParams to forward downstream
//
// Parameters:
// - queryParams: raw request query string params
// - statements: role statements (only .filter is read)
// - allowParams (optional): whitelist of param names to consider for this route
//
// Examples:
// - If allowParams=['filterCaseStatus'] and statements allow OPEN,CLOSED and request has no filterCaseStatus:
//   nextQueryParams.filterCaseStatus = 'OPEN,CLOSED'
// - If request has filterCaseStatus=CLOSED and allow is OPEN,CLOSED -> keep 'CLOSED' and still inject defaults for any other allowed params that are missing.
export function enforceAndInjectFilters(
  queryParams: Record<string, string | undefined> | null,
  statements: Array<{ filter?: Array<{ param: string; values: string[] }> }>,
  allowParams?: string[]
): { filters: FilterConditions; nextQueryParams: Record<string, string> } {
  const allowedIndex = buildAllowedIndexFromStatements(statements)
  const scopedIndex: AllowedIndex = allowParams?.length
    ? new Map(
        Array.from(allowedIndex.entries()).filter(([param]) =>
          allowParams.includes(param)
        )
      )
    : allowedIndex

  const built = buildRequestFiltersFromQuery(queryParams, scopedIndex)

  if (built.length > 0) {
    built.forEach((f) =>
      ensureWithinAllowed(f.param, f.values, toAllowedValuesMap(scopedIndex))
    )
  }

  const nextQueryParams = injectDefaultsIfMissing(
    queryParams,
    toAllowedValuesMap(scopedIndex),
    built.length > 0
  )
  return { filters: built, nextQueryParams }
}

// Helper: convert AllowedIndex to param -> allowed Set map
function toAllowedValuesMap(index: AllowedIndex): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  index.forEach((v, k) => map.set(k, v.values))
  return map
}

// Validates that requested filter values are a subset of allowed
// Throws 403 Forbidden if any value is out of allowed set.
function ensureWithinAllowed(
  param: string,
  values: string[],
  allowed: Map<string, Set<string>>
) {
  const allowedSet = allowed.get(param)
  if (allowedSet && values.some((v) => !allowedSet.has(v))) {
    throw new Forbidden('Requested filter value not permitted')
  }
}

// Inject defaults for any allowed param that is missing from the request.
// - If hasRequestFilters is true, we still inject defaults for missing params (keeps multi-dimension scoping consistent).
// - Provided params are never overridden.
// Example:
//   allowed: { filterCaseStatus -> ['OPEN','CLOSED'], filterAlertStatus -> ['OPEN'] }
//   queryParams: { filterAlertStatus: 'OPEN' }
//   => next.filterAlertStatus stays 'OPEN', next.filterCaseStatus becomes 'OPEN,CLOSED'
function injectDefaultsIfMissing(
  queryParams: Record<string, string | undefined> | null,
  allowed: Map<string, Set<string>>,
  _hasRequestFilters: boolean
): Record<string, string> {
  const next: Record<string, string> = { ...(queryParams || {}) } as Record<
    string,
    string
  >
  // Inject defaults for any allowed param that is missing from the request
  if (allowed.size > 0) {
    for (const [param, set] of allowed.entries()) {
      if (!next[param] || next[param].trim() === '') {
        next[param] = Array.from(set).join(',')
      }
    }
  }
  return next
}

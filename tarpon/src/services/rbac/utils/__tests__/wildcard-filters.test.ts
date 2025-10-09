import { getOptimizedPermissions } from '@/services/rbac/utils/permissions'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'

describe('getOptimizedPermissions - wildcard filters inference', () => {
  const tenantId = 'flagright'

  test('grants case-status/* and alert-status/* -> emits both filters with all values', () => {
    const input: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [
          `frn:console:${tenantId}:::case-management/case-status/*`,
          `frn:console:${tenantId}:::case-management/alert-status/*`,
        ],
      },
    ]

    const out = getOptimizedPermissions(tenantId, input)
    expect(out.length).toBeGreaterThan(0)
    const s = out[0]
    expect(s.filter).toBeDefined()

    const byId: Record<string, string[]> = {}
    ;(s.filter || []).forEach((f) => {
      byId[f.permissionId] = f.values
    })

    // Case status expectations (subset check)
    expect(byId['case-status']).toBeDefined()
    expect(byId['case-status']).toEqual(
      expect.arrayContaining(['OPEN', 'CLOSED'])
    )

    // Alert status expectations (subset check)
    expect(byId['alert-status']).toBeDefined()
    expect(byId['alert-status']).toEqual(
      expect.arrayContaining(['OPEN', 'CLOSED'])
    )

    // Operators and params should be set
    const caseFilter = (s.filter || []).find(
      (f) => f.permissionId === 'case-status'
    )
    const alertFilter = (s.filter || []).find(
      (f) => f.permissionId === 'alert-status'
    )
    expect(caseFilter?.operator).toBe('Equals')
    expect(caseFilter?.param).toBe('filterCaseStatus')
    expect(alertFilter?.operator).toBe('Equals')
    expect(alertFilter?.param).toBe('filterAlertStatus')
  })

  test('specific children only -> emits filters with those specific values', () => {
    const input: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [
          `frn:console:${tenantId}:::case-management/case-status/open/*`,
          `frn:console:${tenantId}:::case-management/alert-status/escalated/*`,
        ],
      },
    ]

    const out = getOptimizedPermissions(tenantId, input)
    const s = out[0]
    const byId: Record<string, string[]> = {}
    ;(s.filter || []).forEach((f) => (byId[f.permissionId] = f.values))
    expect(byId['case-status']).toEqual(['OPEN'])
    expect(byId['alert-status']).toEqual(['ESCALATED'])
  })

  test('pre-existing filter merges and dedupes with derived values', () => {
    const input: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [
          `frn:console:${tenantId}:::case-management/case-status/in-review/*`,
        ],
        filter: [
          {
            permissionId: 'case-status',
            operator: 'Equals',
            param: 'filterCaseStatus',
            values: ['OPEN'],
          },
        ],
      },
    ]

    const out = getOptimizedPermissions(tenantId, input)
    const s = out[0]
    const caseFilter = (s.filter || []).find(
      (f) => f.permissionId === 'case-status'
    )
    expect(caseFilter).toBeDefined()
    expect(caseFilter?.values).toEqual(
      expect.arrayContaining([
        'OPEN',
        'IN_REVIEW_OPEN',
        'IN_REVIEW_ESCALATED',
        'IN_REVIEW_CLOSED',
        'IN_REVIEW_REOPENED',
      ])
    )
  })

  test('non-filterable resources -> no filters emitted', () => {
    const input: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [
          `frn:console:${tenantId}:::rules/library/*`,
          `frn:console:${tenantId}:::case-management/export/*`,
        ],
      },
    ]
    const out = getOptimizedPermissions(tenantId, input)
    const s = out[0]
    expect(s.filter).toBeUndefined()
  })

  test('global wildcard (tenant :::*) -> passes through with existing filters only', () => {
    const input: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [`frn:console:${tenantId}:::*`],
        filter: [
          {
            permissionId: 'case-status',
            operator: 'Equals',
            param: 'filterCaseStatus',
            values: ['OPEN'],
          },
        ],
      },
    ]
    const out = getOptimizedPermissions(tenantId, input)
    const s = out[0]
    expect(s.resources).toEqual([`frn:console:${tenantId}:::*`])
    expect((s.filter || []).length).toBe(1)
  })
})

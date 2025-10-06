import { getOptimizedPermissions } from '@/services/rbac/utils/permissions'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { FilterCondition } from '@/@types/openapi-internal/FilterCondition'

describe('getOptimizedPermissions - permission scenarios', () => {
  const tenantId = 'flagright'

  // Helper function to extract filters by ID
  const getFiltersById = (statements: PermissionStatements[]) => {
    const statement = statements[0]
    if (!statement?.filter) {
      return {}
    }

    const byId: Record<string, FilterCondition> = {}
    statement.filter.forEach((f) => {
      byId[f.permissionId] = f
    })
    return byId
  }

  describe('No Permissions', () => {
    test('empty input -> no permissions', () => {
      const input: PermissionStatements[] = []
      const out = getOptimizedPermissions(tenantId, input)
      expect(out).toEqual([])
    })

    test('non-filterable resources only -> no filters', () => {
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
      expect(out[0].filter).toBeUndefined()
    })
  })

  describe('Specific Status Permissions', () => {
    test('single case status -> exact filter values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['case-status']).toBeDefined()
      expect(filters['case-status'].values).toEqual(['OPEN'])
      expect(filters['case-status'].operator).toBe('Equals')
      expect(filters['case-status'].param).toBe('filterCaseStatus')
    })

    test('single alert status -> exact filter values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/alert-status/escalated/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['alert-status']).toBeDefined()
      expect(filters['alert-status'].values).toEqual(['ESCALATED'])
      expect(filters['alert-status'].operator).toBe('Equals')
      expect(filters['alert-status'].param).toBe('filterAlertStatus')
    })

    test('multiple specific statuses -> combined filter values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
            `frn:console:${tenantId}:::case-management/case-status/closed/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['case-status']).toBeDefined()
      expect(new Set(filters['case-status'].values)).toEqual(
        new Set(['OPEN', 'CLOSED'])
      )
    })
  })

  describe('Wildcard Permissions', () => {
    test('case-status/* -> all case status values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['case-status']).toBeDefined()
      expect(new Set(filters['case-status'].values)).toEqual(
        new Set([
          'OPEN',
          'CLOSED',
          'REOPENED',
          'ESCALATED',
          'IN_REVIEW_OPEN',
          'IN_REVIEW_ESCALATED',
          'IN_REVIEW_CLOSED',
          'IN_REVIEW_REOPENED',
          'OPEN_IN_PROGRESS',
          'ESCALATED_IN_PROGRESS',
          'OPEN_ON_HOLD',
          'ESCALATED_ON_HOLD',
          'ESCALATED_L2',
        ])
      )
    })

    test('alert-status/* -> all alert status values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/alert-status/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['alert-status']).toBeDefined()
      expect(new Set(filters['alert-status'].values)).toEqual(
        new Set([
          'OPEN',
          'CLOSED',
          'REOPENED',
          'ESCALATED',
          'IN_REVIEW_OPEN',
          'IN_REVIEW_ESCALATED',
          'IN_REVIEW_CLOSED',
          'IN_REVIEW_REOPENED',
          'OPEN_IN_PROGRESS',
          'ESCALATED_IN_PROGRESS',
          'OPEN_ON_HOLD',
          'ESCALATED_ON_HOLD',
          'ESCALATED_L2',
        ])
      )
    })

    test('tenant wildcard (:::*) -> preserves existing filters only', () => {
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
      expect(out[0].resources).toEqual([`frn:console:${tenantId}:::*`])
      const filters = out[0].filter
      expect(filters).toBeDefined()
      expect(filters).toHaveLength(1)
      expect(filters?.[0].values).toEqual(['OPEN'])
    })

    test('tenant wildcard without filters -> no filters', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [`frn:console:${tenantId}:::*`],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      expect(out[0].resources).toEqual([`frn:console:${tenantId}:::*`])
      expect(out[0].filter).toBeUndefined()
    })
  })

  describe('Mixed Permissions', () => {
    test('specific status + wildcard -> combines all values', () => {
      const input: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
            `frn:console:${tenantId}:::case-management/alert-status/*`,
          ],
        },
      ]
      const out = getOptimizedPermissions(tenantId, input)
      const filters = getFiltersById(out)

      expect(filters['case-status'].values).toEqual(['OPEN'])
      expect(filters['alert-status'].values).toContain('OPEN')
      expect(filters['alert-status'].values).toContain('CLOSED')
    })

    test('pre-existing filters + new paths -> merges correctly', () => {
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
      const filters = getFiltersById(out)

      expect(new Set(filters['case-status'].values)).toEqual(
        new Set([
          'IN_REVIEW_OPEN',
          'IN_REVIEW_ESCALATED',
          'IN_REVIEW_CLOSED',
          'IN_REVIEW_REOPENED',
        ])
      )
    })
  })

  describe('Permission Transitions', () => {
    test('no permissions -> all statuses -> no permissions', () => {
      // Start with no permissions
      const noPerms: PermissionStatements[] = []
      const step1 = getOptimizedPermissions(tenantId, noPerms)
      expect(step1).toEqual([])

      // Add all status permissions
      const allPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/*`,
            `frn:console:${tenantId}:::case-management/alert-status/*`,
          ],
        },
      ]
      const step2 = getOptimizedPermissions(tenantId, allPerms)
      const allFilters = getFiltersById(step2)
      expect(allFilters['case-status']).toBeDefined()
      expect(allFilters['alert-status']).toBeDefined()
      expect(allFilters['case-status'].values.length).toBeGreaterThan(0)
      expect(allFilters['alert-status'].values.length).toBeGreaterThan(0)

      // Back to no permissions
      const step3 = getOptimizedPermissions(tenantId, noPerms)
      expect(step3).toEqual([])
    })

    test('open -> closed -> open status transitions (no value leakage)', () => {
      // Start with OPEN status
      const openPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
            `frn:console:${tenantId}:::case-management/alert-status/open/*`,
          ],
        },
      ]
      const step1 = getOptimizedPermissions(tenantId, openPerms)
      const openFilters = getFiltersById(step1)
      // Should only have OPEN
      expect(openFilters['case-status'].values).toEqual(['OPEN'])
      expect(openFilters['alert-status'].values).toEqual(['OPEN'])
      // Verify no other values leaked in
      expect(openFilters['case-status'].values).not.toContain('CLOSED')
      expect(openFilters['alert-status'].values).not.toContain('CLOSED')

      // Change to CLOSED status
      const closedPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/closed/*`,
            `frn:console:${tenantId}:::case-management/alert-status/closed/*`,
          ],
        },
      ]
      const step2 = getOptimizedPermissions(tenantId, closedPerms)
      const closedFilters = getFiltersById(step2)
      // Should only have CLOSED
      expect(closedFilters['case-status'].values).toEqual(['CLOSED'])
      expect(closedFilters['alert-status'].values).toEqual(['CLOSED'])
      // Verify previous OPEN value is gone
      expect(closedFilters['case-status'].values).not.toContain('OPEN')
      expect(closedFilters['alert-status'].values).not.toContain('OPEN')

      // Back to OPEN status
      const step3 = getOptimizedPermissions(tenantId, openPerms)
      const finalFilters = getFiltersById(step3)
      // Should only have OPEN again
      expect(finalFilters['case-status'].values).toEqual(['OPEN'])
      expect(finalFilters['alert-status'].values).toEqual(['OPEN'])
      // Verify previous CLOSED value is gone
      expect(finalFilters['case-status'].values).not.toContain('CLOSED')
      expect(finalFilters['alert-status'].values).not.toContain('CLOSED')
    })

    test('single status -> multiple statuses -> single status (no value leakage)', () => {
      // Start with single status
      const singlePerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
          ],
        },
      ]
      const step1 = getOptimizedPermissions(tenantId, singlePerms)
      const singleFilters = getFiltersById(step1)
      // Should only have OPEN
      expect(singleFilters['case-status'].values).toEqual(['OPEN'])
      expect(singleFilters['alert-status']).toBeUndefined()
      // Verify no other values present
      expect(singleFilters['case-status'].values).not.toContain('CLOSED')
      expect(singleFilters['case-status'].values).not.toContain('ESCALATED')

      // Add multiple statuses
      const multiPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/closed/*`,
            `frn:console:${tenantId}:::case-management/case-status/escalated/*`,
          ],
        },
      ]
      const step2 = getOptimizedPermissions(tenantId, multiPerms)
      const multiFilters = getFiltersById(step2)
      // Should only have new values
      expect(new Set(multiFilters['case-status'].values)).toEqual(
        new Set(['CLOSED', 'ESCALATED'])
      )
      // Verify previous OPEN value is gone
      expect(multiFilters['case-status'].values).not.toContain('OPEN')

      // Back to single status
      const step3 = getOptimizedPermissions(tenantId, singlePerms)
      const finalFilters = getFiltersById(step3)
      // Should only have OPEN again
      expect(finalFilters['case-status'].values).toEqual(['OPEN'])
      expect(finalFilters['alert-status']).toBeUndefined()
      // Verify previous values are gone
      expect(finalFilters['case-status'].values).not.toContain('CLOSED')
      expect(finalFilters['case-status'].values).not.toContain('ESCALATED')
    })

    test('case status only -> both statuses -> alert status only (no value leakage)', () => {
      // Start with case status only
      const casePerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/open/*`,
          ],
        },
      ]
      const step1 = getOptimizedPermissions(tenantId, casePerms)
      const caseFilters = getFiltersById(step1)
      // Should only have case status OPEN
      expect(caseFilters['case-status'].values).toEqual(['OPEN'])
      expect(caseFilters['alert-status']).toBeUndefined()

      // Add both statuses but with different values
      const bothPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/case-status/closed/*`,
            `frn:console:${tenantId}:::case-management/alert-status/escalated/*`,
          ],
        },
      ]
      const step2 = getOptimizedPermissions(tenantId, bothPerms)
      const bothFilters = getFiltersById(step2)
      // Should only have new values
      expect(bothFilters['case-status'].values).toEqual(['CLOSED'])
      expect(bothFilters['alert-status'].values).toEqual(['ESCALATED'])
      // Verify previous values are gone
      expect(bothFilters['case-status'].values).not.toContain('OPEN')
      expect(bothFilters['alert-status'].values).not.toContain('OPEN')

      // Switch to alert status only with new value
      const alertPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/alert-status/open/*`,
          ],
        },
      ]
      const step3 = getOptimizedPermissions(tenantId, alertPerms)
      const alertFilters = getFiltersById(step3)
      // Should only have alert status OPEN
      expect(alertFilters['case-status']).toBeUndefined()
      expect(alertFilters['alert-status'].values).toEqual(['OPEN'])
      // Verify previous values are gone
      expect(alertFilters['alert-status'].values).not.toContain('ESCALATED')
    })

    test('all alert statuses -> revoke one status -> check values', () => {
      // Step 1: Grant all alert statuses
      const allAlertStatusPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/alert-status/*`,
          ],
        },
      ]
      const step1 = getOptimizedPermissions(tenantId, allAlertStatusPerms)
      const allFilters = getFiltersById(step1)

      // Check that all statuses are present, including CLOSED
      const allStatuses = new Set([
        'OPEN',
        'CLOSED',
        'REOPENED',
        'ESCALATED',
        'IN_REVIEW_OPEN',
        'IN_REVIEW_ESCALATED',
        'IN_REVIEW_CLOSED',
        'IN_REVIEW_REOPENED',
        'OPEN_IN_PROGRESS',
        'ESCALATED_IN_PROGRESS',
        'OPEN_ON_HOLD',
        'ESCALATED_ON_HOLD',
        'ESCALATED_L2',
      ])
      expect(allFilters['alert-status']).toBeDefined()
      expect(new Set(allFilters['alert-status'].values)).toEqual(allStatuses)
      expect(allFilters['alert-status'].values).toContain('CLOSED')

      // Step 2: Revoke CLOSED status by granting all other statuses explicitly
      const allButClosedPerms: PermissionStatements[] = [
        {
          actions: ['read'],
          resources: [
            `frn:console:${tenantId}:::case-management/alert-status/open/*`,
            `frn:console:${tenantId}:::case-management/alert-status/reopened/*`,
            `frn:console:${tenantId}:::case-management/alert-status/escalated/*`,
            `frn:console:${tenantId}:::case-management/alert-status/in-review/*`,
            `frn:console:${tenantId}:::case-management/alert-status/in-review-escalated/*`,
            `frn:console:${tenantId}:::case-management/alert-status/in-progress/*`,
            `frn:console:${tenantId}:::case-management/alert-status/on-hold/*`,
            `frn:console:${tenantId}:::case-management/alert-status/escalated-l2/*`,
          ],
        },
      ]

      const step2 = getOptimizedPermissions(tenantId, allButClosedPerms)
      const revokedFilters = getFiltersById(step2)

      // Check that CLOSED is no longer present
      expect(revokedFilters['alert-status']).toBeDefined()
      expect(revokedFilters['alert-status'].values).not.toContain('CLOSED')

      // Check that other statuses are still there
      expect(revokedFilters['alert-status'].values).toContain('OPEN')
      expect(revokedFilters['alert-status'].values.length).toBe(
        allStatuses.size - 1
      )
    })
  })
})

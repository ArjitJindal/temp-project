import fs from 'fs'
import path from 'path'
import {
  convertToFrns,
  getDynamicPermissionsType,
  getOptimizedPermissions,
  isPermissionValidFromTree,
} from '../utils/permissions'
import { DEFAULT_ROLES_V2 } from '@/core/default-roles'

describe('default roles', () => {
  test('keys', async () => {
    const data = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'resources', 'roles.json'), 'utf8')
    )
    expect(DEFAULT_ROLES_V2).toEqual(data)
  })
})

describe('isPermissionValidFromTree', () => {
  const tenantId = 'test-tenant'

  describe('prefix validation', () => {
    it('should return false for invalid frn prefix', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission:
            'invalid:console:test-tenant:::case-management/case-overview',
          action: ['read'],
        })
      ).toBe(false)
    })

    it('should return false for invalid console prefix', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:invalid:test-tenant:::case-management/case-overview',
          action: ['read'],
        })
      ).toBe(false)
    })

    it('should return false for non-matching tenantId', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission:
            'frn:console:different-tenant:::case-management/case-overview',
          action: ['read'],
        })
      ).toBe(false)
    })

    it('should allow wildcard (*) for console and tenantId', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:*:*:::case-management/case-overview',
          action: ['read'],
        })
      ).toBe(true)
    })

    it('should throw an error on rules library write', () => {
      const data = isPermissionValidFromTree({
        tenantId,
        permission: 'frn:console:test-tenant:::rules/library',
        action: ['write'],
      })

      expect(data).toBe(false)
    })
  })

  describe('static permissions', () => {
    it('should validate simple static permission with read action', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:console:test-tenant:::case-management/case-overview',
          action: ['read'],
        })
      ).toBe(true)
    })

    it('should validate static permission with write action', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:console:test-tenant:::case-management/case-overview',
          action: ['write'],
        })
      ).toBe(true)
    })

    it('should return false for invalid action', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:console:test-tenant:::case-management/export',
          action: ['write'],
        })
      ).toBe(false)
    })

    it('should return false for non-existent path', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:console:test-tenant:::case-management/non-existent',
          action: ['read'],
        })
      ).toBe(false)
    })
  })

  describe('dynamic permissions', () => {
    it('should validate dynamic permission with template ID', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission:
            'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template',
          action: ['write'],
        })
      ).toBe(true)
    })

    it('should return false for dynamic permission without template ID', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission:
            'frn:console:test-tenant:::settings/case-management/narrative-templates/template',
          action: ['write'],
        })
      ).toBe(false)
    })
  })

  describe('wildcard paths', () => {
    it('should validate permission with wildcard', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission: 'frn:console:test-tenant:::case-management/*',
          action: ['read'],
        })
      ).toBe(true)
    })

    it('should validate nested permission with wildcard', () => {
      expect(
        isPermissionValidFromTree({
          tenantId,
          permission:
            'frn:console:test-tenant:::settings/system-config/default-values/*',
          action: ['read'],
        })
      ).toBe(true)
    })
  })
})

describe('convertToFrns', () => {
  it('should convert a resource to an array of FRNs', () => {
    const frns = convertToFrns('test-tenant', [
      {
        id: 'case-management',
        children: [
          {
            id: 'case-overview',
            children: [
              { id: 'case-1', items: ['data-1', 'data-2'] },
              { id: 'case-2', items: ['data-3', 'data-4'] },
            ],
          },
          {
            id: 'case-overview-2',
          },
        ],
      },
      {
        id: 'case-management-2',
      },
    ])
    expect(frns).toEqual([
      'frn:console:test-tenant:::case-management/case-overview/case-1:data-1/*',
      'frn:console:test-tenant:::case-management/case-overview/case-1:data-2/*',
      'frn:console:test-tenant:::case-management/case-overview/case-2:data-3/*',
      'frn:console:test-tenant:::case-management/case-overview/case-2:data-4/*',
      'frn:console:test-tenant:::case-management/case-overview-2/*',
      'frn:console:test-tenant:::case-management-2/*',
    ])
  })
})

describe('getOptimizedPermissions', () => {
  it('should optimize permissions for admin (unrestricted access)', () => {
    const admin = DEFAULT_ROLES_V2.find((p) => p.role === 'admin')
    const frns = getOptimizedPermissions(
      'test-tenant',
      admin?.permissions ?? []
    )
    // Admin should have a single statement with full wildcard access and no filters
    expect(frns).toEqual([
      {
        actions: ['read', 'write'],
        resources: ['frn:console:test-tenant:::*'],
        filter: undefined,
      },
    ])
  })

  it('should not change dynamic permissions', () => {
    const frns = getOptimizedPermissions('test-tenant', [
      {
        actions: ['read'],
        resources: [
          'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template/*',
          'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template-2/*',
          'frn:console:test-tenant:::settings/system-config/default-values/currency/*',
          'frn:console:test-tenant:::settings/system-config/default-values/timezone/*',
          'frn:console:test-tenant:::settings/system-config/production-access-control/*',
        ],
      },
    ])

    expect(frns).toEqual([
      {
        actions: ['read'],
        resources: [
          'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template/*',
          'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template-2/*',
          'frn:console:test-tenant:::settings/system-config/*',
        ],
      },
    ])
  })

  it('should convert v2 permissions to v1 permissions', () => {
    const frns = getDynamicPermissionsType([
      'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template/*',
      'frn:console:test-tenant:::settings/case-management/narrative-templates/template:custom-template-2/*',
    ])
    expect(frns).toEqual([
      {
        subType: 'NARRATIVE_TEMPLATES',
        ids: ['custom-template', 'custom-template-2'],
      },
    ])
  })
})

import { describe, it, expect } from '@jest/globals';
import { Resource, hasResources } from '@flagright/lib/utils';
import { hasMinimumPermission } from '../user-utils';
import { PermissionStatements } from '@/apis';

describe('hasResources', () => {
  it('should return true when no required resources are provided', () => {
    const statements: PermissionStatements[] = [];
    const requiredResources: Resource[] = [];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should work for root user', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::*'],
      },
    ];
    const requiredResources: Resource[] = [
      'read:::settings/case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should return false when user has no permissions', () => {
    const statements: PermissionStatements[] = [];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(false);
  });

  it('should match exact resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/case-details/*'],
      },
    ];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should match wildcard resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should match nested wildcard resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/narrative-templates/*'],
      },
    ];
    const requiredResources: Resource[] = [
      'read:::case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should match multiple actions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read', 'write'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredResources: Resource[] = [
      'read:::case-management/case-details/*',
      'write:::case-management/case-details/*',
    ];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should match multiple resources', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: [
          'frn:console:test-tenant:::case-management/narrative-templates/template:custom-template/*',
          'frn:console:test-tenant:::case-management/narrative-templates/template:custom-template-2/*',
        ],
      },
    ];
    const requiredResources: Resource[] = [
      'read:::case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should return false for non-matching actions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['write'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(false);
  });

  it('should return false for non-matching resources', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/*'],
      },
    ];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(false);
  });

  it('should handle multiple statements', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/*'],
      },
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredResources: Resource[] = ['read:::case-management/case-details/*'];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });

  it('should handle multiple required statements', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredResources: Resource[] = [
      'read:::case-management/case-details/*',
      'read:::case-management/narrative-templates/*',
    ];

    expect(hasResources(statements, requiredResources)).toBe(true);
  });
});

describe('hasMinimumPermission', () => {
  it('should return true when no resources are required', () => {
    expect(hasMinimumPermission([], [])).toBe(true);
  });

  it('should return true when user has exact matching permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/system-config/timezone/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/system-config/timezone/*'])).toBe(
      true,
    );
  });

  it('should return true when user has write permission for read requirement', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['write'],
        resources: ['frn:console:test-tenant:::settings/system-config/timezone/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/system-config/timezone/*'])).toBe(
      true,
    );
  });

  it('should return false when user has only read permission for write requirement', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/system-config/timezone/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['write:::settings/system-config/timezone/*'])).toBe(
      false,
    );
  });

  it('should return true when user has broader permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/system-config/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/system-config/timezone/*'])).toBe(
      true,
    );
  });

  it('should return true when user has wildcard permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/system-config/timezone/*'])).toBe(
      true,
    );
  });

  it('should return false when user has no matching permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/case-management/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/system-config/timezone/*'])).toBe(
      false,
    );
  });

  it('should handle multiple required resources with mixed permissions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['write'],
        resources: [
          'frn:console:test-tenant:::settings/system-config/timezone/*',
          'frn:console:test-tenant:::settings/system-config/currency/*',
        ],
      },
    ];

    expect(
      hasMinimumPermission(statements, [
        'read:::settings/system-config/timezone/*',
        'write:::settings/system-config/currency/*',
      ]),
    ).toBe(true);
  });

  it('should handle multiple statements with mixed permissions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/system-config/timezone/*'],
      },
      {
        actions: ['write'],
        resources: ['frn:console:test-tenant:::settings/system-config/currency/*'],
      },
    ];

    expect(
      hasMinimumPermission(statements, [
        'read:::settings/system-config/timezone/*',
        'write:::settings/system-config/currency/*',
      ]),
    ).toBe(true);
  });

  it('should return false when user has no matching permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/system-config/timezone/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['write:::settings/case-management/*'])).toBe(false);
  });

  it('should return true when its a wildcard permission', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/case-management/*'])).toBe(true);
  });

  it('should return when parent permission is granted', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/case-management/*'])).toBe(true);
  });

  it('should return false when parent permission is not granted', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/*'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::case-management/case-details/*'])).toBe(false);
  });

  it('should return true when user has multiple statements', () => {
    const statements: PermissionStatements[] = [
      {
        resources: [
          'frn:console:flagright:::settings/case-management/*',
          'frn:console:flagright:::settings/security/*',
          'frn:console:flagright:::settings/system-config/*',
        ],
        actions: ['read', 'write'],
      },
    ];

    expect(hasMinimumPermission(statements, ['read:::settings/*'])).toBe(true);
  });
});

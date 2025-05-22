import { describe, it, expect } from '@jest/globals';
import { hasStatements } from '../user-utils';
import { PermissionStatements } from '@/apis';

describe('hasStatements', () => {
  it('should return true when no required statements are provided', () => {
    const statements: PermissionStatements[] = [];
    const requiredStatements: string[] = [];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should work for root user', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::*'],
      },
    ];
    const requiredStatements = [
      'read:::settings/case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should return false when user has no permissions', () => {
    const statements: PermissionStatements[] = [];
    const requiredStatements = ['read:::case-management/case-details/*'];

    expect(hasStatements(statements, requiredStatements)).toBe(false);
  });

  it('should match exact resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/case-details/*'],
      },
    ];
    const requiredStatements = ['read:::case-management/case-details/*'];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should match wildcard resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredStatements = ['read:::case-management/case-details/*'];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should match nested wildcard resource paths', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/narrative-templates/*'],
      },
    ];
    const requiredStatements = [
      'read:::case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should match multiple actions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read', 'write'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredStatements = [
      'read:::case-management/case-details/*',
      'write:::case-management/case-details/*',
    ];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
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
    const requiredStatements = [
      'read:::case-management/narrative-templates/template:custom-template/*',
    ];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should return false for non-matching actions', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['write'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredStatements = ['read:::case-management/case-details/*'];

    expect(hasStatements(statements, requiredStatements)).toBe(false);
  });

  it('should return false for non-matching resources', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::settings/*'],
      },
    ];
    const requiredStatements = ['read::case-management:case-details'];

    expect(hasStatements(statements, requiredStatements)).toBe(false);
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
    const requiredStatements = ['read:::case-management/case-details/*'];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });

  it('should handle multiple required statements', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read'],
        resources: ['frn:console:test-tenant:::case-management/*'],
      },
    ];
    const requiredStatements = [
      'read:::case-management/case-details/*',
      'read:::case-management/narrative-templates/*',
    ];

    expect(hasStatements(statements, requiredStatements)).toBe(true);
  });
});

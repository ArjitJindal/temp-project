import { PERMISSIONS } from '../../support/permissions';

describe('Audit log filter - entity type', () => {
  describe('Audit log filter - entity type', () => {
    const REQUIRED_PERMISSIONS = PERMISSIONS.AUDIT_LOG;

    beforeEach(() => {
      cy.loginWithPermissions({
        permissions: REQUIRED_PERMISSIONS,
      });
    });

    it('should filter according to entity type', () => {
      cy.visit('/auditlog');

      cy.get('[data-cy="rules-filter"]:contains("Entity")').first().click();
      cy.get('.ant-checkbox-wrapper:contains("CASE")').first().click();
      cy.get('[data-cy="auditlog-entity-confirm"]').click();
      cy.get('[data-cy="auditlog-primary"]').contains('CASE').should('exist');

      cy.get('[data-cy="auditlog-secondary"]')
        .first()
        .invoke('text')
        .then((entityId) => {
          cy.get('[data-cy="rules-filter"]:contains("Entity")').first().click();
          cy.get('[data-cy="auditlog-entity-reset"]').click();

          cy.get('[data-cy="rules-filter"]:contains("Entity ID")').first().click();

          cy.get(
            '.ant-popover-content:contains("Entity ID") .ant-popover-inner-content input',
          ).type(entityId);

          cy.get('[data-cy="auditlog-primary"]').contains('CASE').should('exist');
        });
    });
  });
});

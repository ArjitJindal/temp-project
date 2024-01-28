import { PERMISSIONS } from '../../support/permissions';

describe('Audit log filter - entity type', () => {
  const REQUIRED_PERMISSIONS = PERMISSIONS.AUDIT_LOG;
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('should filter according to entity type', () => {
    cy.visit('/auditlog');
    cy.get('[data-cy="rules-filter"]').filter(':contains("Entity")').eq(0).should('exist').click();
    cy.get('.ant-checkbox-wrapper').filter(':contains("CASE")').should('exist').first().click();
    cy.get('[data-cy="auditlog-entity-confirm"]').should('exist').click();
    cy.get('[data-cy="auditlog-primary"]')
      .contains('CASE')
      .should('exist')
      .each((ele) => {
        cy.wrap(ele)
          .should('exist')
          .invoke('text')
          .then((innerText) => {
            expect('CASE').to.include(innerText);
          });
      });
    cy.get('[data-cy="rules-filter"]').filter(':contains("Entity")').eq(0).should('exist').click();
    cy.get('[data-cy="auditlog-entity-reset"]').should('exist').click();
    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Entity ID")')
      .eq(0)
      .should('exist')
      .click();

    cy.get('[data-cy="auditlog-secondary"]')
      .first()
      .should('exist')
      .invoke('text')
      .then((text2) => {
        cy.get('.ant-popover-inner-content input', { timeout: 15000 })
          .eq(8)
          .type(text2, { force: true });
        cy.get('[data-cy="auditlog-secondary"]')
          .contains(text2)
          .should('exist')
          .each((ele) => {
            cy.wrap(ele)
              .should('exist')
              .invoke('text')
              .then((innerText) => {
                expect(text2).to.include(innerText);
              });
          });
      });
  });
});

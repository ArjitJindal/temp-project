import { PERMISSIONS } from '../../support/permissions';

describe('Alert Priority Filtering', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });
  it('should filter according to alert priority of the cases', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-priority&showCases=ALL_ALERTS&alertStatus=OPEN',
    );
    cy.get('[data-cy="segmented-control-all-alerts"]').should('exist').click();

    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Add filter")')
      .eq(0)
      .should('exist')
      .click();

    cy.get('[data-cy="rulesHitFilter-checkbox"]').then(($checkbox) => {
      if (!$checkbox.prop('checked')) {
        cy.get('[data-cy="rulesHitFilter-checkbox"]').click();
      }
    });

    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Alert priority")')
      .eq(0)
      .should('exist')
      .click();

    cy.get('.ant-popover .ant-select-selector').should('exist').first().click();

    cy.get('.ant-select-item-option')
      .first()
      .should('exist')
      .invoke('text')
      .then((text) => {
        cy.get('.ant-select-item-option').first().click();
        cy.get('[data-cy="priority"]')
          .contains('P1')
          .should('exist')
          .each((ele) => {
            cy.wrap(ele)
              .should('exist')
              .invoke('text')
              .then((innerText) => {
                expect(text).to.include(innerText);
              });
          });
      });
  });
});

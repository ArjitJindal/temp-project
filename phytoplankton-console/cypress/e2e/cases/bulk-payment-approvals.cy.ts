import { skipOn } from '@cypress/skip-test';
import { checkQAUrl } from './../../../src/utils/qaUrl';
describe('Bulk approval of payments', () => {
  beforeEach(() => {
    cy.loginByForm();
  });
  it('testing bulk approval of payments', () => {
    const isQAenv = checkQAUrl();
    isQAenv ? skipOn(true) : skipOn(false);
    cy.visit('/settings/transactions');
    cy.intercept('POST', '**/transactions/action').as('approval-request');

    cy.get('input[role="switch"]').then((toggle) => {
      const isChecked = toggle.attr('aria-checked') === 'true';
      if (isChecked) {
        // If the toggle is active (checked)
        cy.visit('/case-management/cases');
      } else {
        // If the toggle is inactive (unchecked), click it to activate
        cy.get('input[role="switch"]').click({ force: true });
        cy.visit('/case-management/cases');
      }
    });
    cy.contains('Payment approval').click();
    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 20000 })
      .should('exist')
      .each((element, index) => {
        if (index < 3) {
          // this will ensure only the first three elements are clicked
          cy.wrap(element).click({ force: true });
        }
      });

    cy.contains('Allow').click();
    cy.intercept('GET', '**/transactions**').as('bulk-approval-request');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.wait('@approval-request').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });

    cy.get('[data-cy="status-button"]').click({ force: true });

    // Then wait for the dropdown item with "Allowed" to be visible
    cy.contains('li.ant-dropdown-menu-item', 'Allowed').should('be.visible').click();

    cy.get('h2').first().click();

    cy.wait('@bulk-approval-request', { timeout: 15000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
  });
});

import { skipOn } from '@cypress/skip-test';
import { checkQAUrl } from './../../../src/utils/qaUrl';
describe('Approval of payments', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should change the status of a payment on approval', () => {
    const isQAenv = checkQAUrl();
    isQAenv ? skipOn(true) : skipOn(false);

    cy.visit('/settings');
    cy.intercept('POST', '/transactions/action').as('approval-request');
    cy.contains('Payment Approval', { timeout: 15000 }).click();

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

    cy.get('input[data-cy="row-table-checkbox').first().click();
    cy.contains('Allow').click();
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.wait('@approval-request').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
  });
});

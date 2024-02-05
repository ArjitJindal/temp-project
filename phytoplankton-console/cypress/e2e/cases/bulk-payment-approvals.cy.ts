import { PERMISSIONS } from '../../support/permissions';
describe('Bulk approval of payments', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_DETAILS,
    ...PERMISSIONS.SETTINGS_ORGANIZATION,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      settings: { isPaymentApprovalEnabled: true },
    });
  });
  it('testing bulk approval of payments', () => {
    cy.intercept('POST', '**/transactions/action').as('approval-request');
    cy.visit('/case-management/cases');
    cy.contains('Payment approval').click();

    for (let i = 0; i < 3; i++) {
      cy.get('input[data-cy="row-table-checkbox"]').eq(i).click();
    }

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

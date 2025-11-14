import { PERMISSIONS } from '../../support/permissions';
describe('Approval of payments', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_DETAILS,
    ...PERMISSIONS.SETTINGS_ORGANIZATION,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.CASE_REOPEN,
    ...PERMISSIONS.ACCOUNTS,
    ...PERMISSIONS.ROLES,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      settings: { isPaymentApprovalEnabled: true },
    });
  });

  it('should change the status of a payment on approval', () => {
    cy.intercept('POST', '**/transactions/action').as('approval-request');
    cy.visit('/case-management/cases');
    cy.waitNothingLoading();
    cy.contains('Payment approval').click();
    cy.waitNothingLoading();
    cy.get('input[data-cy="row-table-checkbox', { timeout: 20000 }).first().click();
    cy.contains('Allow').click();
    allowTransaction();
  });

  it('testing bulk approval of payments', () => {
    cy.intercept('POST', '**/transactions/action').as('approval-request');
    cy.visit('/case-management/cases');
    cy.contains('Payment approval').click();

    // count of transaction available to select
    cy.get('input[data-cy="row-table-checkbox"]')
      .its('length')
      .then((count) => {
        const availableSuspendedTransaction = count;
        if (availableSuspendedTransaction > 1) {
          // enough transactions to select
          for (let i = 0; i < Math.min(3, availableSuspendedTransaction); i++) {
            cy.get('input[data-cy="row-table-checkbox"]').eq(i).click();
          }

          cy.get('[data-cy="table-footer"]').contains('Allow').click();
          cy.intercept('GET', '**/transactions**').as('bulk-approval-request');
          cy.waitNothingLoading();
          allowTransaction();

          cy.get('[data-cy="status-button"]').click();
          cy.contains('li.ant-dropdown-menu-item', 'Approved').should('be.visible').click();
          cy.get('h2').first().click();
          cy.wait('@bulk-approval-request', { timeout: 15000 })
            .its('response.statusCode')
            .should('be.oneOf', [200, 304]);
        }
      });
  });
});

function allowTransaction() {
  cy.get('[role="dialog"]').within(() => {
    cy.waitNothingLoading();
    cy.selectOptionsByLabel('Reason', ['False positive']);
    cy.get('[data-cy="comment-textbox"]').eq(0).type('This is a test');
    cy.get('[data-cy="modal-ok"]').eq(0).click();
  });
  cy.wait('@approval-request', { timeout: 15000 })
    .its('response.statusCode')
    .should('be.oneOf', [200, 304]);
}

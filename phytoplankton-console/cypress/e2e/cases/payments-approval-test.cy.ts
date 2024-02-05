import { PERMISSIONS } from '../../support/permissions';
describe('Approval of payments', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_DETAILS,
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
    cy.contains('Payment approval').click();
    cy.get('input[data-cy="row-table-checkbox', { timeout: 20000 })
      .should('exist')
      .first()
      .click({ force: true });
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

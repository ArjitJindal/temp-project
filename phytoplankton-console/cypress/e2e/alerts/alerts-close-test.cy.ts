import { PERMISSIONS } from '../../support/permissions';

describe('Close Alerts from Table', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_REOPEN,
    ...PERMISSIONS.CASE_DETAILS,
  ];

  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('should close and re-open an alert', () => {
    // Close an alert
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL_ALERTS&alertStatus=OPEN');
    cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
    cy.caseAlertAction('Close');
    cy.intercept('PATCH', '**/alerts/statusChange').as('alert');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title').click();
    cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@alert').its('response.statusCode').should('eq', 200);

    // Re-open the closed alert
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL_ALERTS&alertStatus=CLOSED',
    );
    cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
    cy.caseAlertAction('Re-Open');
    cy.get('button[data-cy="modal-ok"]').eq(0).click();
    cy.wait('@alert').its('response.statusCode').should('eq', 200);
  });
});

import { PERMISSIONS } from '../../support/permissions';

describe('Close Alerts from Table', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_REOPEN,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.NOTIFICATIONS,
    ...PERMISSIONS.SANCTIONS,
  ];

  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { NOTIFICATIONS: true, SANCTIONS: true },
    });
  });

  it('should close and re-open an alert', () => {
    // Close an alert
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL_ALERTS&alertStatus=OPEN&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
    cy.get('td[data-cy="alertId"] a[data-cy="alert-id"]').first().invoke('text').as('alertIdValue');
    cy.caseAlertAction('Close');
    cy.confirmIfRequired();
    cy.intercept('PATCH', '**/alerts/statusChange').as('alert');
    cy.get('[data-cy~="modal"][data-cy~="open"]').within(() => {
      cy.get('[data-cy="modal-title"]').should('contain', 'Close');
      cy.waitNothingLoading();
      cy.selectOptionsByLabel('Reason', ['False positive']);
      cy.get('.ant-modal-title').click();
      cy.get('.toastui-editor-ww-container').type('This is a test');
      cy.get('button').contains('Confirm').click();
    });
    cy.get('.ant-modal-content:visible').within(() => {
      cy.get('[data-cy="modal-title"]').should('contain', 'Confirm action');
      cy.get('button').contains('Confirm').click();
    });
    cy.wait('@alert').its('response.statusCode').should('eq', 200);

    // Re-open the closed alert
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL_ALERTS&alertStatus=CLOSED',
    );
    cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
    cy.caseAlertAction('Re-Open');
    cy.get('button[data-cy="modal-ok"]').eq(0).click();
    cy.wait('@alert').its('response.statusCode').should('eq', 200);
    cy.get('@alertIdValue').then((alertId) => {
      cy.checkNotification([
        `‘cypress+custom@flagright.com’ changed status of an alert ‘${alertId}’`,
      ]);
    });
  });
});

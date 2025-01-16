import { PERMISSIONS } from '../../support/permissions';

describe('QA Assignee Column', () => {
  let qaFlag = false;
  beforeEach(() => {
    const REQUIRED_PERMISSIONS = [
      ...PERMISSIONS.CASE_OVERVIEW,
      ...PERMISSIONS.QA,
      ...PERMISSIONS.CASE_DETAILS,
      ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ];
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS, features: { QA: qaFlag } });
  });

  it('should not be present when QA feature flag is turned off', () => {
    cy.visit('/case-management/cases');
    cy.reload();
    cy.contains('QA assignee').should('not.exist');
    qaFlag = true;
  });

  it('should be present when QA feature flag is turned on', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=QA_UNCHECKED_ALERTS&alertStatus=CLOSED&qaAssignment=auth0%7C66f2d9df0b24d36a04cc31a2&filterQaStatus=NOT_QA%27d',
    );
    cy.get('[data-cy="qa-toggle"]').click();
    cy.contains('QA assignee').should('exist');

    //to check if the QA assigned to column is present inside the alert investigation view
    cy.get('[data-cy="alert-id"]')
      .first()
      .invoke('text')
      .then((alertIdText) => {
        const alertId = alertIdText.trim();
        cy.contains(alertId).click();
        cy.contains(alertId).should('exist');
        cy.contains('QA assigned to').should('exist');

        //check if the qa Assigned to is same in QA table and Alert table corresponding to the alert id
        cy.contains('td', alertId)
          .parent()
          .find('.ant-select-selection-item')
          .first()
          .invoke('text')
          .then((qaAssignedToText) => {
            const qaAssignedTo = qaAssignedToText.trim();
            cy.visit('/case-management/cases');
            cy.contains('td', alertId)
              .parent()
              .find('.ant-select-selection-item')
              .contains(qaAssignedTo);
          });
      });
  });
});

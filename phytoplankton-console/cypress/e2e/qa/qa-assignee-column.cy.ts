describe('QA Assignee Column', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should not be present when QA feature flag is turned off', () => {
    cy.visit('/case-management/cases');
    cy.toggleFeature('QA', true);
    cy.reload();
    cy.contains('QA assignee').should('not.exist');
  });

  it('should be present when QA feature flag is turned on', () => {
    cy.visit('/case-management/cases');
    cy.toggleFeature('QA', true);
    cy.reload();
    cy.get('.ant-space-item').click();
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

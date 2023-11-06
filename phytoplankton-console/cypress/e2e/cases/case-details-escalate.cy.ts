describe('Escalate a case from case-details', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  const selectCase = () => {
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN');
    cy.get('[data-cy="case-id"]', { timeout: 15000 }).eq(0).invoke('text').as('caseId');
    cy.get('[data-cy="case-id"]').eq(0).click();
  };

  const escalateCase = () => {
    cy.get('button[data-cy="status-options-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
      .should('exist')
      .click();
    cy.intercept('POST', '**/cases/*/escalate').as('escalate');
    cy.multiSelect('.ant-modal', 'Fraud');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@escalate').its('response.statusCode').should('eq', 200);
  };

  it('should escalate a case from case details and send it back', () => {
    selectCase();
    escalateCase();

    // Verify navigation to the escalated cases page
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED');
    cy.get('a[data-cy="case-id"]', { timeout: 15000 }).eq(0).should('exist');
  });

  it('should escalate a case from case details then close it and re-open it', () => {
    selectCase();
    escalateCase();
    //Need to wait because an alert appears which covers the Close button which wraps the close button and makes it impossible to select
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(6000);

    // Close the case
    cy.get('[data-cy="update-status-button"]').eq(0).should('exist').click();
    cy.intercept('PATCH', '**/cases/statusChange').as('case');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@case').its('response.statusCode').should('eq', 200);

    // Re-open the case
    cy.get('[data-cy="update-status-button"]').eq(0).should('exist').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@case').its('response.statusCode').should('eq', 200);
  });
});

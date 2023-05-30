describe('Escalating and Sending back the cases', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });

  it('should escalate a case and send it back', () => {
    cy.visit('/case-management/cases');

    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.get('a[data-cy="case-id"]').invoke('prop', 'title').as('caseId');

    cy.get('@caseId').then((text) => {
      const caseIdValue = text.trim();
      cy.get('button[data-cy="update-status-button"]', {
        timeout: 8000,
      })
        .eq(1)
        .click();
      cy.intercept('POST', `/console/cases/${caseIdValue}/escalate`).as('escalate');
      cy.multiSelect('.ant-modal', 'Fraud');
      cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
      cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
      cy.get('.ant-modal-footer button').eq(1).click();
      cy.get('.ant-modal-footer button').eq(3).click();
      cy.wait('@escalate').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
      });
      cy.get('button[data-cy="status-button"]').eq(0).click();
      cy.get('.ant-dropdown-menu-title-content').eq(2).click();

      cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
      cy.get('button[data-cy="update-status-button"]').eq(1).click();

      cy.intercept('POST', '/console/cases').as('case');
      cy.multiSelect('.ant-modal', 'False positive');
      cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
      cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
      cy.get('.ant-modal-footer button').eq(1).click();
      cy.get('.ant-modal-footer button').eq(3).click();
      cy.wait('@case').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
      });
    });
  });
});

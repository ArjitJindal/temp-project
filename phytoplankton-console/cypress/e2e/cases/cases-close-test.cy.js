describe('Closing and Re-Opening the cases', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });

  it('should close a case', () => {
    cy.visit('/case-management/cases');
    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.get('a[data-cy="case-id"]').invoke('prop', 'title').as('caseId');
    cy.get('@caseId').then((text) => {
      const caseIdValue = text.trim();
      cy.caseAlertAction('Close');
      cy.intercept('POST', '/console/cases').as('case');
      cy.multiSelect('.ant-modal', 'False positive');
      cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
      cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
      cy.get('.ant-modal-footer button').eq(1).click();
      cy.get('.ant-modal-footer button').eq(3).click();
      cy.wait('@case').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
      });
      cy.visit(
        '/case-management/cases?sort=-lastStatusChange.timestamp&showCases=ALL&caseStatus=CLOSED',
      );
      cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();
      cy.caseAlertAction('Re-Open');
      cy.get('.ant-modal-footer button').eq(1).click();
      cy.wait('@case').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
      });
      cy.get('table tbody tr').then((el) => {
        expect(el.length).to.gte(1);
      });
      cy.visit(
        `/case-management/cases?page=1&pageSize=100&showCases=ALL_ALERTS&caseId=${caseIdValue}&alertStatus=CLOSED`,
      );
      cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0);
      cy.get('input[data-cy="header-table-checkbox"]', { timeout: 15000 }).click();
      cy.caseAlertAction('Re-Open');
      cy.get('.ant-modal-footer button').eq(1).click();
    });
  });
});

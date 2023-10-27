describe('Filter according to case id', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should be able to filter according to case id', () => {
    cy.visit('/case-management/cases');
    let testCaseId = '';

    cy.get('[data-cy="caseId"]')
      .first()
      .should('exist')
      .then((caseid) => {
        testCaseId = caseid.text().substring(0, 3);
        expect(testCaseId.length).to.be.greaterThan(0);
        cy.get('[data-cy="case-id-button"]', { timeout: 15000 }).eq(0).click();
        cy.get('.ant-popover-inner-content input', { timeout: 15000 }).type(testCaseId);
        cy.url().should('include', 'caseId');
        cy.get('[data-cy="table-body"]').within(() => {
          cy.get('[data-cy="caseId"]').each(($element) => {
            const caseIdText = $element.text();
            cy.wrap(caseIdText).should('have.string', testCaseId);
          });
        });
      });
  });
});

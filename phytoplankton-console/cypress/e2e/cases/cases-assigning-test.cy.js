describe('Assigning single and multiple cases', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should assign single and multiple cases', () => {
    cy.visit('/case-management/cases');

    cy.get('[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.intercept('PATCH', '**/cases/assignments').as('case');
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
    });
    cy.get('[data-cy="header-table-checkbox"]').click();
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
    });
  });
});

/// <reference types="cypress" />

describe('login', () => {
  beforeEach(() => {
    // cy.loginByRequest();
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });

  it('should redirect to dashboard by default', () => {
    cy.visit('/');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/dashboard/analysis');
  });
});

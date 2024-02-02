/// <reference types="cypress" />

describe('login', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  it('should redirect to dashboard by default', () => {
    cy.visit('/');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/dashboard/analysis');
  });
});

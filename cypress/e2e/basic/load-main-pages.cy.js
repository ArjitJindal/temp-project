/// <reference types="cypress" />

describe('navigate sidebar', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });
  it('should load main pages', () => {
    /* eslint-disable cypress/no-unnecessary-waiting */
    cy.wait(3000); // wait a second or two for page to be redirected
    /* eslint-enable cypress/no-unnecessary-waiting */

    cy.visit('/case-management/cases');
    cy.get('h2', { timeout: 8000 }).contains('Case Management');
    cy.get('.ant-table', { timeout: 3000 });
    cy.get('.ant-table', { timeout: 3000 });
    cy.visit('/transactions/list');
    cy.get('h2', { timeout: 3000 }).contains('Transactions');
    cy.get('.ant-table', { timeout: 3000 });
    cy.visit('/users/list/business/all');
    cy.get('.ant-table', { timeout: 3000 });
    cy.visit('/users/list/consumer/all');
    cy.get('.ant-table', { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('Users');
    cy.visit('/rules/rules-library');
    cy.get('.ant-table', { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('Rules Library');
    cy.visit('/rules/my-rules');
    cy.get('.ant-table', { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('My Rules');
  });
});

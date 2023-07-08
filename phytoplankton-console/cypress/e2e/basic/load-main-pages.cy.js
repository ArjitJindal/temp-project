/// <reference types="cypress" />
const TABLE_SELECTOR = '[data-test="table"]';

describe('navigate sidebar', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });
  it('should load main pages', () => {
    cy.visit('/case-management/cases');
    cy.get('h2', { timeout: 8000 }).contains('Case Management');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.visit('/transactions/list');
    cy.get('h2', { timeout: 3000 }).contains('Transactions');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.visit('/users/list/business/all');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.visit('/users/list/consumer/all');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('Users');
    cy.visit('/rules/rules-library');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('Rules Library');
    cy.visit('/rules/my-rules');
    cy.get(TABLE_SELECTOR, { timeout: 3000 });
    cy.get('h2', { timeout: 3000 }).contains('My Rules');
  });

  it('should load entity details', () => {
    cy.visit('/transactions/list', { timeout: 20000 });
    cy.get(TABLE_SELECTOR).should('exist');
    cy.get(TABLE_SELECTOR, { timeout: 20000 })
      .should('be.visible')
      .then(($table) => {
        expect($table).to.exist;
      })
      .first()
      .should('have.length.gt', 0)
      .find('a[data-cy="transaction-id"]', { timeout: 10000 })
      .should('be.visible')
      .eq(0)
      .click({ force: true });
    cy.contains('div[role="tab"]', 'Transaction Details').should('be.visible');

    cy.visit('/case-management/cases', { timeout: 8000 });
    cy.get(TABLE_SELECTOR).should('exist');
    cy.get(TABLE_SELECTOR, { timeout: 20000 })
      .should('be.visible')
      .then(($table) => {
        expect($table).to.exist;
      })
      .first()
      .should('have.length.gt', 0)
      .find('a[data-cy="case-id"]', { timeout: 10000 })
      .should('be.visible')
      .eq(0)
      .click({ force: true });
    cy.contains('div[role="tab"]', 'Alerts').should('be.visible');

    cy.visit('/users/list/consumer/all', { timeout: 8000 });
    cy.get(TABLE_SELECTOR).should('exist');
    cy.get(TABLE_SELECTOR, { timeout: 20000 })
      .should('be.visible')
      .then(($table) => {
        expect($table).to.exist;
      })
      .first()
      .should('have.length.gt', 0)
      .find('a[data-cy="consumer-user-id"]', { timeout: 10000 })
      .should('be.visible')
      .eq(0)
      .click({ force: true });
    cy.contains('h3', 'User Details').should('be.visible');

    cy.visit('/users/list/business/all', { timeout: 8000 });
    cy.get(TABLE_SELECTOR).should('exist');
    cy.get(TABLE_SELECTOR, { timeout: 20000 })
      .should('be.visible')
      .then(($table) => {
        expect($table).to.exist;
      })
      .first()
      .should('have.length.gt', 0)
      .find('a[data-cy="business-user-id"]', { timeout: 10000 })
      .should('be.visible')
      .eq(0)
      .click({ force: true });
    cy.contains('h3', 'User Details').should('be.visible');
  });
});

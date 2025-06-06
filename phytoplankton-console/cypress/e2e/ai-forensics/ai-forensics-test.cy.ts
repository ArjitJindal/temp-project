import { PERMISSIONS } from '../../support/permissions';

describe('Investigative Copilot', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.USERS_USER_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
  ];

  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: {
        AI_FORENSICS: true,
        ENTITY_LINKING: true,
        NARRATIVE_COPILOT: true,
        CLICKHOUSE_ENABLED: true,
      },
    });
  });

  it('should open investigate with copilot', () => {
    // Go to the alerts page
    cy.visit('/case-management/cases?showCases=ALL_ALERTS');
    cy.get('[data-cy="investigate-button"]').first().click({
      force: true,
    });

    // Check if the mode is opening
    cy.get('.ant-modal-title')
      .first()
      .should('exist')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal('AI Forensics');
      });

    cy.intercept('GET', '**/questions/**').as('query');

    // See if the natural language query works
    cy.get('[data-cy="investigation-input"]').type('Show me transactions for the last 180 days');
    cy.get('[data-cy="ask-ai-button"]').first().click();
    cy.get('.ant-modal-root table tr', { timeout: 60000 }).should((tableRows) => {
      expect(tableRows.length).to.be.greaterThan(1);
    });

    // Check autocomplete works
    cy.get('[data-cy="investigation-input"]').type('Aler', { timeout: 20000 });
    cy.get('[data-cy="investigation-suggestion-button"]')
      .eq(0)
      .should((button) => {
        expect(button).to.contain('Alert transactions');
      })
      .click();
    cy.get('[data-cy="investigation-input"]').clear();
    // Go through each question type
    ['TRS score', 'Ontology', 'User details', 'Transactions by rule action'].forEach((text) => {
      cy.get('[data-cy="investigation-input"]').type(text);
      cy.get('[data-cy="investigation-suggestion-button"]').contains(text).click();
      cy.get('[data-cy="investigation-input"]').clear();
    });

    cy.get('.ant-modal-title').parents('.ant-modal-header').find('button').click();

    // Navigate back to the same alert
    cy.reload();
    cy.get('[data-cy="investigate-button"]').first().click({
      force: true,
    });

    cy.wait('@query', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);
  });
});

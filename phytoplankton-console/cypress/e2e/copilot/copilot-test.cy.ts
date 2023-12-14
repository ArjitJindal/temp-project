describe('Investigative Copilot', () => {
  beforeEach(() => {
    cy.loginByForm();
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
    cy.get('.ant-modal-root table tr').should((tableRows) => {
      expect(tableRows.length).to.be.greaterThan(1);
    });

    cy.wait('@query', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);

    // Check autocomplete works
    cy.get('[data-cy="investigation-input"]').type('Aler');
    cy.get('[data-cy="investigation-suggestion-button"]')
      .eq(0)
      .should((button) => {
        expect(button).to.contain('Alerts');
      })
      .click();

    cy.wait('@query', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);

    // Go through each question type
    ['TRS score', 'Entity linking', 'User details', 'Transactions by rule action'].forEach(
      (text) => {
        cy.get('[data-cy="investigation-input"]').type(text);
        cy.get('[data-cy="investigation-suggestion-button"]').contains(text).click();
      },
    );

    cy.wait('@query', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);
    cy.get('.ant-modal-title').parents('.ant-modal-header').find('button').click();

    // Navigate back to the same alert
    cy.reload();
    cy.get('[data-cy="investigate-button"]').first().click({
      force: true,
    });

    cy.wait('@query', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);
  });
});

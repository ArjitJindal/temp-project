describe('Accounts - CRUD Test', () => {
  beforeEach(() => {
    cy.loginByRole('admin');
  });

  it('perform crud operation on accounts in team management', async () => {
    cy.visit('/accounts/team');
    const randomNumber = Math.floor(Math.random() * 10000);
    const randomEmail = `test-crud-${randomNumber}@gmail.com`;

    //Create a new account
    cy.contains('Invite').click();
    cy.intercept('POST', '**/accounts**').as('accounts');
    cy.get('input[data-cy="accounts-email"]').type(randomEmail);
    cy.get('.ant-select-selector').click();
    cy.get('.ant-select-item-option-content').contains('Developer').click();
    cy.get('button[data-cy="accounts-invite"]').click();
    cy.closeDrawer();
    cy.wait(`@accounts`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //Update the added account

    cy.contains('td', randomEmail).parent().find('button[data-cy="accounts-edit-button"]').click();

    cy.get('.ant-select-selector').click();
    cy.get('.ant-select-item-option-content').contains('Analyst').click();
    cy.get('button[data-cy="accounts-invite"]').click();
    cy.intercept('GET', '**/accounts**').as('update');
    cy.closeDrawer();
    cy.wait(`@update`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //Delete the added account
    cy.intercept('GET', '**/accounts**').as('delete');
    cy.contains('td', randomEmail)
      .parent()
      .find('button[data-cy="accounts-delete-button"]')
      .click();

    cy.get('.ant-select-selection-search-input').click().type('cypress+admin@flagright.com{enter}');
    cy.get('button[data-cy="delete-account"]').click();
    cy.wait(`@delete`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
  });
});

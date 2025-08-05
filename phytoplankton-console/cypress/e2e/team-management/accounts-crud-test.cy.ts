describe('Accounts - CRUD Test', () => {
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: [],
      features: {
        ADVANCED_WORKFLOWS: true,
      },
      loginWithRole: 'admin',
      settings: {
        limits: {
          seats: 10,
        },
      },
    });
  });

  it('perform crud operation on accounts in team management', () => {
    cy.visit('/accounts/team');
    cy.waitNothingLoading();

    const randomNumber = Math.floor(Math.random() * 10000);
    const randomEmail = `test-cypress-${randomNumber}@gmail.com`;

    //Create a new account
    cy.contains('Invite').click();
    cy.intercept('POST', '**/accounts**').as('accounts');
    cy.get('input[data-cy="accounts-email"]').type(randomEmail);
    cy.singleSelect('', 'Developer');
    cy.get('input[data-cy="checker"]').click();
    cy.get('button[data-cy="modal-ok"]').click();
    cy.wait(`@accounts`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //Update the added account

    cy.contains('td', randomEmail).parent().find('button[data-cy="accounts-edit-button"]').click();

    cy.wait(1000); // eslint-disable-line cypress/no-unnecessary-waiting
    cy.singleSelect('', 'Analyst');

    cy.get('button[data-cy="modal-ok"]').click();
    cy.intercept('GET', '**/accounts**').as('update');
    cy.wait(`@update`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    // Lets wait for the account to be updated and things to refresh
    cy.wait(2000); // eslint-disable-line cypress/no-unnecessary-waiting
    //Delete the added account
    cy.intercept('GET', '**/accounts**').as('delete');
    cy.contains('td', randomEmail)
      .parent()
      .find('button[data-cy="accounts-delete-button"]')
      .click();

    cy.get('div[data-cy="delete-user-reassign-to"]').type('cypress+admin@flagright.com{enter}');
    cy.get('button[data-cy="delete-account"]').click();
    cy.wait(`@delete`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
  });
});

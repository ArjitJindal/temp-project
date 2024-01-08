describe('Switching from one tenant to another', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should switch from one tenant to another', () => {
    cy.intercept('GET', '**/tenants').as('tenants');
    cy.visit('/');

    // Wait for tenants to load
    cy.wait('@tenants').its('response.statusCode').should('be.oneOf', [200, 304]);

    // Switch to 'FlagrightPostman'
    cy.get("button[data-cy='superadmin-panel-button']").click({ force: true });
    cy.get('.ant-modal .ant-select')
      .first()
      .contains('Cypress Tenant')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    cy.get(`div[data-cy='FlagrightPostman']`).last().click();

    // Wait for tenant switch
    cy.wait('@changeTenant').its('response.statusCode').should('eq', 200);

    // Verify tenant switch
    cy.get("button[data-cy='superadmin-panel-button']").contains('FlagrightPostman');

    // Switch to 'Cypress Tenant'
    cy.get("button[data-cy='superadmin-panel-button']").click();
    cy.get('.ant-modal .ant-select')
      .first()
      .contains('FlagrightPostman')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    cy.get(`div[data-cy='Cypress Tenant']`).last().click();

    // Wait for tenant switch
    cy.wait('@changeTenant').its('response.statusCode').should('eq', 200);

    // Verify tenant switch
    cy.get("button[data-cy='superadmin-panel-button']").contains('Cypress Tenant');
  });
});

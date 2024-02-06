// TODO: Unskip in FR-4252
describe.skip('Switching from one tenant to another', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  it('should switch from one tenant to another', () => {
    cy.intercept('GET', '**/tenants').as('tenants');
    cy.visit('/');

    // Wait for tenants to load
    cy.wait('@tenants', { timeout: 20000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    // Switch to 'FlagrightPostman'
    cy.get("button[data-cy='superadmin-panel-button']").click({ force: true });
    cy.get('label[data-cy="tenant-name"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click()
      .type('FlagrightPostman{enter}');

    // Wait for tenant switch
    cy.wait('@changeTenant').its('response.statusCode').should('eq', 200);

    // Verify tenant switch
    cy.get("button[data-cy='superadmin-panel-button']").contains('FlagrightPostman');

    // Switch to 'Cypress Tenant'
    cy.get("button[data-cy='superadmin-panel-button']").click();
    cy.get('label[data-cy="tenant-name"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click()
      .type('Cypress Tenant{enter}');

    // Wait for tenant switch
    cy.wait('@changeTenant').its('response.statusCode').should('eq', 200);

    // Verify tenant switch
    cy.get("button[data-cy='superadmin-panel-button']").contains('Cypress Tenant');
  });
});

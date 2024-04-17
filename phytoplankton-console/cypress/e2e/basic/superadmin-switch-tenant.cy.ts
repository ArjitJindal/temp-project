describe('Switching from one tenant to another', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  it('should switch from one tenant to another', () => {
    cy.checkAndSwitchToTenant('FlagrightPostman');
    cy.checkAndSwitchToTenant('Cypress Tenant');
  });
});

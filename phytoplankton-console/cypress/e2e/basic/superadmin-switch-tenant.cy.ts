describe('Switching from one tenant to another', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should switch from one tenant to another', () => {
    cy.intercept('GET', '**/tenants').as('tenants');
    cy.visit('/');
    cy.intercept('POST', '**/change_tenant').as('changeTenant');
    cy.wait('@tenants', { timeout: 15000 }).then((tenantsInterception) => {
      expect(tenantsInterception.response?.statusCode).to.be.oneOf([200, 304]);
      cy.get("button[data-cy='superadmin-panel-button']").click({ force: true });
      cy.get('.ant-modal .ant-select').first().click();
      cy.get(`div[data-cy='FlagrightPostman']`).last().click();
      cy.wait('@changeTenant', { timeout: 15000 }).then((changeTenantInterception) => {
        expect(changeTenantInterception.response?.statusCode).to.eq(200);
        cy.get("button[data-cy='superadmin-panel-button']").contains('FlagrightPostman');
        cy.intercept('GET', '**/tenants').as('tenants');
        cy.intercept('POST', '**/change_tenant').as('changeTenant');
        cy.wait('@tenants', { timeout: 15000 }).then((newTenantsInterception) => {
          expect(newTenantsInterception.response?.statusCode).to.be.oneOf([200, 304]);
          cy.get("button[data-cy='superadmin-panel-button']").click();
          cy.get('.ant-modal .ant-select').first().click();
          cy.get(`div[data-cy='Cypress Tenant']`).last().click();
          cy.wait('@changeTenant', { timeout: 15000 }).then((changeTenantInterception) => {
            expect(changeTenantInterception.response?.statusCode).to.eq(200);
            cy.get("button[data-cy='superadmin-panel-button']").contains('Cypress Tenant');
          });
        });
      });
    });
  });
});

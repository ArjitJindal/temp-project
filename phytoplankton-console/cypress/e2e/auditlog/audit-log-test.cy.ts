import promisify from 'cypress-promise';
describe('Audit log filter - entity type', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should filter according to entity type', async () => {
    cy.visit('/auditlog');
    cy.get('[data-cy="rules-filter"]').filter(':contains("Entity")').eq(0).should('exist').click();
    cy.get('.ant-checkbox-wrapper').filter(':contains("CASE")').should('exist').first().click();
    cy.get('[data-cy="auditlog-entity-confirm"]').should('exist').click();
    cy.get('h2').first().click();
    cy.get('[data-cy="auditlog-primary"]')
      .should('exist')
      .each(async (ele) => {
        cy.wrap(ele)
          .should('exist')
          .invoke('text')
          .then((innerText) => {
            expect('CASE').include(innerText);
          });
      });
    cy.get('[data-cy="rules-filter"]').filter(':contains("Entity")').eq(0).should('exist').click();
    cy.get('[data-cy="auditlog-entity-reset"]').should('exist').click();
    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Entity ID")')
      .eq(0)
      .should('exist')
      .click();
    cy.get('h2').first().click();
    const text2 = await promisify(
      cy.get('[data-cy="auditlog-secondary"]').first().should('exist').invoke('text'),
    );
    cy.get('.ant-popover-inner-content input', { timeout: 15000 })
      .eq(8)
      .type(text2, { force: true });
    cy.get('[data-cy="auditlog-secondary"]')
      .should('exist')
      .each(async (ele) => {
        cy.wrap(ele)
          .should('exist')
          .invoke('text')
          .then((innerText) => {
            expect(text2).include(innerText);
          });
      });
  });
});

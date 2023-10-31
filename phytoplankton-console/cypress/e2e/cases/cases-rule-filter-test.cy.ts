import promisify from 'cypress-promise';
describe('Case rule filter testing', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should filter according to rule name', async () => {
    cy.visit('/case-management/cases');
    cy.get('[data-cy="segmented-control-all-alerts"]').should('exist').click();
    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Add filter")')
      .eq(0)
      .should('exist')
      .click();
    cy.get('[data-cy="rulesHitFilter-checkbox"]').then(($checkbox) => {
      if (!$checkbox.prop('checked')) {
        cy.get('[data-cy="rulesHitFilter-checkbox"]').click();
      }
    });
    cy.get('[data-cy="rules-filter"]').filter(':contains("Rules")').eq(0).should('exist').click();
    cy.get('.ant-popover .ant-select-selector').should('exist').first().click();
    const text = await promisify(
      cy.get('.ant-select-item-option').first().should('exist').invoke('text'),
    );
    cy.get('.ant-select-item-option').first().should('exist').click();
    cy.get('h2').first().click();
    cy.get('[data-cy="ruleName"]')
      .should('exist')
      .each(async (ele) => {
        cy.wrap(ele)
          .should('exist')
          .invoke('text')
          .then((innerText) => {
            expect(text).include(innerText);
          });
      });
  });
});

describe('Case rule filter testing', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should filter according to rule name', () => {
    cy.visit('/case-management/cases');
    cy.get('[data-cy="segmented-control-all-alerts"]').should('exist').click();
    cy.get('[data-cy="rules-filter"]')
      .filter(':contains("Alert status")')
      .eq(0)
      .should('exist')
      .click();
    cy.get('li[data-cy="OPEN"]').should('exist').first().click();
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

    const ruleName = 'Transaction amount too high';
    cy.get('.ant-select-item-option').filter(`:contains("${ruleName}")`).first().click();
    cy.get('td[data-cy="ruleName"]')
      .contains(ruleName)
      .should('exist')
      .each((ele) => {
        cy.wrap(ele)
          .should('exist')
          .invoke('text')
          .then((innerText) => {
            expect(innerText).to.include(ruleName);
          });
      });
  });
});

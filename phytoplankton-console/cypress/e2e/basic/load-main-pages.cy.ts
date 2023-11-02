describe('navigate sidebar', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should load main pages', () => {
    cy.navigateToPage('/case-management/cases', 'Case management');
    cy.navigateToPage('/transactions/list', 'Transactions');
    cy.navigateToPage('/users/list/business/all', 'Users');
    cy.navigateToPage('/rules/rules-library', 'Rules library');
    cy.navigateToPage('/rules/my-rules', 'My rules');
  });

  it('should load entity details', () => {
    cy.navigateToPage('/transactions/list', 'Transactions');
    cy.clickTableRowLink(0, 'transaction-id', 'Transaction details');

    cy.navigateToPage('/case-management/cases', 'Case management');
    cy.clickTableRowLink(0, 'case-id', 'Alerts');

    cy.navigateToPage('/users/list/consumer/all', 'Users');
    cy.clickTableRowLink(0, 'consumer-user-id', 'User details');

    cy.navigateToPage('/users/list/business/all', 'Users');
    cy.clickTableRowLink(0, 'business-user-id', 'User details');
  });
});

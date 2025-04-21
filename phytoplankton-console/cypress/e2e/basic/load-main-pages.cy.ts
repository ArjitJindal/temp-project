describe('navigate sidebar', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  const navigateToRulesPage = (url: string, title: string) => {
    cy.visit(`/rules/${url}`);
    cy.get(`div[aria-selected='true'][class='ant-tabs-tab-btn']`).eq(0).contains(title);
    cy.get('[data-test="table"]');
  };

  it('should load main pages', () => {
    cy.navigateToPage('/case-management/cases', 'Case management');
    cy.navigateToPage('/transactions/list', 'Transactions');
    cy.navigateToPage('/users/list/business/all', 'Users');
    navigateToRulesPage('my-rules', 'My rules');
    navigateToRulesPage('rules-library', 'Templates');
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

describe('Check if the widget selector works as expected', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  it('should check the visibility of selected widgets', () => {
    const WIDGETS = [
      'OVERVIEW',
      'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL',
      'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL',
      'TOP_CONSUMER_USERS_BY_RULE_HITS',
      'CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS',
      'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS',
      'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL',
      'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL',
      'TOP_BUSINESS_USERS_BY_RULE_HITS',
      'BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS',
      'BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS',
      'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION',
      'DISTRIBUTION_BY_PAYMENT_METHOD',
      'DISTRIBUTION_BY_TRANSACTION_TYPE',
      'TRANSACTIONS_BREAKDOWN_BY_TRS',
      'TOP_RULE_HITS_BY_COUNT',
      'DISTRIBUTION_BY_RULE_PRIORITY',
      'DISTRIBUTION_BY_RULE_ACTION',
      'DISTRIBUTION_BY_CLOSING_REASON',
      'DISTRIBUTION_BY_ALERT_PRIORITY',
      'DISTRIBUTION_BY_CASE_AND_ALERT_STATUS',
      'TEAM_OVERVIEW',
    ];

    cy.visit('/');
    //enabling Risk Scoring feature flag
    cy.get('[data-cy="superadmin-panel-button"]').click();
    cy.get('.ant-modal .ant-select-selector').eq(1).should('be.visible').click();
    cy.contains('Risk Scoring').click();
    cy.get('[data-cy="modal-ok"]').click({ force: true });
    cy.get('.ant-modal-content').find('svg').first().click();
    cy.get('button[data-cy="dashboard-configure-button"]').click();

    // Make all widgets invisible
    WIDGETS.map((widget) => {
      cy.get(`input[data-cy='${widget}-checkbox']`).click();
    });
    cy.get('button[data-cy="update-dashboard-button"]').click();
    cy.get('svg[data-cy="drawer-close-button"]').click();

    // One by one check exixtance of every widget by check its corressponding widget selector
    WIDGETS.map((widget) => {
      cy.get('button[data-cy="dashboard-configure-button"]').click();
      cy.get(`input[data-cy='${widget}-checkbox']`).click();
      cy.get('button[data-cy="update-dashboard-button"]').click();
      cy.get('svg[data-cy="drawer-close-button"]').click();
      cy.get(`div[data-cy='${widget}']`).should('exist');
    });
  });
});

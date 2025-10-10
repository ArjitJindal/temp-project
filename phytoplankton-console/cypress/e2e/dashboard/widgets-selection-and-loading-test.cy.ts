const WIDGETS = {
  OVERVIEW: 'dashboard_stats/overview',
  CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL: 'dashboard_stats/users/**',
  CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL: 'dashboard_stats/users/**',
  TOP_CONSUMER_USERS_BY_RULE_HITS: 'dashboard_stats/users/**',
  CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS: 'dashboard_stats/hits_per_user**',
  CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS: 'dashboard_stats/kyc-status-distribution/**',
  BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL: 'consumer/**',
  BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL: 'dashboard_stats/users/**',
  TOP_BUSINESS_USERS_BY_RULE_HITS: 'dashboard_stats/hits_per_user**',
  BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS: 'dashboard_stats/kyc-status-distribution**',
  BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS: 'business/**',
  TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION: 'dashboard_stats/transactions/**',
  DISTRIBUTION_BY_PAYMENT_METHOD: 'dashboard_stats/transactions/**',
  DISTRIBUTION_BY_TRANSACTION_TYPE: 'dashboard_stats/transactions/**',
  TRANSACTIONS_BREAKDOWN_BY_TRS: 'dashboard_stats/transactions/**',
  TOP_RULE_HITS_BY_COUNT: 'dashboard_stats/rule_hit**',
  DISTRIBUTION_BY_RULE_PRIORITY: 'rule_instances',
  DISTRIBUTION_BY_RULE_ACTION: 'rule_instances',
  DISTRIBUTION_BY_CLOSING_REASON: 'dashboard_stats/closing_reason_distribution**',
  DISTRIBUTION_BY_ALERT_PRIORITY: 'dashboard_stats/alert_priority_distribution**',
  DISTRIBUTION_BY_CASE_AND_ALERT_STATUS: 'dashboard_stats/alert_and_case_status_distribution**',
  TEAM_OVERVIEW: 'dashboard_stats/team**',
  QA_ALERTS_BY_RULE_HITS: 'dashboard_stats/qa/alerts-by-rule-hit**',
  QA_OVERVIEW: 'dashboard_stats/qa/overview**',
  QA_ALERTS_BY_ASSIGNEE: 'dashboard_stats/qa/alerts-by-assignee**',
};

describe('Dashboard Integration Test', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
    cy.toggleFeatures({ RISK_SCORING: true, RISK_LEVELS: true, QA: true });
  });

  it('should check the visibility of selected widgets', () => {
    cy.visit('/');

    cy.get('button[data-cy="dashboard-configure-button"]').click();

    // Make all widgets invisible
    Object.keys(WIDGETS).map((widget) => {
      cy.get(`input[data-cy='${widget}-checkbox']`).click();
    });
    cy.get('button[data-cy="update-dashboard-button"]').click();

    // One by one check existence of every widget
    Object.keys(WIDGETS).map((widget) => {
      cy.get('button[data-cy="dashboard-configure-button"]').click();
      cy.get(`input[data-cy='${widget}-checkbox']`).click();
      cy.get('button[data-cy="update-dashboard-button"]').click();
      cy.get(`div[data-cy='${widget}']`).should('exist');
    });
  });
});

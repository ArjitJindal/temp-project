describe('Dashboard Integration Test', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should configure the dashboard with selected widgets', async () => {
    cy.visit('/');
    const WIDGETS = {
      Overview: 'dashboard_stats/overview',
      'Consumer users distribution by risk levels': 'dashboard_stats/users/**',
      'Consumer users breakdown by risk levels': 'dashboard_stats/users/**',
      'Top consumer users by rule hits': 'dashboard_stats/users/**',
      'Consumer users distribution by KYC status': 'dashboard_stats/hits_per_user**',
      'Consumer users distribution by user status': 'dashboard_stats/kyc-status-distribution/**',
      'Business users distribution by risk levels': 'consumer/**',
      'Business users breakdown by risk levels': 'dashboard_stats/users/**',
      'Top business users by rule hits': 'dashboard_stats/hits_per_user**',
      'Business users distribution by KYC status': 'dashboard_stats/kyc-status-distribution**',
      'Business users distribution by user status': 'business/**',
      'Transactions breakdown by rule action': 'dashboard_stats/transactions/**',
      'Distribution by payment method': 'dashboard_stats/transactions/**',
      'Distribution by transaction type': 'dashboard_stats/transactions/**',
      'Transactions breakdown by TRS': 'dashboard_stats/transactions/**',
      'Top rule hits by count': 'dashboard_stats/rule_hit**',
      'Distribution by rule priority': 'rule_instances',
      'Distribution by rule action': 'rule_instances',
      'Distribution by closing reason': 'dashboard_stats/closing_reason_distribution**',
      'Distribution by open alert priority': 'dashboard_stats/alert_priority_distribution**',
      'Distribution by status': 'dashboard_stats/alert_and_case_status_distribution**',
      'Team overview': 'dashboard_stats/team**',
    };

    const endpoints = [
      '/dashboard_stats/**',
      '/dashboard_stats/users/**',
      '/dashboard_stats/hits_per_user**',
      '/dashboard_stats/kyc-status-distribution*',
      '/consumer/**',
      '/dashboard_stats/users/**',
      '/dashboard_stats/hits_per_user**',
      '/dashboard_stats/kyc-status-distribution*',
      '/business/**',
      '/dashboard_stats/transactions**',
      '/dashboard_stats/transactions/**',
      '/dashboard_stats/transactions/**',
      '/dashboard_stats/**',
      '/dashboard_stats/**',
      '/dashboard_stats/**',
      '/dashboard_stats/**',
      '/dashboard_stats/**',
    ];

    endpoints.forEach((endpoint) => {
      const alias = `apiCall${endpoint}`;
      cy.intercept('GET', endpoint).as(alias);
    });

    endpoints.forEach((endpoint) => {
      const alias = `apiCall${endpoint}`;
      cy.wait(`@${alias}`, { timeout: 30000 })
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);
    });

    cy.get('button[data-cy="dashboard-configure-button"]').click();
    Object.keys(WIDGETS).forEach((widget) => {
      cy.get(`input[data-cy='${widget}-checkbox']`).then(($checkbox) => {
        if ($checkbox.prop('checked')) {
          cy.get(`input[data-cy='${widget}-checkbox']`).click();
        }
      });
    });

    cy.get('button[data-cy="update-dashboard-button"]').click();
    cy.get('svg[data-cy="drawer-close-button"]').click();

    cy.get('button[data-cy="dashboard-configure-button"]').click();

    cy.intercept('GET', 'dashboard_stats/**').as('dashboard_stats_Alias');
    cy.intercept('GET', 'business/**').as('businessAlias');
    cy.intercept('GET', 'consumer/**').as('consumerAlias');

    Object.keys(WIDGETS).forEach((widget) => {
      cy.get(`input[data-cy='${widget}-checkbox']`).then(($checkbox) => {
        if (!$checkbox.prop('checked')) {
          cy.get(`input[data-cy='${widget}-checkbox']`).click();
        }
      });
    });

    cy.get('button[data-cy="update-dashboard-button"]').click();

    cy.get('svg[data-cy="drawer-close-button"]').click();

    Cypress._.times(3, () => {
      cy.wait('@dashboard_stats_Alias', { timeout: 15000 })
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);
    });

    cy.wait('@businessAlias', { timeout: 15000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
    cy.wait('@consumerAlias', { timeout: 15000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
  });
});

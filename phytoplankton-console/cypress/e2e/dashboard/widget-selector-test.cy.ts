describe('Check if the widget selector works as expected', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should check the visibility of selected widgets', () => {
    const WIDGETS = [
      // 'Consumer users distribution by risk levels',
      'Consumer users breakdown by risk levels',
      'Top consumer users by rule hits',
      'Consumer users distribution by KYC status',
      'Consumer users distribution by user status',
      // 'Business users distribution by risk levels',
      'Business users breakdown by risk levels',
      'Top business users by rule hits',
      'Business users distribution by KYC status',
      'Business users distribution by user status',
      'Transactions breakdown by rule action',
      'Distribution by payment method',
      'Distribution by transaction type',
      'Transactions breakdown by TRS',
      'Top rule hits by count',
      'Distribution by rule priority',
      'Distribution by rule action',
      'Distribution by closing reason',
      'Distribution by open alert priority',
      'Distribution by status',
      'Team overview',
    ];
    cy.visit('/');
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

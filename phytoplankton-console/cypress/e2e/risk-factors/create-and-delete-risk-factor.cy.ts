describe('Create and delete risk factor', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('create, update and delete risk factor', () => {
    cy.toggleFeature('Risk Scoring', true);
    cy.intercept('POST', '**/pulse/risk-parameter').as('riskFactor');
    createRiskFactor();
    updateRiskFactor();
    deleteRiskFactor();
  });
});

function createRiskFactor() {
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="expand-icon"]').eq(0).click();
  cy.get('.ant-select-selection-overflow').click();
  cy.get('.ant-select-item-option-content').eq(0).click({ force: true });
  cy.get('label[data-cy="risk-level-MEDIUM"]').eq(1).click();
  cy.get('button[data-cy="add-risk-factor"]').click();
  cy.get('button[data-cy="save-risk-factor"]').click();
  cy.wait('@riskFactor', { timeout: 15000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
  });
}

function updateRiskFactor() {
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="expand-icon"]').eq(0).click();
  cy.get('label[data-cy="risk-level-HIGH"]').eq(1).click();
  cy.get('button[data-cy="save-risk-factor"]').click();
  cy.wait('@riskFactor', { timeout: 15000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
  });
}

function deleteRiskFactor() {
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="expand-icon"]').eq(0).click();
  cy.get('button[data-cy="delete-risk-factor"]').click();
  cy.get('button[data-cy="save-risk-factor"]').click();
  cy.wait('@riskFactor', { timeout: 15000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
  });
}

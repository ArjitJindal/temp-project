import { PERMISSIONS } from '../../support/permissions';

describe('Create and delete risk factor', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.RISK_SCORING_RISK_FACTORS];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { RISK_SCORING: true, RISK_LEVELS: true },
    });
  });

  it('create, update and delete risk factor', () => {
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
  cy.get('.ant-select-item-option-content').eq(0).click();
  cy.get('[data-cy="risk-level-MEDIUM"]').eq(1).click();
  cy.get('button[data-cy="add-risk-factor"]').click();
  cy.get('button[data-cy="save-risk-factor"]').click();
  cy.wait('@riskFactor', { timeout: 15000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
  });
}

function updateRiskFactor() {
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="expand-icon"]').eq(0).click();
  cy.get('[data-cy="risk-level-HIGH"]').eq(1).click();
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

import { PERMISSIONS } from '../../support/permissions';

describe('Create and update risk factor', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.RISK_SCORING_RISK_FACTORS,
    ...PERMISSIONS.RISK_SCORING_RISK_LEVELS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { RISK_SCORING: true, RISK_LEVELS: true, RULES_ENGINE_V8: true },
    });
  });

  it('create, update and delete risk factor', () => {
    cy.intercept('POST', '**/risk-factors').as('riskFactor');
    cy.intercept('PUT', '**/risk-factors').as('updateRiskFactor');
    createRiskFactor();
    cy.wait('@riskFactor', { timeout: 15000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const id = interception.response?.body?.id;
      expect(id).to.not.be.null;
      updateRiskFactor(id);
    });
  });
});

/* eslint-disable cypress/no-unnecessary-waiting */
function createEntityVariable(entityText: string, type: 'USER' | 'TRANSACTION') {
  cy.get('button[data-cy~="add-variable-v8"]').first().click();
  cy.get('[role="menuitem"]').contains('Entity variable').click();
  if (type === 'USER') {
    cy.get('input[data-cy~="variable-user-nature-v8-checkbox"]').eq(0).click(); // Added for consumer user nature
  } else {
    cy.singleSelect('[data-cy~="variable-entity-v8"]', 'Transaction ID');
  }
  cy.getInputContainerByLabel('Entity').within(() => {
    cy.singleSelect('', entityText);
  });
  cy.get('button[data-cy="modal-ok"]').first().click();
}

function addCondition(variableName, value) {
  cy.contains('button', 'Add logic').click();
  cy.get('.query-builder .group-or-rule-container')
    .last()
    .within(() => {
      cy.singleSelect('', 0);
      cy.get('[data-cy="value-source"] [data-cy~="input"]').click().type(`${value}`);
    });
}

function createRiskFactor() {
  cy.intercept('POST', '**/logic-config').as('logicConfig');
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="create-risk-factor-button"]').click();
  cy.waitNothingLoading();
  cy.getInputByLabel('Risk factor name', 'input').type('Test Risk Factor');
  cy.getInputByLabel('Risk factor description', 'input').type('Test Description');
  cy.get('button[data-cy="drawer-next-button-v8"]').click();
  cy.wait('@logicConfig', { timeout: 120000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
    cy.wait(1000);
    createEntityVariable('User ID (origin or destination)', 'TRANSACTION');
    addCondition('user id', '123');
    cy.getInputByLabel('Risk score', 'input').type('50');
    cy.get('input[data-cy="input text-input"]').last().type('0.27');
    cy.get('button[data-cy="modal-ok"]').click();
    cy.get('button[data-cy="drawer-create-save-button"]').click();
    cy.message('Risk factor created successfully').should('exist');
  });
}

function updateRiskFactor(riskFactorId: string) {
  cy.visit('risk-levels/risk-factors/transaction');
  cy.get('button[data-cy="edit-risk-factors-button"]').click();

  // scroll to the risk factor
  cy.get(`[title="${riskFactorId}"]`).scrollIntoView().click({});

  cy.location().should((loc) => {
    expect(loc.pathname).to.eq(`/risk-levels/risk-factors/transaction/${riskFactorId}/read`);
  });

  cy.get('button[data-cy="edit-button"]').click();
  cy.get('[data-cy="risk-level-VERY_HIGH"]');
  cy.get('button[data-cy="drawer-create-save-button"]').click();
  cy.get('button[data-cy="version-history-save-button"]').click();
  cy.get('div[data-cy="version-history-modal-content"]').within(() => {
    cy.get('textarea').type('Test comment');
  });
  cy.get('button[data-cy="modal-ok"]').click();
  cy.message('Changes applied successfully!').should('exist');
}

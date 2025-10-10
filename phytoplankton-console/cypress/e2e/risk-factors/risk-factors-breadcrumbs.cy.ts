import { PERMISSIONS } from '../../support/permissions';

describe('Breadcrumbs check in risk factors', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.RISK_SCORING_RISK_FACTORS,
    ...PERMISSIONS.SIMULATION,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { RISK_SCORING: true, RISK_LEVELS: true, SIMULATOR: true },
    });
  });

  it('check breadcrumbs in risk factors', () => {
    cy.visit('risk-levels/risk-factors');
    nonSimulationModeCheck();
    switchSimulationMode();
    simulationModeCheck();
    switchSimulationMode();
    nonSimulationModeCheck();
  });
});

function simulationModeCheck() {
  cy.get('[id="breadcrumb-link"]').last().should('have.text', 'Simulate');
  cy.get('[data-cy="simulation-history-link"]').click();
  cy.get('[id="breadcrumb-link"]').last().should('have.text', 'Simulation history');
}

function nonSimulationModeCheck() {
  cy.selectSegmentedControl('Consumer'); // need to updated navigation
  cy.get('[id="breadcrumb-link"]').last().should('have.text', 'Consumer');
  cy.selectSegmentedControl('Business');
  cy.get('[id="breadcrumb-link"]').last().should('have.text', 'Business');
  cy.selectSegmentedControl('Transaction');
  cy.get('[id="breadcrumb-link"]').last().should('have.text', 'Transaction');
}

function switchSimulationMode() {
  cy.get('[data-cy="simulation-toggle"]').eq(0).click();
}

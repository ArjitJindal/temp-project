import { PERMISSIONS } from '../../support/permissions';

describe('Rule create and delete from rule instance page', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.RULES];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('should create a rule, edit and delete it ', () => {
    cy.visit('/rules/rules-library');
    cy.intercept('POST', '**/rule_instances').as('createdRule');
    cy.get('button[data-cy="configure-rule-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
    cy.get('button[data-cy="modal-ok"]').eq(0).click();
    cy.wait('@createdRule').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const ruleInstanceId = interception.response?.body?.id;
      cy.message(`Rule created - ${ruleInstanceId}`).should('exist');
      editRule(ruleInstanceId);
      simulateRule(ruleInstanceId);
      deleteRule(ruleInstanceId);
    });
  });
  function deleteRule(ruleInstanceId: string) {
    cy.visit(`/rules/my-rules/${ruleInstanceId}`);
    cy.wait(2000); // eslint-disable-line cypress/no-unnecessary-waiting

    cy.get('button[data-cy="rule-instance-page-delete-rule-button"]')
      .first()
      .should('exist')
      .click({ force: true });

    cy.get('[data-cy="modal-title"]').should('contain', ruleInstanceId);
    cy.get('button[data-cy="modal-ok"]').eq(0).should('exist').click({ force: true });
    cy.message(`Rule deleted`).should('exist');
  }

  function editRule(ruleInstanceId: string) {
    cy.visit(`/rules/my-rules/${ruleInstanceId}`);
    cy.get('button[data-cy="rule-instance-page-edit-rule-button"]')
      .first()
      .should('exist')
      .click({ force: true });
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('input[data-cy="rule-action-selector"]').eq(2).click();
    cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
    cy.message(`Rule updated - ${ruleInstanceId}`).should('exist');
  }

  function simulateRule(ruleInstanceId: string) {
    cy.visit(`/rules/my-rules/${ruleInstanceId}`);
    cy.get('button[data-cy="rule-instance-page-simulate-rule-button"]')
      .first()
      .should('exist')
      .click({ force: true });
    cy.get('button[data-cy="run-simulation-button"]').first().should('exist');
  }
});

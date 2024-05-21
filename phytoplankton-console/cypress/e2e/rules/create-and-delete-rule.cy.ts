import { PERMISSIONS } from '../../support/permissions';

describe('Rule create and delete', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.RULES];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('should create a rule and delete it', () => {
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
      deleteRule(ruleInstanceId);
    });
  });
  function deleteRule(ruleInstanceId: string) {
    cy.visit('/rules/my-rules');
    cy.get('th').contains('Updated at').click({ force: true });
    cy.get('th').contains('Updated at').click({ force: true });
    cy.wait(2000); // eslint-disable-line cypress/no-unnecessary-waiting

    cy.get('button[data-cy="rule-delete-button"]').first().should('exist').click({ force: true });

    cy.get('[data-cy="modal-title"]').should('contain', ruleInstanceId);
    cy.get('button[data-cy="modal-ok"]').eq(0).should('exist').click({ force: true });
    cy.message(`Rule deleted`).should('exist');
  }

  function editRule(ruleInstanceId: string) {
    cy.visit('/rules/my-rules');
    cy.get('td[data-cy="ruleId"]', { timeout: 15000 }).each((element, index) => {
      const ruleId = element[0].innerText;
      if (ruleId.includes(ruleInstanceId)) {
        cy.get('button[data-cy="rule-edit-button"]').eq(index).click();
        cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
        cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
        cy.get('input[data-cy="rule-action-selector"]').eq(2).click();
        cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
        cy.message(`Rule updated - ${ruleInstanceId}`).should('exist');
      }
    });
  }
});

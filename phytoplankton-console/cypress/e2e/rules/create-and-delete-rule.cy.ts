describe('Rule create and delete', () => {
  beforeEach(() => {
    cy.loginByForm();
  });
  it('should create a rule and delete it', () => {
    cy.visit('/rules/rules-library');
    cy.intercept('POST', '**/rule_instances').as('createdRule');
    cy.get('button[data-cy="configure-rule-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
    cy.wait('@createdRule').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const ruleInstanceId = interception.response?.body?.id;
      cy.message(`Rule created - R-1 (${ruleInstanceId})`).should('exist');
      editRule(ruleInstanceId);
      deleteRule(ruleInstanceId);
    });
  });
  function deleteRule(ruleInstanceId: string) {
    cy.visit('/rules/my-rules');
    cy.get('td[data-cy="ruleId"]', { timeout: 15000 }).each((element, index) => {
      const ruleId = element[0].innerText;
      if (ruleId.includes(ruleInstanceId)) {
        cy.get('button[data-cy="rule-delete-button"]')
          .eq(+index)
          .should('exist')
          .click({ force: true });
        cy.get('div .ant-modal-header').should('contain', ruleInstanceId);
        cy.get('button[data-cy="modal-ok"]').eq(0).should('exist').click({ force: true });
        cy.message(`Rule deleted`).should('exist');
      }
    });
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
        cy.message(`Rule updated - R-1 (${ruleInstanceId})`).should('exist');
      }
    });
  }
});

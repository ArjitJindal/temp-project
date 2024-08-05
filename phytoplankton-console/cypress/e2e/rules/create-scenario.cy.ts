describe('Create scenario', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
    cy.toggleFeatures({ RISK_LEVELS: true, RULES_ENGINE_V8: true });
  });

  it('should create a transaction rule!', () => {
    ruleCreationFlow('TRANSACTION');
  });

  it('should create a user rule!', () => {
    ruleCreationFlow('USER');
  });

  function ruleCreationFlow(type: 'USER' | 'TRANSACTION') {
    cy.visit('/rules/rules-library');
    cy.intercept('POST', '**/rule_instances').as('createdRule');

    cy.intercept('GET', '**/rule-logic-config').as('ruleLogicConfig');
    //Basic details
    cy.contains('Create rule').click();
    cy.get('input[placeholder="Enter rule name"]').type('Scenario 1');
    cy.get('input[placeholder="Enter rule description"]').type('Description of the scenario');
    cy.get('[data-cy="rule-nature"]').within(() => {
      cy.contains('AML').click();
    });

    cy.get('[data-cy="rule-type"]').within(() => {
      cy.contains(`${type === 'TRANSACTION' ? 'Transaction' : 'User'}`).click();
    });

    if (type === 'USER') {
      cy.get('[data-cy="rule-is-run-when"]').within(() => {
        cy.contains('User is created/updated').click();
      });
    }

    //Rule is hit when
    cy.get('button[data-cy="drawer-next-button-v8"]').first().click();
    createAggregationVariable('Variable 1', 'type');
    if (type === 'USER') {
      createEntityVariable('User id', type);
    } else {
      createEntityVariable('type', type);
    }
    cy.get('button[data-cy="add-logic-v8"]').click();
    cy.waitNothingLoading();
    if (type === 'USER') {
      addCondition('User / id{enter}', '123');
    } else {
      addCondition('Transaction / type{enter}', 'Deposit{enter}');
    }
    addCondition('Variable 1', 5);
    cy.get('[data-cy="apply-to-risk-levels"]')
      .click()
      .type(
        'Low{downarrow}{enter}Medium{downarrow}{enter}High{downarrow}{enter}Very high{downarrow}{enter}',
      );
    cy.get('button[data-cy="apply-to-risk-levels-button"]').click();
    checkConditionsCount(2, 'LOW');
    checkConditionsCount(2, 'HIGH');
    cy.get('button[data-cy="drawer-next-button-v8"]').first().click();

    cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
    cy.get('button[data-cy="modal-ok"]').eq(0).click();

    cy.wait('@createdRule').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const ruleInstanceId = interception.response?.body?.id;
      cy.message(`Rule created - ${ruleInstanceId}`).should('exist');
      editRule(ruleInstanceId);
      cy.visit(`/rules/my-rules/${ruleInstanceId}`);
      cy.deleteRuleInstance(ruleInstanceId);
    });
  }

  function editRule(ruleInstanceId: string) {
    cy.visit('/rules/my-rules');
    cy.get('td[data-cy="ruleId"]', { timeout: 15000 }).each((element, index) => {
      const ruleId = element[0].innerText;
      if (ruleId.includes(ruleInstanceId)) {
        cy.get('button[data-cy="rule-edit-button"]').eq(index).click();
        cy.get('button[data-cy="drawer-next-button-v8"]').click();
        checkConditionsCount(2, 'LOW');
        checkConditionsCount(2, 'MEDIUM');
        checkConditionsCount(2, 'HIGH');
        checkConditionsCount(2, 'VERY_HIGH');
        checkConditionsCount(2, 'VERY_LOW');
        createAggregationVariable('Variable 2', 'transaction id');
        addCondition('Variable 2', 10);
        cy.get('input[data-cy="rule-action-selector"]').eq(1).click();
        cy.get('[data-cy="apply-to-risk-levels"]')
          .click()
          .type('Medium{downarrow}{enter}Very high{downarrow}{enter}');
        cy.get('button[data-cy="apply-to-risk-levels-button"]').click();
        checkConditionsCount(2, 'LOW');
        checkConditionsCount(2, 'HIGH');
        checkConditionsCount(3, 'MEDIUM');
        checkConditionsCount(3, 'VERY_HIGH');
        cy.get('button[data-cy="drawer-next-button-v8"]').click();
        cy.get('button[data-cy="drawer-create-save-button"]').click();
        cy.message(`Rule updated - ${ruleInstanceId}`).should('exist');
      }
    });
  }

  function addCondition(variableName, value) {
    cy.contains('button', 'Add condition').click();
    cy.get('.query-builder .group-or-rule-container')
      .last()
      .within(() => {
        cy.get('[data-cy="logic-variable"]').click().type(`${variableName}{enter}`);
        cy.get('.widget--has-valuerscs').click().type(`${value}{enter}`);
      });
  }

  function createEntityVariable(entityText: string, type: 'USER' | 'TRANSACTION') {
    cy.get('button[data-cy="add-variable-v8"]').first().click();
    cy.get('[role="menuitem"]').contains('Entity variable').click();
    if (type === 'USER') {
      cy.get('input[data-cy="variable-user-nature-v8-checkbox"]').eq(0).click(); // Added for consumer user nature
    } else {
      cy.get('input[data-cy="variable-type-v8"]').eq(0).click();
    }
    cy.get('[data-cy="variable-entity-v8"]').click().type(`${entityText}`).type(`{enter}`);
    cy.get('button[data-cy="modal-ok"]').first().click();
  }

  function createAggregationVariable(variableName, variableAggregateField) {
    cy.get('button[data-cy="add-variable-v8"]').first().click();
    cy.get('[role="menuitem"]').contains('Aggregate variable').click();
    cy.get('input[data-cy="variable-name-v8"]').type(`${variableName}`).blur();
    cy.get('input[data-cy="variable-tx-direction-v8"]').eq(0).click();
    cy.wait('@ruleLogicConfig').then((interception) => {
      expect(interception.response?.statusCode).to.oneOf([200, 304]);
      cy.get('[data-cy="variable-aggregate-field-v8"]')
        .click()
        .type(`${variableAggregateField}`)
        .type(`{enter}`);
      cy.get('[data-cy="variable-aggregate-function-v8"]').click().type('Count{enter}');
      cy.get('button[data-cy="modal-ok"]').first().click();
    });
  }

  function checkConditionsCount(count, riskLevel) {
    cy.get(`[data-cy="risk-level-${riskLevel}"]`).click();
    cy.get('.rule.group-or-rule').should('have.length', count);
  }
});

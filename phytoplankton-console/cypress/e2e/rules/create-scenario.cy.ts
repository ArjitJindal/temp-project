// todo: fix
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

    cy.intercept('POST', '**/logic-config').as('ruleLogicConfig');
    //Basic details
    cy.contains('Create scenario').click();
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
    cy.wait('@ruleLogicConfig', { timeout: 120000 }).then((interception) => {
      expect(interception.response?.statusCode).to.oneOf([200, 304]);
      createAggregationVariable('Variable 2', 'type', type);
      if (type === 'USER') {
        createEntityVariable('User ID', type);
      } else {
        createEntityVariable('Type', type);
      }
      cy.get('button[data-cy="add-logic-v8"]').click();
      cy.waitNothingLoading();
      if (type === 'USER') {
        addCondition('Variable 1', '123', true, true);
      } else {
        addCondition('Variable 1', 'Deposit', true, true);
      }
      addCondition('Variable 2', 5, false);
      cy.get('[data-cy~="apply-to-risk-levels"]').click();
      cy.get('div[data-cy="menu-item-label-LOW"]').click();
      cy.get('div[data-cy="menu-item-label-MEDIUM"]').click();
      cy.get('div[data-cy="menu-item-label-HIGH"]').click();
      cy.get('div[data-cy="menu-item-label-VERY_HIGH"]').click();
      cy.get('button[data-cy="apply-to-risk-levels-button"]').click();
      checkConditionsCount(2, 'LOW');
      checkConditionsCount(2, 'HIGH');
      cy.get('button[data-cy="drawer-next-button-v8"]').first().click();

      cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
      cy.get('button[data-cy="modal-ok"]').eq(0).click();

      cy.wait('@createdRule').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
        const ruleInstanceId = interception.response?.body?.id;
        cy.message('A new rule has been created successfully').should('exist');
        cy.messageBody(`rule ${ruleInstanceId}`).should('exist');
        editRule(ruleInstanceId, type);
        cy.visit(`/rules/my-rules/${ruleInstanceId}`);
        cy.deleteRuleInstance(ruleInstanceId);
      });
    });
  }

  function editRule(ruleInstanceId: string, type: 'TRANSACTION' | 'USER') {
    cy.visit('/rules/my-rules');
    cy.get('td[data-cy="ruleId"]', { timeout: 15000 }).each((element, index) => {
      const ruleId = element[0].innerText;
      if (ruleId.includes(ruleInstanceId)) {
        cy.get('button[data-cy="rule-edit-button"]').eq(index).click();
        cy.get('button[data-cy="drawer-next-button-v8"]').click();
        cy.wait('@ruleLogicConfig', { timeout: 120000 }).then((interception) => {
          expect(interception.response?.statusCode).to.oneOf([200, 304]);
          checkConditionsCount(2, 'LOW');
          checkConditionsCount(2, 'MEDIUM');
          checkConditionsCount(2, 'HIGH');
          checkConditionsCount(2, 'VERY_HIGH');
          checkConditionsCount(2, 'VERY_LOW');
          if (type === 'TRANSACTION') {
            createAggregationVariable('Variable 3', 'transaction id', type);
          } else {
            createAggregationVariable('Variable 3', 'user id', type);
          }
          addCondition('Variable 3', 10, true);
          cy.get('input[data-cy="rule-action-selector"]').eq(1).click();
          cy.get('[data-cy="apply-to-risk-levels"]').click();
          cy.get('div[title="Medium"]').click();
          cy.get('div[title="Very high"]').click();
          cy.get('button[data-cy="apply-to-risk-levels-button"]').click();
          checkConditionsCount(2, 'LOW');
          checkConditionsCount(2, 'HIGH');
          checkConditionsCount(3, 'MEDIUM');
          checkConditionsCount(3, 'VERY_HIGH');
          cy.get('button[data-cy="drawer-next-button-v8"]').click();
          cy.get('button[data-cy="drawer-create-save-button"]').click();
          cy.message(`Rule updated - ${ruleInstanceId}`).should('exist');
        });
      }
    });
  }

  function addCondition(variableName, value, isFirst, isValueSelect = false) {
    if (!isFirst) {
      cy.contains('button', 'Add condition').click();
    }
    cy.get('.query-builder .group-or-rule-container')
      .last()
      .within(() => {
        cy.get('[data-cy="logic-variable"] [data-cy~="input"]').click().type(`${variableName}`);
        cy.get('div[data-cy="label"]').contains('Variable').click();
        cy.get('[data-cy="logic-variable"] [data-cy~="input"]').click(); // this ensures that value is selected
        cy.get('[data-cy="value-source"] [data-cy~="input"]').click().type(`${value}`);
        cy.get('div[data-cy="label"]').contains('Variable').click();
        if (isValueSelect) {
          cy.get('[data-cy="value-source"] [data-cy~="input"]').click(); // this ensures that value is selected
        }
      });
  }
  /* eslint-disable cypress/no-unnecessary-waiting */
  function createEntityVariable(entityText: string, type: 'USER' | 'TRANSACTION') {
    cy.get('button[data-cy="add-variable-v8"]').first().click();
    cy.get('[role="menuitem"]').contains('Entity variable').click();
    cy.get('[data-cy="variable-name-v8"]').first().type('Variable 1');
    if (type === 'USER') {
      cy.get('input[data-cy="variable-user-nature-v8-checkbox"]').eq(0).click(); // Added for consumer user nature
    } else {
      cy.singleSelect('[data-cy~="variable-entity-v8"]', 'Transaction ID');
    }
    cy.get('[data-cy~="variable-entity-v8"]').click().type(`${entityText}`).wait(1);
    cy.get(`div[title="${entityText}"]`).click();
    cy.get('button[data-cy="modal-ok"]').first().click();
  }

  function createAggregationVariable(
    variableName,
    variableAggregateField,
    type: 'TRANSACTION' | 'USER',
  ) {
    cy.get('button[data-cy="add-variable-v8"]').first().click();
    cy.get('[role="menuitem"]').contains('Aggregate variable').click();
    cy.get('input[data-cy="variable-name-v8"]').type(`${variableName}`).blur();
    if (type === 'TRANSACTION') {
      cy.get('input[data-cy="variable-tx-direction-v8"]').eq(0).click();
    } else if (type === 'USER') {
      cy.get('input[data-cy="variable-type-v8"]').eq(1).click();
    }
    cy.get('[data-cy="variable-aggregate-field-v8"]')
      .click()
      .type(`${variableAggregateField}`)
      .type(`{enter}`);
    cy.singleSelect('[data-cy="variable-aggregate-function-v8"]', 'Unique count');
    cy.get('button[data-cy="modal-ok"]').first().click();
  }

  function checkConditionsCount(count, riskLevel) {
    cy.get(`[data-cy="risk-level-${riskLevel}"]`).click();
    cy.get('.rule.group-or-rule').should('have.length', count);
  }
});

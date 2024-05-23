import { skipOn } from '@cypress/skip-test';
import { random } from 'lodash';
import { checkQAUrl } from '../../../src/utils/qaUrl';
import { PERMISSIONS } from '../../support/permissions';
import { generateTransactionRequestBody, generateUserRequestBody } from '../../support/utils';
describe('Case Creation test', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.USERS_USER_OVERVIEW,
    ...PERMISSIONS.RULES,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.SETTINGS_DEVELOPER,
    ...PERMISSIONS.SETTINGS_ORGANIZATION,
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });
  it('should create a case when the rule is hit', () => {
    const isQAenv = checkQAUrl();
    isQAenv ? skipOn(true) : skipOn(false);
    const transactionId = `Tx-${random(0, 10000000)}`;
    const originUserId = `User-${random(0, 10000000)}`;
    const destinationUserId = `User-${random(0, 10000000)}`;
    cy.publicApiHandler('POST', 'consumer/users', generateUserRequestBody(originUserId));
    cy.publicApiHandler('POST', 'consumer/users', generateUserRequestBody(destinationUserId));

    //1.create rule
    cy.visit('/rules/rules-library');
    cy.intercept('POST', '**/rule_instances').as('createdRule');
    cy.get('button[data-cy="configure-rule-button"]').eq(1).click();
    const ruleName = 'Test rule : Transaction too high';
    cy.get('input[placeholder="Enter rule name"]').clear().type(ruleName);
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-next-button"]').eq(0).click();
    cy.get('button[data-cy="drawer-create-save-button"]').eq(0).click();
    cy.get('button[data-cy="modal-ok"]').eq(0).click();
    cy.wait('@createdRule').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      const ruleInstanceId = interception.response?.body?.id;
      cy.message(`Rule created - ${ruleInstanceId}`).should('exist');

      //2.create case and verify
      //making a post request to api.dev.flagright/transactions to hit the rule R-2
      const requestBody = generateTransactionRequestBody(
        transactionId,
        originUserId,
        destinationUserId,
      );

      cy.publicApiHandler('POST', 'transactions', requestBody);
      cy.visit('/case-management/cases');
      cy.intercept('GET', '**/cases**').as('case');

      cy.wait('@case').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
      });

      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(3000); // Give it some time to create the case

      cy.get('[data-cy="rules-filter"]').filter(':contains("Rules")').eq(0).should('exist').click();
      cy.get('.ant-popover .ant-select-selector')
        .should('exist')
        .first()
        .click()
        .type(`${ruleName} ${ruleInstanceId} (R-2){enter}`)
        .click();

      cy.contains(originUserId).should('exist');
      cy.contains(destinationUserId).should('exist');

      // 3. delete rule
      deleteRule(ruleInstanceId);
    });
  });
});
function deleteRule(ruleInstanceId: string) {
  cy.visit('/rules/my-rules');
  cy.get('th').contains('Updated at').click({ force: true });
  cy.get('th').contains('Updated at').click({ force: true });
  cy.waitNothingLoading();
  cy.get('button[data-cy="rule-delete-button"]').first().should('exist').click({ force: true });
  cy.get('[data-cy="modal-title"]').should('contain', ruleInstanceId);
  cy.get('button[data-cy="modal-ok"]').eq(0).should('exist').click({ force: true });
  cy.message(`Rule deleted`).should('exist');
}

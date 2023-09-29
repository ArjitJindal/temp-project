import { Interception } from 'cypress/types/net-stubbing';
import promisify from 'cypress-promise';

describe('Escalating and Sending back the cases', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should escalate a case and send it back', async () => {
    cy.visit('/case-management/cases');

    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.get('a[data-cy="case-id"]').invoke('prop', 'title').as('caseId');

    const caseId = await promisify(
      cy
        .get('a[data-cy="case-id"]')
        .eq(0)
        .then((ele) => ele.text()),
    );
    cy.caseAlertAction('Escalate');
    cy.intercept('POST', `**/cases/${caseId}/escalate`).as('escalate');
    cy.multiSelect('.ant-modal', 'Fraud');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('.ant-modal-footer button').eq(3).click();
    cy.wait('@escalate').then((interception: Interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED');
    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();
    cy.caseAlertAction('Send back');
    cy.intercept('PATCH', '**/cases/statusChange').as('case');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('.ant-modal-footer button').eq(3).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
  });
});

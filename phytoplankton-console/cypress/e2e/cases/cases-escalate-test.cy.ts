import { PERMISSIONS } from '../../support/permissions';

describe('Escalating and Sending back the cases', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW, ...PERMISSIONS.CASE_DETAILS];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { ADVANCED_WORKFLOWS: true },
    });
  });
  it('should escalate a case and send it back', () => {
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED');

    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.get('a[data-cy="case-id"]').invoke('prop', 'title').as('caseId');

    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.caseAlertAction('Escalate');
        cy.intercept('POST', `**/cases/${caseId}/escalate`).as('escalate');
        cy.multiSelect('.ant-modal', 'Fraud');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
        cy.get('.ant-modal-footer button').eq(0).click();
        cy.get('.ant-modal-footer button').eq(2).click();
        cy.wait('@escalate').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });

        cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED');
        cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();
        cy.caseAlertAction('Send back');
        cy.intercept('PATCH', '**/cases/statusChange').as('case');
        cy.multiSelect('.ant-modal', 'False positive');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
        cy.get('.ant-modal-footer button').eq(0).click();
        cy.get('.ant-modal-footer button').eq(2).click();
        cy.wait('@case').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
  });
});

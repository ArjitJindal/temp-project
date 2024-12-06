import { CaseStatus } from '../../../src/apis';
import { PERMISSIONS } from '../../support/permissions';

describe('Escalate a case from case-details', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.CASE_REOPEN,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { ADVANCED_WORKFLOWS: true, NOTIFICATIONS: true, MULTI_LEVEL_ESCALATION: false },
    });
  });
  const selectCase = (status: CaseStatus[]) => {
    cy.visit(
      `/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL&caseStatus=${status.join(
        '%2C',
      )}`,
    );
    cy.get('[data-cy="case-id"]', { timeout: 15000 }).eq(0).invoke('text').as('caseId');
    cy.get('[data-cy="case-id"]').eq(0).click();
  };

  const escalateCase = () => {
    cy.get('button[data-cy="status-options-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
      .contains('Escalate')
      .should('exist')
      .click();
    cy.intercept('POST', '**/cases/*/escalate').as('escalate');
    cy.multiSelect('.ant-modal', 'Fraud');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@escalate').its('response.statusCode').should('eq', 200);
  };

  it('should escalate a case from case details then close it and re-open it', () => {
    selectCase(['OPEN', 'REOPENED']);
    escalateCase();

    cy.waitNothingLoading();
    // Close the case
    selectCase(['ESCALATED']);
    cy.get('[data-cy="update-status-button"]').eq(0).should('exist').click();
    cy.intercept('PATCH', '**/cases/statusChange').as('case');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@case').its('response.statusCode').should('eq', 200);

    // Re-open the case

    selectCase(['CLOSED']);
    cy.get('[data-cy="update-status-button"]').contains('Re-Open').eq(0).should('exist').click();
    cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(0).click();
    cy.wait('@case').its('response.statusCode').should('eq', 200);
  });

  it('should escalate a case from case details and send it back', () => {
    cy.loginByRole('admin');
    selectCase(['OPEN', 'REOPENED']);
    escalateCase();

    cy.waitNothingLoading();
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );

    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((_caseId) => {
        cy.get('[data-cy="case-id"]').eq(0).click();

        cy.get('button[data-cy="status-options-button"]').eq(0).click();
        cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
          .contains('Send back')
          .should('exist')
          .click();

        cy.intercept('PATCH', '**/cases/statusChange').as('case');
        cy.multiSelect('.ant-modal', 'False positive');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@case').its('response.statusCode').should('eq', 200);
        cy.message(
          `The case status and all 'Escalated' alert statuses under it are changed to 'Open'.`,
        ).should('exist');
        cy.message(
          `The case status and all 'Escalated' alert statuses under it are changed to 'Open'.`,
        ).should('not.exist');

        // cy.checkNotification([
        //   `‘cypress+custom@flagright.com’ escalated a case ‘${caseId}’ to you.`,
        // ]);
      });
  });
});

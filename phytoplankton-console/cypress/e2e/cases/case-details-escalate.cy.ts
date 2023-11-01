import { Interception } from 'cypress/types/net-stubbing';
describe('Escalate a case from case-details', () => {
  beforeEach(() => {
    cy.loginByForm();
  });
  it('should escalate a case from case details and send it back', () => {
    cy.visit('/case-management/cases');
    cy.get('[data-cy="case-id"]', { timeout: 15000 })
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.get('[data-cy="case-id"]', { timeout: 15000 }).eq(0).click();
        cy.get('button[data-cy="status-options-button"]').eq(0).should('exist').click();
        cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
          .should('exist')
          .click();
        cy.intercept('POST', `**/cases/${caseId}/escalate`).as('escalate');
        cy.multiSelect('.ant-modal', 'Fraud');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@escalate').then((interception: Interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED');
    cy.get('a[data-cy="case-id"]', { timeout: 15000 })
      .eq(0)
      .should('exist')
      .then(() => {
        cy.get('a[data-cy="case-id"]', { timeout: 15000 }).eq(0).click();
        cy.get('button[data-cy="status-options-button"]').eq(0).should('exist').click();
        cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
          .should('exist')
          .click();
        cy.intercept('PATCH', '**/cases/statusChange').as('case');
        cy.multiSelect('.ant-modal', 'False positive');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@case').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
  });

  it('should escalate a case from case details then close it and re-open it', () => {
    cy.visit('/case-management/cases');
    cy.get('[data-cy="case-id"]', { timeout: 15000 })
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.get('[data-cy="case-id"]', { timeout: 15000 }).eq(0).click();
        cy.get('button[data-cy="status-options-button"]').eq(0).click();
        cy.get('.ant-dropdown-menu-title-content > [data-cy="update-status-button"]')
          .should('exist')
          .click();
        cy.intercept('POST', `**/cases/${caseId}/escalate`).as('escalate');
        cy.multiSelect('.ant-modal', 'Fraud');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@escalate').then((interception: Interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=ESCALATED');
    cy.get('a[data-cy="case-id"]', { timeout: 15000 })
      .eq(0)
      .should('exist')
      .then(() => {
        cy.get('a[data-cy="case-id"]', { timeout: 15000 }).eq(0).click();
        cy.get('[data-cy="update-status-button"]').eq(0).should('exist').click();
        cy.intercept('PATCH', '**/cases/statusChange').as('case');
        cy.multiSelect('.ant-modal', 'False positive');
        cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
        cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@case').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
        cy.get('[data-cy="update-status-button"]').eq(0).should('exist').click();
        cy.get('.ant-modal-footer button[data-cy="modal-ok"]').eq(1).click();
        cy.wait('@case').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
  });
});

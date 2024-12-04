import { PERMISSIONS } from '../../support/permissions';

describe('Closing and Re-Opening the cases', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.CASE_REOPEN,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.NOTIFICATIONS,
    ...PERMISSIONS.SANCTIONS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: {
        NOTIFICATIONS: true,
      },
    });
  });
  it('should close a case', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.caseAlertAction('Close');

        closeCase();

        cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=CLOSED');
        cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();
        cy.caseAlertAction('Re-Open');
        cy.get('.ant-modal-footer button').eq(0).click();
        cy.wait('@case').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });

        cy.get('table tbody tr').then((el) => {
          expect(el.length).to.be.gte(1);
        });

        cy.visit(
          `/case-management/cases?page=1&pageSize=100&showCases=ALL_ALERTS&caseId=${caseId}&alertStatus=CLOSED`,
        );
        cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0);
        cy.get('input[data-cy="header-table-checkbox"]', { timeout: 15000 }).eq(0).click();
        cy.caseAlertAction('Re-Open');
        cy.get('.ant-modal-footer button').eq(0).click();
        cy.checkNotification([
          `‘cypress+custom@flagright.com’ changed status of a case ‘${caseId}’`,
        ]);
      });
  });

  it('testing bulk closing of cases with alerts selected', () => {
    const caseIds: string[] = [];
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    // Getting the caseId
    cy.get('a[data-cy="case-id"]', { timeout: 20000 })
      .should('exist')
      .each((element, index) => {
        if (index < 3) {
          caseIds.push(element.text());
        }
      });
    //   Selecting at max 3 cases
    for (let i = 0; i < 3; i++) {
      cy.get('input[data-cy="row-table-checkbox"]').eq(i).click();
    }
    // Expanding first case
    cy.get('button[data-cy="expand-icon"]', { timeout: 2000 }).should('exist').eq(0).click();
    cy.get('input[data-cy="header-table-checkbox"]').eq(1).click();
    cy.get('div[data-cy="table-footer"]', {
      timeout: 8000,
    })
      .eq(1)
      .within(() => {
        cy.get('button[data-cy="update-status-button"]').contains('Close').click();
      });

    closeCase();

    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=CLOSED');
    caseIds.sort();
    // Verifies if the cases are actually closed
    cy.get('a[data-cy="case-id"]', { timeout: 20000 })
      .should('exist')
      .each((element, index) => {
        if (index < 3) {
          expect(caseIds).to.include.members([element.text()]);
        }
      });

    cy.checkNotification(
      caseIds.map(
        (caseId) => `‘cypress+custom@flagright.com’ changed status of a case ‘${caseId}’`,
      ),
    );
  });
});

function closeCase() {
  cy.intercept('PATCH', '**/cases/statusChange').as('case');
  cy.multiSelect('.ant-modal', 'False positive');
  cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
  cy.get('.ant-modal-root .toastui-editor-ww-container').type('This is a test');
  cy.get('.ant-modal-footer button').eq(0).click();
  cy.get('.ant-modal-footer button').eq(2).click();
  cy.wait('@case', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 304]);
}

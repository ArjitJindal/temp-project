import { PERMISSIONS } from '../../support/permissions';

describe('bulk closing cases with alerts selected', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });
  it('testing bulk closing of cases with alerts selected', () => {
    const caseIds: string[] = [];
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED');
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
    cy.get('button[data-cy="expand-icon"]', { timeout: 2000 })
      .should('exist')
      .eq(0)
      .click({ force: true });
    cy.get('input[data-cy="header-table-checkbox"]').eq(1).click();
    cy.get('div[data-cy="table-footer"]', {
      timeout: 8000,
    })
      .eq(1)
      .within(() => {
        cy.get('button[data-cy="update-status-button"]').contains('Close').click();
      });
    cy.intercept('PATCH', '**/cases/statusChange').as('case');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('.ant-modal-footer button').eq(3).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
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
  });
});

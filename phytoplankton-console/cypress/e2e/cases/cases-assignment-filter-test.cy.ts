import { PERMISSIONS } from '../../support/permissions';

describe('Using Assignment filter and assigning cases', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW, ...PERMISSIONS.CASE_DETAILS];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { NOTIFICATIONS: true },
    });
  });

  it('should assign single and multiple cases', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    cy.waitNothingLoading();
    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.get('tr [data-cy="_assignmentName"]')
          .first()
          .then(($assignmentTd) => {
            // we already have assigne filter in the query
            // TODO: if there are multiple assignee to a case we succeed the test in second try
            const userName = $assignmentTd.find('*[data-cy="user-name"]');
            cy.log(`Length: ${userName.length}`);
            cy.get('tr [data-cy="_assignmentName"]').first().scrollIntoView();
            // eslint-disable-next-line cypress/no-unnecessary-waiting
            cy.wait(100);
            cy.multiSelect('tr [data-cy="_assignmentName"]', [], { clear: true });
            cy.message('Assignees updated successfully').should('exist');
            cy.message().should('not.exist');
          })
          .then(() => {
            cy.visit(
              `/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL&caseStatus=OPEN%2CREOPENED`,
            );
            cy.waitNothingLoading();
            // Find all divs with class "unassigned" and select the first one
            cy.get('tr', { timeout: 20000 })
              .filter(':has(div[data-cy~="assignee-dropdown"][data-cy~="empty"])')
              .should('exist')
              .first()
              .as('trWithUnassignDiv');

            cy.get('@trWithUnassignDiv').should('not.contain', 'Loading...');
            cy.intercept('PATCH', '**/cases/assignments').as('case');
            cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
            cy.get('button[data-cy="update-assignment-button"]').click();
            cy.get('div[data-cy="assignment-option"]')
              .contains('cypress+admin@flagright.com')
              .should('be.visible')
              .click({ force: true });
            cy.message('Assignee updated successfully').should('exist');
            cy.get('@trWithUnassignDiv')
              .find('[data-cy="caseId"] a')
              .should('exist')
              .click({ force: true });
            cy.get('[data-cy^=assignee-dropdown]')
              .invoke('text')
              .should('contain', 'cypress+admin@flagright.com');
            cy.go(-1);

            cy.get('[data-cy="rules-filter"]')
              .filter(':contains("Add filter")')
              .scrollIntoView()
              .eq(0)
              .should('exist')
              .click({ force: true });

            cy.get('[data-cy="assignedTo-checkbox"]').then(($checkbox) => {
              if (!$checkbox.prop('checked')) {
                cy.get('[data-cy="assignedTo-checkbox"]').click();
              }
            });
            cy.get('h2').first().click();

            cy.get('[data-cy="rules-filter"]')
              .filter(':contains("Assigned to")')
              .eq(0)
              .should('exist')
              .click();
            cy.get('.ant-popover-content li').eq(1).click();
            cy.wait('@case')
              .its('response.statusCode')
              .should('eq', 200)
              .then(() => {
                cy.get('[data-cy="rules-filter"]')
                  .filter(':contains("Assigned to")')
                  .eq(0)
                  .should('exist')
                  .click();
                cy.waitNothingLoading();
                // Wait until all empty assignee dropdowns are gone (assignments are loaded)
                cy.get(
                  'tr [data-cy="_assignmentName"] [data-cy~="assignee-dropdown"][data-cy~="empty"]',
                  {
                    timeout: 10000,
                  },
                ).should('not.exist');
                // Now check that all assignment cells contain the expected email
                cy.get('tr [data-cy="_assignmentName"]').each(($element) => {
                  cy.wrap($element).invoke('text').should('contain', 'cypress+admin@flagright.com');
                });
              });
          });
        cy.checkNotification([
          `‘cypress+custom@flagright.com’ assigned a case ‘${caseId}’ to you.`,
          `‘cypress+custom@flagright.com’ unassigned a case ‘${caseId}’ from you.`,
        ]);
      });
  });
});

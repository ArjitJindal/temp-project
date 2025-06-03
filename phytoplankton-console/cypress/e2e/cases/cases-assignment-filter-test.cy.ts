import { PERMISSIONS } from '../../support/permissions';

describe('Using Assignment filter and assigning cases', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW, ...PERMISSIONS.CASE_DETAILS];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { RBAC_V2: true },
    });
  });

  it('should assign single and multiple cases', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((caseId) => {
        cy.get('tr [data-cy="_assignmentName"]')
          .first()
          .should('not.contain', 'Loading...')
          .invoke('text')
          .then((text) => {
            if (!text.includes('Unassigned')) {
              cy.get('tr [data-cy="_assignmentName"] .ant-select-selector')
                .first()
                .trigger('mouseover', { force: true });
              cy.get('tr [data-cy="_assignmentName"] .ant-select-clear')
                .first()
                .click({ force: true });
              cy.message('Assignees updated successfully').should('exist');
              cy.message().should('not.exist');
            }
          })
          .then(() => {
            cy.visit(
              `/case-management/cases?page=1&pageSize=20&sort=-updatedAt&showCases=ALL&caseStatus=OPEN%2CREOPENED`,
            );
            // Find all divs with class "unassigned" and select the first one
            cy.get('tr')
              .filter(':has(div.unassigned)')
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
            cy.get('.ant-select-selection-item-content')
              .invoke('text')
              .should('contain', 'Ccypress+admin@flagright.com');
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
                cy.get('tbody')
                  .first()
                  .should(($element) => {
                    // Use a custom assertion to check for the absence of "isLoading" in the class
                    expect($element.attr('class')).not.to.include('isLoading');
                  })
                  .then(() => {
                    cy.get('tr [data-cy="_assignmentName"]').each(($element) => {
                      cy.wrap($element)
                        .invoke('text')
                        .should('contain', 'Ccypress+admin@flagright.com');
                    });
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

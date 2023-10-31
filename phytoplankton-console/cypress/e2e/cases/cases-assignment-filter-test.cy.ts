describe('Using Assignment filter and assigning cases', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should assign single and multiple cases', async () => {
    cy.visit('/case-management/cases');
    cy.get('tr [data-cy="_assignmentName"]')
      .first()
      .should('not.contain', 'Loading...')
      .invoke('text')
      .then((text) => {
        if (!text.includes('Unassigned')) {
          cy.get('tr [data-cy="_assignmentName"] .ant-select-selector')
            .first()
            .trigger('mouseover', { force: true });
          cy.get('tr [data-cy="_assignmentName"] .ant-select-clear').first().click({ force: true });
          cy.message('Assignees updated successfully').should('exist');
          cy.message('Assignees updated successfully').should('not.exist');
        }
      })
      .then(() => {
        // Find all divs with class "unassigned" and select the first one
        cy.get('tr').filter(':has(div.unassigned)').should('exist').first().as('trWithUnassignDiv');

        // Check if the inner text is not "Loading"
        cy.get('@trWithUnassignDiv').should('not.contain', 'Loading...');
        cy.intercept('PATCH', '**/cases/assignments').as('case');
        // Click the first div if it meets the conditions
        cy.get('@trWithUnassignDiv')
          .find('.ant-select-selector')
          .should('exist')
          .click({ force: true });
        cy.get('.ant-select-item-option').first().should('exist').click();
        cy.message('Assignees updated successfully').should('exist');
        cy.get('@trWithUnassignDiv')
          .find('[data-cy="caseId"] a')
          .should('exist')
          .click({ force: true });
        cy.get('.ant-select-selection-item-content')
          .invoke('text')
          .should('contain', 'Ccypress@flagright.com');
        cy.go(-1);

        cy.get('[data-cy="rules-filter"]')
          .filter(':contains("Add filter")')
          .eq(0)
          .should('exist')
          .click();

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
        cy.get('.ant-popover-content li').first().click();
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
                  // Assert that the text content of each element is "Ccypress@flagright.com"
                  cy.wrap($element).invoke('text').should('contain', 'Ccypress@flagright.com');
                });
              });
          });
      });
  });
});

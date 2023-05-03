describe('Comment Alerts from Table', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });

  it('should close a alert', () => {
    cy.visit('/case-management/cases');

    cy.get('button[data-cy="expand-icon"]', { timeout: 15000 }).eq(0).click();

    cy.get('div[data-cy="expanded-content"] input[data-cy="row-table-checkbox"]', {
      timeout: 15000,
    })
      .eq(0)
      .click();

    cy.get('div[data-cy="expanded-content"] button[data-cy="update-status-button"]', {
      timeout: 8000,
    })
      .eq(1)
      .click();
    cy.intercept('POST', '/console/alerts').as('alert');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('.ant-modal-footer button')
      .eq(3)
      .click()
      .then(() => {
        cy.wait('@alert').then((interception) => {
          expect(interception.response.statusCode).to.eq(200);
        });
        cy.get('button[data-cy="segmented-control-all-alerts"]').click();
        cy.get('button[data-cy="status-button"]').eq(0).click();
        cy.get('.ant-dropdown-menu-title-content').eq(1).click();
        cy.get('input[data-cy="row-table-checkbox"]').eq(0).click();
        cy.get('button[data-cy="update-status-button"]').eq(1).click();
        cy.get('.ant-modal-footer button')
          .eq(1)
          .click()
          .then(() => {
            cy.wait('@alert').then((interception) => {
              expect(interception.response.statusCode).to.eq(200);
            });
            cy.get('button[data-cy="segmented-control-all-alerts"]').click();
            cy.get('button[data-cy="status-button"]').eq(0).click();
            cy.get('.ant-dropdown-menu-title-content').eq(0).click();
            /* eslint-disable-next-line cypress/no-unnecessary-waiting */
            cy.wait(500);
            cy.get('table tbody tr').then((el) => {
              expect(el.length).to.gte(1);
            });
            cy.get('button[data-cy="segmented-control-all"]').click();
            cy.get('button[data-cy="status-button"]').eq(0).click();
            cy.get('.ant-dropdown-menu-title-content').eq(1).click();
            /* eslint-disable-next-line cypress/no-unnecessary-waiting */
            cy.wait(3000);
            cy.get('input[data-cy="header-table-checkbox"]').eq(0).click();
            cy.get('button[data-cy="update-status-button"]').eq(1).click();
            cy.get('.ant-modal-footer button').eq(1).click();
          });
      });
  });
});

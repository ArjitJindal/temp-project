/* NOTE: This test is working under a condition that there is only one alert in the case so case will also close when alert is closed */

describe('Comment Alerts from Table', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should close a alert', () => {
    cy.visit('/case-management/cases');

    // Close an alert
    cy.get('button[data-cy="expand-icon"]', { timeout: 15000 }).eq(0).click();
    cy.get('div[data-cy="expanded-content"] input[data-cy="row-table-checkbox"]', {
      timeout: 15000,
    })
      .eq(0)
      .click();
    cy.caseAlertAction('Close');
    cy.intercept('PATCH', '**/alerts/statusChange').as('alert');
    cy.multiSelect('.ant-modal', 'False positive');
    cy.get('.ant-modal-root .ant-modal-title', { timeout: 8000 }).click();
    cy.get('.ant-modal-root textarea').eq(0).type('This is a test');
    cy.get('.ant-modal-footer button').eq(1).click();
    cy.get('button[data-cy="modal-ok"]').eq(1).click();
    cy.wait('@alert').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);

      // Re-open the closed alert
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(500);
      cy.get('div[data-cy="expanded-content"] input[data-cy="row-table-checkbox"]', {
        timeout: 15000,
      })
        .eq(0)
        .click();
      cy.caseAlertAction('Re-Open');
      cy.intercept('PATCH', '**/alerts/statusChange').as('alert');
      cy.get('button[data-cy="modal-ok"]').eq(0).click();
      cy.wait('@alert').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
      });
    });
  });
});

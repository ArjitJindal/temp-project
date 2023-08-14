describe('SAR Generate', () => {
  beforeEach(() => {
    cy.loginByForm();
  });

  it('should generate SAR', () => {
    cy.visit('/case-management/cases', { timeout: 15000 });
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL_ALERTS&alertStatus=CLOSED');
    cy.get('body').then((body) => {
      if (body.find('input[data-cy="row-table-checkbox"]').length > 0) {
        cy.get('input[data-cy="header-table-checkbox"]', { timeout: 15000 }).click();
        cy.get('button[data-cy="update-status-button"]', { timeout: 15000 }).eq(1).click();
        cy.get('button[data-cy="modal-ok"]').eq(0).click();
      }
    });
    cy.visit('/case-management/cases?sort=-updatedAt&showCases=ALL&caseStatus=OPEN');
    cy.get('a[data-cy="case-id"]', { timeout: 15000 })
      .should('be.visible')
      .first()
      .click({ force: true });
    cy.get('div[aria-controls="rc-tabs-0-panel-alerts"]', { timeout: 15000 }).click();
    cy.get('button[data-cy="expand-icon"]').eq(0).click();
    cy.get('div[id="rc-tabs-1-panel-transactions"] input[data-cy="row-table-checkbox"]', {
      timeout: 15000,
    })
      .first()
      .click({ force: true });
    cy.get('button[data-cy="sar-button"]').click();
    cy.get('label[data-cy="sar-country-select"] input').click();
    cy.get('div[title="Kenya"]').click();
    cy.get('label[data-cy="sar-report-type-select"] input').click();
    cy.get('div[title="SAR"]').click();
    cy.get('button[data-cy="modal-ok"]').click();
    cy.get('div[data-cy="drawer-title-report-generator"]').should('contain', 'Report generator');
  });
});

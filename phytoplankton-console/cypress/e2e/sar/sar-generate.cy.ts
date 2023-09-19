describe.skip('SAR Generate', () => {
  beforeEach(() => {
    cy.loginByForm();
  });
  it('should open SAR report form', () => {
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL_ALERTS&alertStatus=OPEN');
    cy.get('td[data-cy="ruleNature"]', { timeout: 15000 }).each(($td, index) => {
      const innerHtml = $td.text();
      if (innerHtml.includes('AML')) {
        cy.wrap(index).as('AmlIndex');
        return false;
      }
    });
    cy.get('@AmlIndex').then((index) => {
      cy.get('a[data-cy="case-id"]', { timeout: 15000 })
        .should('be.visible')
        .eq(+index)
        .click({ force: true });
      cy.get('div[aria-controls="rc-tabs-0-panel-alerts"]', { timeout: 15000 }).click();
      const SarCountrywithReports = [
        {
          countryName: 'Kenya',
          reportType: 'SAR',
        },
        {
          countryName: 'Lithuania',
          reportType: 'STR',
        },
        {
          countryName: 'Lithuania',
          reportType: 'CTR',
        },
        {
          countryName: 'United States of America',
          reportType: 'SAR',
        },
      ];
      SarCountrywithReports.map((item) => {
        cy.get('div[id="rc-tabs-1-panel-transactions"] input[data-cy="row-table-checkbox"]', {
          timeout: 15000,
        })
          .first()
          .click({ force: true });

        cy.get('button[data-cy="sar-button"]').click();
        cy.get('label[data-cy="sar-country-select"] input').click();
        cy.get(`div[title="${item.countryName}"]`).click();
        cy.get('label[data-cy="sar-report-type-select"] input').click();
        cy.get(`div[title="${item.reportType}"]`).click();
        cy.get('button[data-cy="modal-ok"]').click();
        cy.get('div[data-cy="drawer-title-sar-report"]').should('contain', 'SAR report');
        cy.get('svg[data-cy="drawer-close-button"]').click();

        cy.reload();
      });
    });
  });
});

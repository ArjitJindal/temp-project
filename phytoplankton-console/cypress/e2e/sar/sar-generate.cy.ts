import promisify from 'cypress-promise';

describe('SAR Generate', () => {
  beforeEach(() => {
    cy.loginByForm();
  });
  it('should open SAR report form', async () => {
    cy.visit('/case-management/cases?page=1&pageSize=100&showCases=ALL_ALERTS&alertStatus=OPEN');
    const index = await promisify(
      cy.get('td[data-cy="ruleNature"]', { timeout: 15000 }).then((data) => {
        const ruleNatures = data.toArray();
        for (let i = 0; i < ruleNatures.length; i++) {
          if (ruleNatures[i].innerText === 'AML') return i;
        }
        return 0;
      }),
    );

    cy.intercept('GET', '**/report-types').as('sarCountries');
    cy.get('a[data-cy="alert-id"]', { timeout: 15000 })
      .should('be.visible')
      .eq(+index)
      .click({ force: true });

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

import { PERMISSIONS } from '../../support/permissions';

describe('SAR Generate', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.REPORTS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS, features: { SAR: true } });
  });
  it('should open SAR report form', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=100&showCases=ALL_ALERTS&alertStatus=OPEN&ruleNature=AML',
    );

    cy.intercept('GET', '**/report-types').as('sarCountries');
    cy.get('a[data-cy="alert-id"]', { timeout: 15000 })
      .should('be.visible')
      .eq(0)
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
      cy.get('[data-cy="sar-country-select"] input').click();
      cy.get(`div[title="${item.countryName}"]`).click();
      cy.get('[data-cy="sar-report-type-select"] input').click();
      cy.get(`div[title="${item.reportType}"]`).click();
      cy.get('button[data-cy="modal-ok"]').click();
      cy.get('div[data-cy="drawer-title-sar-report"]').should('contain', 'SAR report');
      cy.get('svg[data-cy="drawer-close-button"]').click();
      cy.reload();
    });
  });
});

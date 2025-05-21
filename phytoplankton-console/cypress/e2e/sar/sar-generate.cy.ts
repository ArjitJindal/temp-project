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
    cy.intercept('GET', '**/alerts**').as('alerts');
    cy.visit(
      '/case-management/cases?page=1&pageSize=100&sort=-createdTimestamp&showCases=ALL_ALERTS&alertStatus=OPEN&ruleNature=AML',
    );
    cy.intercept('GET', '**/report-types').as('sarCountries');
    cy.wait('@alerts').its('response.statusCode').should('be.oneOf', [200, 304]);
    cy.waitNothingLoading();
    cy.get('a[data-cy="alert-id"]', { timeout: 15000 }).should('be.visible');
    cy.get('a[data-cy="alert-id"]').eq(0).click();

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
      {
        countryName: 'Malaysia',
        reportType: 'STR',
      },
      {
        countryName: 'Canada',
        reportType: 'STR',
      },
    ];
    SarCountrywithReports.map((item) => {
      cy.get('div[id="rc-tabs-1-panel-transactions"] input[data-cy="row-table-checkbox"]', {
        timeout: 15000,
      })
        .first()
        .click();
      cy.get('button[data-cy="sar-button"]').first().click();
      cy.get('[data-cy="sar-country-select"] > [data-cy="input select"]').type(
        `${item.countryName}{enter}`,
      );
      cy.get('[data-cy="sar-report-type-select"] > [data-cy="input select"]').type(
        `${item.reportType}{enter}`,
      );
      cy.get('button[data-cy="modal-ok"]').click();
      cy.get('div[data-cy="drawer-title-sar-report"]').should('contain', 'SAR report');
      cy.reload();
    });
  });
});

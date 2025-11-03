import { PERMISSIONS } from '../../support/permissions';

describe.skip('SAR Generate', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.REPORTS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { SAR: true },
    });
  });
  it('should open SAR report form', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&originMethodFilter=ACH%2CGENERIC_BANK_ACCOUNT%2CIBAN%2CNPP%2CUPI%2CCHECK&caseStatus=OPEN',
    );
    cy.intercept('GET', '**/report-types').as('sarCountries');
    cy.waitNothingLoading();
    cy.get('a[data-cy="case-id"]', { timeout: 15000 }).should('be.visible');
    cy.get('a[data-cy="case-id"]').eq(0).click();
    cy.waitNothingLoading();

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
      cy.get('button[data-cy="sar-button"]').first().click();
      cy.singleSelect('[data-cy="sar-country-select"]', item.countryName);
      cy.singleSelect('[data-cy="sar-report-type-select"]', item.reportType);
      cy.get('button[data-cy="modal-ok"]').click();
      cy.get('div[data-cy="drawer-title-sar-report"]').should('contain', 'SAR report');
      cy.reload();
    });
  });
});

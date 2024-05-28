/// <reference types="cypress" />

import { PERMISSIONS } from '../../support/permissions';

describe('Check if merchant monitoring is available for a user', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.USERS_USER_DETAILS,
    ...PERMISSIONS.USERS_USER_OVERVIEW,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { MERCHANT_MONITORING: true },
    });
  });

  it('business user should have merchant monitoring data', () => {
    cy.intercept('POST', '**/merchant-monitoring/summary').as('getMerchantMonitoringSummary');

    cy.visit('/users/list/business/all', { timeout: 8000 });
    cy.get('[data-test="table"]', { timeout: 40000 })
      .should('be.visible')
      .then(($table) => {
        expect($table).to.exist;
      })
      .first()
      .should('have.length.gt', 0)
      .find('a[data-cy="business-user-id"]', { timeout: 10000 })
      .should('be.visible')
      .eq(0)
      .click();
    cy.contains('div[role="tab"]', 'Merchant monitoring').should('be.visible').click();
    cy.wait('@getMerchantMonitoringSummary', { timeout: 10000 }).then((interception) => {
      cy.get('[data-cy="merchant-monitoring-user-summary"]')
        .first()
        .should(($element) => {
          expect($element.text().trim()).not.to.eq('');
        });
      cy.contains('button[type="button"]', 'View history').should('be.visible').click();
      const responseData = interception.response?.body?.data;
      expect(responseData).to.be.an('array').and.to.have.length.gt(0);
      expect(responseData).to.exist;
    });
  });
});

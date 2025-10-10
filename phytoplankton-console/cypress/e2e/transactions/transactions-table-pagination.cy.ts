/// <reference types="cypress" />

import { PERMISSIONS } from '../../support/permissions';

describe('check pagination', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.TRANSACTION_OVERVIEW];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: {
        CLICKHOUSE_ENABLED: false,
      },
    });
  });

  it('Next button on table should work', () => {
    cy.visit('/transactions/list', { timeout: 20000 });
    cy.intercept('GET', '**/transactions?*').as('transactions');
    let tableDataBefore: string;

    cy.get('[data-test="table"]')
      .should('be.visible')
      .find('tr')
      .eq(1)
      .should('be.visible')
      .should('have.length.gt', 0)
      .get('a[data-cy="transaction-id"]')
      .first()
      .then(($table) => {
        const text = $table.text().trim();
        expect(text).not.to.be.empty;
        tableDataBefore = text;
      });

    cy.get('button[data-cy="pagination-next-button"]', { timeout: 10000 })
      .should('be.visible')
      .click();

    // Wait for the table to update after clicking "Next"
    cy.wait('@transactions', { timeout: 20000 }).then((interception) => {
      const newData = interception.response?.body;
      expect(newData).to.exist;
      cy.get('[data-test="table"]', { timeout: 20000 })
        .should('be.visible')
        .find('tr')
        .eq(1)
        .should('be.visible')
        .should('have.length.gt', 0)
        .get('a[data-cy="transaction-id"]')
        .first()
        .should(($table) => {
          const text = $table.text().trim();
          expect(text).not.to.be.empty;
          expect(text).not.to.equal(tableDataBefore);
        });
    });
  });
});

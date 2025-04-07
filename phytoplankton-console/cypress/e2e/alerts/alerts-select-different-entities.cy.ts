import pluralize from 'pluralize';
import { PERMISSIONS } from '../../support/permissions';

describe('Selection of entities', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_REOPEN,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.NOTIFICATIONS,
    ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ...PERMISSIONS.TRANSACTION_DETAILS,
  ];

  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { ADVANCED_WORKFLOWS: true },
    });
  });

  it('should select 3 alerts', () => {
    cy.visit('/case-management/cases?showCases=ALL_ALERTS');
    testNoSelection();
    selectRow('alerts-list', 0);
    selectRow('alerts-list', 1);
    selectRow('alerts-list', 2);
    testSelection(3, 'alert');
  });

  it('should be possible to expand alert and select transactions', () => {
    cy.visit(
      '/case-management/cases?showCases=ALL_ALERTS&sort=-numberOfTransactionsHit&showCases=ALL_ALERTS&alertStatus=OPEN&ruleNature=AML',
    );
    testNoSelection();
    expandRow('alerts-list', 0);
    selectRow('transactions-list', 0);
    testSelection(1, 'transaction');
    selectRow('alerts-list', 0);
    testSelection(1, 'alert');
  });

  it('should reset selection when change page', () => {
    cy.visit('/case-management/cases?showCases=ALL_ALERTS');
    testNoSelection();
    selectRow('alerts-list', 0);
    testSelection(1, 'alert');

    cy.get('*[data-cy="table-alerts-list-pagination-wrapper"]')
      .contains('[data-cy="pagination-page-number-button"]', '2')
      .click();
    testNoSelection();
  });
});

function selectRow(table, number) {
  cy.get(`tr[data-cy="table-${table}-data-row"] input[data-cy="row-table-checkbox"]`)
    .eq(number)
    .click();
}

function expandRow(table, number) {
  cy.get(
    `tr[data-cy="table-${table}-data-row"] *[data-cy="EXPAND_COLUMN_ID"] *[data-cy="expand-icon"]`,
  )
    .eq(number)
    .click();
}

function testSelection(number, entity) {
  cy.get('*[data-cy="selection-info"] *[data-cy="selection-info-text"]').should(
    'contain',
    `${pluralize(entity, number, true)} selected`,
  );
}
function testNoSelection() {
  cy.get('*[data-cy="selection-info"]').should('not.exist');
}

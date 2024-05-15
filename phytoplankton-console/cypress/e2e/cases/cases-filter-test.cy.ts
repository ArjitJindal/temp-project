import { PERMISSIONS } from '../../support/permissions';

describe('Filter according to case id (optimized)', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW];

  beforeEach(() => {
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('should be able to filter according to case id', () => {
    cy.intercept('GET', '**/cases**').as('cases');

    cy.visit('/case-management/cases');
    cy.assertSkeletonLoader();

    cy.get('[data-cy="caseId"]')
      .first()
      .then(($caseId) => {
        const caseId = $caseId.text().substring(0, 3);
        cy.get('[data-cy="rules-filter"]').contains('Case ID').click().type(caseId);
        cy.wait('@cases').then((casesInterception) => {
          expect(casesInterception.response?.statusCode).to.be.oneOf([200, 304]);
          cy.url().should('include', 'caseId');
          cy.get('[data-cy="table-body"] [data-cy="caseId"]').each(($caseId) => {
            expect($caseId.text()).to.include(caseId);
          });
        });
      });
  });

  it('should filter according to alert priority of the cases', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-priority&showCases=ALL_ALERTS&alertStatus=OPEN',
    );

    cy.get('[data-cy="segmented-control-all-alerts"]').click();
    cy.get('[data-cy="rules-filter"]:contains("Add filter")').first().click();
    cy.get('[data-cy="rulesHitFilter-checkbox"]').check({ force: true });
    cy.get('[data-cy="rules-filter"]:contains("Alert priority")').first().click();
    cy.get('.ant-popover .ant-select-selector').first().click();
    cy.get('.ant-select-item-option')
      .first()
      .invoke('text')
      .then((selectedPriority) => {
        cy.get('.ant-select-item-option').first().click();
        cy.get('[data-cy="priority"]').contains('P1').should('have.text', selectedPriority);
      });
  });

  it('should filter according to rule name', () => {
    cy.visit('/case-management/cases');

    cy.get('[data-cy="segmented-control-all-alerts"]').click();
    cy.get('[data-cy="rules-filter"]:contains("Alert status")').first().click();
    cy.get('li[data-cy="OPEN"]').first().click();
    cy.get('[data-cy="rules-filter"]:contains("Add filter")').first().click();
    cy.get('[data-cy="rulesHitFilter-checkbox"]').check({ force: true });
    cy.get('[data-cy="rules-filter"]:contains("Rules")').first().click();
    const ruleName = 'Transaction amount too high';
    cy.get('.ant-popover .ant-select-selector').first().click().type(`${ruleName}{enter}`);
    cy.get('td[data-cy="ruleName"]')
      .contains(ruleName)
      .should('exist')
      .each((ele) => {
        cy.wrap(ele).should('exist').invoke('text').should('include', ruleName);
      });
  });

  it('should assign single and multiple cases', () => {
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED');

    cy.get('[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();

    cy.intercept('PATCH', '**/cases/assignments').as('case');
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
    cy.get('[data-cy="header-table-checkbox"]').click();
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
  });
});

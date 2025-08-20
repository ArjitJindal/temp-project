import { PERMISSIONS } from '../../support/permissions';

describe('Filter according to case id (optimized)', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW, ...PERMISSIONS.RULES];

  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
    });
  });

  /* eslint-disable cypress/no-unnecessary-waiting */
  it('should be able to filter according to case id', () => {
    cy.intercept('GET', '**/cases**').as('cases');

    cy.visit('/case-management/cases');

    cy.wait('@cases', { timeout: 25000 }).then((casesInterception) => {
      expect(casesInterception.response?.statusCode).to.be.oneOf([200, 304]);
      cy.waitNothingLoading();

      cy.get('[data-cy="caseId"]')
        .first()
        .then(($caseId) => {
          cy.log('$caseId', $caseId);
          const caseId = $caseId.text();
          cy.get('[data-cy="rules-filter"]').contains('Case ID').click();
          cy.wait(300);
          cy.focused().type(caseId);
          cy.wait('@cases', { timeout: 25000 }).then((casesInterception) => {
            expect(casesInterception.response?.statusCode).to.be.oneOf([200, 304]);
            cy.url().should('include', 'caseId');
            cy.waitNothingLoading();
            cy.get('[data-cy="table-case-table-body"] [data-cy="caseId"]').each(($caseId) => {
              const caseIdText = $caseId.text();

              if (caseIdText.startsWith('C')) {
                expect(caseIdText).to.include(caseId);
              }
            });
          });
        });
    });
  });

  it('should filter according to alert priority of the cases', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-priority&showCases=ALL_ALERTS&alertStatus=OPEN',
    );

    cy.get('[data-cy="segmented-control-all-alerts"]').click();
    cy.get('[data-cy="rules-filter"]:contains("Add filter")').scrollIntoView().first().click();
    cy.get('[data-cy="rulesHitFilter-checkbox"]').check({ force: true });
    cy.get('[data-cy="rules-filter"]:contains("Alert priority")').first().click();
    cy.multiSelect('[data-cy=QuickFilter]', 'P1', {
      fullOptionMatch: true,
    });
  });

  it('should filter according to rule name', () => {
    cy.intercept('GET', '**/rule-instances/rules-with-alerts').as('getRuleWithAlerts');
    cy.intercept('GET', '**/rule_instances**').as('rules');
    cy.visit('/case-management/cases?showCases=ALL_ALERTS');

    cy.wait('@getRuleWithAlerts', { timeout: 25000 }).then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 304]);
    });
    let ruleName = '';
    cy.wait('@rules', { timeout: 25000 }).then((interception) => {
      cy.log('interception.response', interception.response);
      expect(interception.response?.statusCode).to.oneOf([200, 304]);
      const rules = interception.response?.body ?? [];
      rules.forEach((rule) => {
        if (rule.ruleNameAlias) {
          ruleName = rule.ruleNameAlias;
        }
      });
      expect(ruleName).to.not.equal('');
      cy.get('[data-cy="rules-filter"]:contains("Alert status")').first().click();
      cy.get('li[data-cy="OPEN"]').first().click();
      cy.get('[data-cy="rules-filter"]:contains("Add filter")').scrollIntoView().first().click();
      cy.get('[data-cy="rulesHitFilter-checkbox"]').check({ force: true });
      cy.get('[data-cy="rules-filter"]:contains("Rules")').first().click();
      cy.multiSelect('[data-cy=QuickFilter]', ruleName);
      cy.get('td[data-cy="ruleName"]')
        .contains(ruleName)
        .should('exist')
        .each((ele) => {
          cy.wrap(ele).should('exist').invoke('text').should('include', ruleName);
        });
    });
  });

  it('should assign single and multiple cases', () => {
    cy.visit('/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN');

    cy.get('[data-cy="row-table-checkbox"]', { timeout: 25000 }).eq(0).click();

    cy.intercept('PATCH', '**/cases/assignments').as('case');
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
    cy.waitNothingLoading();
    cy.get('[data-cy="header-table-checkbox"]').click();
    cy.get('button[data-cy="update-assignment-button"]').eq(0).click();
    cy.get('.ant-dropdown-menu-item-only-child').eq(0).click();
    cy.wait('@case').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
  });
});

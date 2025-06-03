describe.skip('Main pages loading', () => {
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: [],
      loginWithRole: 'admin',
      features: {
        CLICKHOUSE_ENABLED: false,
        RBAC_V2: true,
      },
    });
  });

  const tables = [
    {
      testName: 'Case management(all cases)',
      title: 'Case management',
      url: '/case-management/cases',
      button: { text: 'All cases', dataCy: 'segmented-control-all' },
    },
    {
      testName: 'Case management(my cases)',
      title: 'Case management',
      url: '/case-management/cases?showCases=MY',
      button: { text: 'My cases', dataCy: 'segmented-control-my' },
    },
    {
      testName: 'Case management(all alerts)',
      title: 'Case management',
      url: '/case-management/cases?showCases=ALL_ALERTS',
      button: { text: 'All alerts', dataCy: 'segmented-control-all-alerts' },
    },
    {
      testName: 'Case management(my alerts)',
      title: 'Case management',
      url: '/case-management/cases?showCases=MY_ALERTS',
      button: { text: 'My alerts', dataCy: 'segmented-control-my-alerts' },
    },
    {
      testName: 'Case management(payment approvals)',
      title: 'Case management',
      url: '/case-management/cases?showCases=PAYMENT_APPROVALS',
      button: { text: 'Payment approval', dataCy: 'segmented-control-payment-approvals' },
    },
    {
      testName: 'Transactions',
      url: '/transactions/list',
      title: 'Transactions',
    },
    { testName: 'Users(all)', url: '/users/list/all/all', title: 'Users' },
    { testName: 'Users(consumer)', url: '/users/list/consumer/all', title: 'Users' },
    { testName: 'Users(business)', url: '/users/list/business/all', title: 'Users' },
    {
      testName: 'My rules(live)',
      url: '/rules/my-rules',
      title: 'My rules',
      isRulesPage: true,
      button: { text: 'Live rules', dataCy: 'segmented-control-live' },
    },
    {
      testName: 'My rules(shadow)',
      url: '/rules/my-rules',
      title: 'My rules',
      isRulesPage: true,
      button: { text: 'Shadow rules', dataCy: 'segmented-control-shadow' },
    },
    { testName: 'Templates', url: '/rules/rules-library', title: 'Templates', isRulesPage: true },
    { testName: 'SAR', url: '/reports', title: 'SAR' },
    {
      testName: 'Risk factors(consumer)',
      url: '/risk-levels/risk-factors/consumer',
      title: 'Risk factors',
      isRiskPage: true,
      button: { text: 'Consumer', class: { name: '.ant-tabs-tab', index: 0 } },
    },
    {
      testName: 'Risk factors(business)',
      url: '/risk-levels/risk-factors/business',
      title: 'Risk factors',
      isRiskPage: true,
      button: { text: 'Business', class: { name: '.ant-tabs-tab', index: 1 } },
    },
    {
      testName: 'Risk factors(transaction)',
      url: '/risk-levels/risk-factors/transaction',
      title: 'Risk factors',
      isRiskPage: true,
      button: { text: 'Transaction', class: { name: '.ant-tabs-tab', index: 2 } },
    },
    {
      testName: 'Lists(whitelist)',
      url: '/lists/whitelist',
      title: 'Lists',
    },
    {
      testName: 'Lists(blacklist)',
      url: '/lists/blacklist',
      title: 'Lists',
    },
    {
      testName: 'Screening(search)',
      url: '/screening/manual-screening',
      title: 'Screening',
    },
    {
      testName: 'Screening(activity)',
      url: '/screening/activity',
      title: 'Screening',
    },
    {
      testName: 'Screening(whitelist)',
      url: '/screening/whitelist',
      title: 'Screening',
    },

    { testName: 'Audit log', url: '/auditlog', title: 'Audit log' },
  ];

  const isTableExpandable = ($table: JQuery<HTMLElement>): boolean => {
    return $table.find('[data-cy="expand-icon"]').first().length > 0;
  };

  const checkTable = (depth = 0) => {
    cy.get('[data-test="table"]')
      .eq(depth)
      .should('exist')
      .then(($table) => {
        cy.waitNothingLoading();

        cy.wrap($table)
          .find('tbody td')
          .first()
          .invoke('text')
          .then((text) => {
            cy.log(text);
            if (text.trim() === 'No data to display') {
              cy.log(`Table at depth ${depth} has no data`);
              return;
            }

            try {
              if (isTableExpandable($table)) {
                cy.wrap($table)
                  .find('[data-cy="expand-icon"]')
                  .first()
                  .click({ force: true })
                  .then(() => {
                    cy.waitNothingLoading();

                    cy.wrap($table)
                      .find('[data-cy="expand-icon"]')
                      .should('be.visible')
                      .then(($expandedRow) => {
                        if ($expandedRow.find('[data-test="table"]').length > 0) {
                          checkTable(depth + 1);
                        } else {
                          cy.log(`No nested table found in expanded row at depth ${depth}`);
                        }
                      });
                  });
              } else {
                cy.log(`Table at depth ${depth} is not expandable`);
              }
            } catch (error) {
              cy.log(`Error checking table at depth ${depth}: ${error}`);
            }
          });
      });
  };

  const clickButton = (button: {
    text: string;
    dataCy?: string;
    id?: string;
    class?: { name: string; index: number };
  }) => {
    if (button.dataCy) {
      cy.get(`[data-cy="${button.dataCy}"]`).contains(button.text).click();
    } else if (button.id) {
      cy.get(`#${button.id}`).contains(button.text).click();
    } else if (button.class) {
      cy.get(button.class.name).eq(button.class.index).contains(button.text).click();
    }
  };

  tables.forEach(({ testName, url, title, button, isRulesPage, isRiskPage }) => {
    it(`should load ${testName} table correctly`, () => {
      if (isRulesPage) {
        cy.visit(url);
        cy.get(`div[aria-selected='true'][class='ant-tabs-tab-btn']`).eq(0).contains(title);
      } else if (isRiskPage) {
        cy.visit(url);
        cy.get(`#breadcrumb-link`).eq(0).contains(title);
      } else {
        cy.navigateToPage(url, title);
      }

      if (button) {
        clickButton(button);
      }

      checkTable(0);
    });
  });
});

import { PERMISSIONS } from '../../support/permissions';
import { getCleanText } from '../../support/utils';

describe('Copilot', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.CASE_OVERVIEW,
    ...PERMISSIONS.CASE_DETAILS,
    ...PERMISSIONS.COPILOT,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { NARRATIVE_COPILOT: true },
      settings: { isAiEnabled: true },
    });
  });

  it('should fetch the narrative and format', () => {
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&sort=-caseTransactionsCount&showCases=ALL&caseStatus=OPEN',
    );
    cy.assertSkeletonLoader();
    // Capture the userName without using promisify
    cy.get('td[data-cy="_userName"]')
      .eq(0)
      .invoke('text')
      .then((userName) => {
        cy.get('input[data-cy="row-table-checkbox"]', { timeout: 15000 }).eq(0).click();
        cy.caseAlertAction('Close');
        cy.get('.ant-modal-body:visible').within(() => {
          cy.selectOptionsByLabel('Reason', ['False positive']);

          cy.intercept('POST', '**/copilot/narrative').as('copilotNarrative');
          cy.get('button[data-cy="ask-copilot"]').click();

          cy.wait('@copilotNarrative').then((interception) => {
            expect(interception.response?.statusCode).to.eq(200);
            const narrative = interception.response?.body?.narrative;
            expect(narrative).to.contain(userName);
            /* eslint-disable cypress/no-unnecessary-waiting */
            cy.wait(1000);
            cy.get('.toastui-editor-contents', { timeout: 8000 }).then((el) => {
              const innerText = el[el.length - 2].innerText;
              expect(getCleanText(innerText)).to.eq(getCleanText(narrative));
            });
          });

          cy.intercept('POST', '**/copilot/format').as('copilotNarrativeFormat');
          cy.get('button[data-cy="format-copilot-narrative"]').click();

          cy.wait('@copilotNarrativeFormat').then((interception) => {
            expect(interception.response?.statusCode).to.eq(200);
          });
        });
      });
  });
});

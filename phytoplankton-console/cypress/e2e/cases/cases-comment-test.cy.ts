import { PERMISSIONS } from '../../support/permissions';

describe('Add a comment to a case', () => {
  const REQUIRED_PERMISSIONS = [...PERMISSIONS.CASE_OVERVIEW, ...PERMISSIONS.CASE_DETAILS];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { NOTIFICATIONS: true },
    });
  });

  it('should be able to create a comment for a first case with file attachment', () => {
    const commentText = `Random Comment: ${Date.now()}`;
    const fileName = `file_${Date.now()}.txt`;
    const fileContent = `file content of ${fileName}`;
    let caseId = '';

    // Navigate to case
    cy.intercept('GET', `**/cases**`).as('cases');
    cy.intercept('GET', '**/auditlog**').as('comments');
    cy.visit(
      '/case-management/cases?page=1&pageSize=20&showCases=ALL&caseStatus=OPEN%2CREOPENED&assignedTo=auth0%7C66f2d9df0b24d36a04cc31a2',
    );
    cy.wait('@cases', { timeout: 15000 }).then((intercept) => {
      expect(intercept.response?.statusCode).to.be.oneOf([200, 304]);
    });

    cy.get('a[data-cy="case-id"]')
      .eq(0)
      .invoke('text')
      .then((c) => {
        caseId = c;

        cy.get('[data-cy="case-id"]', { timeout: 15000 }).eq(0).click();

        // Open comment window and fill it
        cy.get('[data-cy="sticky"] [data-cy="comment-button"]').click();
        cy.get('[data-cy="comment-editor"] .toastui-editor-ww-container').type(commentText);
        cy.get('[data-cy="comment-editor"] .ant-upload input[type=file]').selectFile(
          {
            contents: Cypress.Buffer.from(fileContent),
            fileName: fileName,
            mimeType: 'text/plain',
            lastModified: Date.now(),
          },
          {
            force: true,
          },
        );
        cy.message('Uploading...').should('exist');
        cy.message().should('not.exist');
        cy.get('button[data-cy="add-comment-button"]').click();
        cy.message('Comment added successfully').should('exist');
        cy.get('[data-cy="comment-editor"]').should('not.be.visible');

        // Open comments and make sure that comment is created
        cy.get('.ant-tabs-tab').contains('Activity').click();
        cy.get('[data-cy="segmented-control-comments"]').click();
        cy.get('[data-cy="comment"]', { timeout: 15000 })
          .then(($elements) => {
            return $elements.filter((index, element) => {
              const $element = Cypress.$(element);
              return $element.find('.toastui-editor-contents').text().trim() === commentText;
            });
          })
          .should('have.length', 1)
          .within(() => {
            cy.get('[data-cy="attached-file"]').should('include.text', fileName);
            cy.get('[data-cy="attached-file"] a')
              .invoke('attr', 'href')
              .then((actionLink) => {
                actionLink &&
                  cy.request(actionLink).then((response) => {
                    expect(response.body).to.eq(fileContent);
                  });
              });
            cy.get('[data-cy="comment-created-on"]').should('not.be.empty');
            cy.get('[data-cy="comment-created-by"]').should('not.be.empty');
            cy.get('[data-cy="comment-delete-button"]').click();
          });

        cy.message('Comment deleted').should('exist');

        cy.intercept('GET', `**/cases/${caseId}**`).as('caseId');
        cy.loginByRole('admin');
        cy.visit(`/case-management/case/${caseId}/activity`);
        // Get the latest entry within the Log tab

        cy.wait('@caseId', { timeout: 15000 }).then((intercept) => {
          expect(intercept.response?.statusCode).to.be.oneOf([200, 304]);
          cy.waitNothingLoading();
          cy.get('[data-cy="segmented-control-log"]', { timeout: 10000 }).click();
          cy.wait('@comments', { timeout: 15000 }).then((intercept) => {
            expect(intercept.response?.statusCode).to.be.oneOf([200, 304]);
            cy.get('[data-cv="log-entry-item"]')
              .should('exist')
              .first()
              .then((log) => {
                // Get the text and time values from the latest log entry
                const textValue = log.find('[data-cv="log-entry-item-text"]').text().trim();
                const timeValue = log.find('[data-cv="log-entry-item-date"]').text().trim();

                cy.wrap(textValue).should(
                  'include',
                  'Cypress+custom@flagright.com deleted a comment',
                );

                // Parse timeValue into a JavaScript Date object
                const timeParts = timeValue.split(':');
                const hours = parseInt(timeParts[0]);
                const minutes = parseInt(timeParts[1].split(' ')[0]);
                const period = timeParts[1].split(' ')[1];
                const logEntryTime = new Date();

                if (period === 'pm' && hours !== 12) {
                  logEntryTime.setHours(hours + 12);
                } else if (period === 'am' && hours === 12) {
                  logEntryTime.setHours(0);
                } else {
                  logEntryTime.setHours(hours);
                }

                logEntryTime.setMinutes(minutes);

                // Get the current time in milliseconds
                const currentTime = new Date().getTime();
                cy.wrap(currentTime - logEntryTime.getTime()).should('be.lte', 150000);
              });
            cy.checkNotification([
              `'cypress+custom@flagright.com' added a comment for a case '${caseId}'.`,
            ]);
          });
        });
      });
  });
});

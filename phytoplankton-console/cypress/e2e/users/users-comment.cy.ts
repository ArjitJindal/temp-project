import { PERMISSIONS } from '../../support/permissions';

describe('Add a comment to a user', () => {
  const REQUIRED_PERMISSIONS = [
    ...PERMISSIONS.USERS_USER_DETAILS,
    ...PERMISSIONS.USERS_USER_OVERVIEW,
    ...PERMISSIONS.USERS_USER_COMMENTS,
  ];
  beforeEach(() => {
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
    });
  });

  it('should be able to create a comment for a first consumer user with file attachment', () => {
    const commentText = `Test comment body (${new Date().toUTCString()})`;
    const fileName = `file_${Date.now()}.txt`;
    const fileContent = `file content of ${fileName}`;

    // Navigate to user
    cy.visit('/users/list/consumer/all');
    cy.get('[data-cy="consumer-user-id"]', { timeout: 15000 }).eq(0).click();

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

    // Click on download all button and check if the files are downloaded successfully
    cy.get("button[data-cy='download-all-button']").click();
    cy.message('Downloading attachments').should('exist');
    cy.message().should('not.exist');

    cy.get('[data-cy="comment"]')
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
            cy.request(actionLink as string).then((response) => {
              expect(response.body).to.eq(fileContent);
            });
          })
          .then(() => {
            cy.get('[data-cy="comment-delete-button"]').click();
          });
      })
      .then(() => {
        cy.message('Comment deleted').should('exist');
      });
  });
});

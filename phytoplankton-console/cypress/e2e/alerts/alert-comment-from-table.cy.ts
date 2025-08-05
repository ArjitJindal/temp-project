/// <reference types="cypress" />
import { v4 as uuid } from 'uuid';

describe('Comment Alerts from Table', () => {
  beforeEach(() => {
    cy.loginByRole('super_admin');
  });

  it('should create a comment alert from table and delete it', () => {
    cy.visit('/case-management/cases?showCases=ALL_ALERTS', { timeout: 8000 });

    /* eslint-disable cypress/no-unnecessary-waiting */
    // Adding a comment
    const comment = `This is a comment from cypress test ${uuid()}`;
    cy.get('button[data-cy="expand-icon"]', { timeout: 15000 }).eq(0).click();
    cy.get('.ant-tabs-tab-btn', { timeout: 8000 }).contains('Comments').click();

    let length = 0;
    cy.get('[data-cy="comments-section"]').then(($el) => {
      const comments = $el.find('[data-cy="comment"]');
      length = comments.length;
    });

    cy.get('[data-cy="comment-editor"]').within(() => {
      cy.get('.toastui-editor-contents', { timeout: 8000 }).last().type(comment);

      cy.get('button[data-cy="add-comment-button"]', { timeout: 8000 }).first().click();
      cy.wait(1000);
    });
    cy.message('Comment added successfully').should('exist');

    // Make sure that there are now "length + 1" comments
    cy.wait(1000);
    cy.get('[data-cy="comments-section"]').then(($el) => {
      const comments = $el.find('[data-cy="comment"]');
      expect(comments.length).to.eq(length + 1);
    });

    // Make sure that last comment has a text of a new comment
    cy.wait(1000);
    cy.get('[data-cy="comment"] .toastui-editor-contents', { timeout: 8000 })
      .last()
      .then((el) => {
        const innerText = el[el.length - 1]?.innerText ?? '';
        expect(innerText).to.eq(comment);
      });

    // Delete comment
    cy.wait(1000);
    cy.get('span[data-cy="comment-delete-button"]', { timeout: 8000 }).last().click();

    cy.get("[data-cy='modal-ok']").contains('Confirm').click();
    cy.message('Comment deleted successfully').should('exist');
    cy.waitNothingLoading();

    // Make sure that there now again "length" of comments
    cy.wait(1000);
    cy.get('[data-cy="comments-section"]').then(($el) => {
      const comments = $el.find('[data-cy="comment"]');
      expect(comments.length).to.eq(length);
    });
  });
});

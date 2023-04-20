/// <reference types="cypress" />
import { v4 as uuid } from 'uuid';

describe('Comment Alerts from Table', () => {
  beforeEach(() => {
    cy.loginByForm(Cypress.env('username'), Cypress.env('password'));
  });

  it('should create a comment alert from table and delete it', () => {
    /* eslint-disable cypress/no-unnecessary-waiting */
    cy.wait(2500);
    cy.visit('/case-management/cases');

    /* eslint-disable cypress/no-unnecessary-waiting */
    const comment = `This is a comment from cypress test ${uuid()}`;
    cy.get('table tbody tr td .ant-table-row-expand-icon', { timeout: 8000 }).eq(0).click();
    cy.get('[data-cy="expanded-content"] table tbody tr td .ant-table-row-expand-icon', {
      timeout: 8000,
    })
      .eq(0)
      .click();
    cy.get('.ant-tabs-tab-btn', { timeout: 8000 }).eq(1).click();
    cy.get('.toastui-editor-contents', { timeout: 8000 }).last().type(comment);
    let length = 0;
    cy.get('.toastui-editor-contents', { timeout: 8000 }).then((el) => {
      length = el.length;
    });
    cy.get('button[data-cy="add-comment-button"]', { timeout: 8000 }).first().click();
    cy.wait(500);
    cy.get('.toastui-editor-contents', { timeout: 8000 }).then((el) => {
      const innerText = el[length - 2].innerText;
      expect(innerText).to.eq(comment);
      expect(el.length).to.eq(length + 1);
    });
    cy.wait(1000);
    cy.get('span[data-cy="comment-delete-button"]', { timeout: 8000 }).last().click();
    cy.wait(1000);
    cy.get('.toastui-editor-contents', { timeout: 8000 }).then((el) => {
      expect(el.length).to.eq(length);
    });
    cy.wait(1000);
    cy.get('.toastui-editor-contents', { timeout: 8000 }).then((el) => {
      const innerText = el[Math.max(0, length - 3)]?.innerText ?? '';
      expect(innerText).to.not.eq(comment);
    });
  });
});

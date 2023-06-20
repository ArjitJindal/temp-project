/// <reference types="cypress" />
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-cy attribute.
       * @example cy.dataCy('greeting')
       */
      loginByForm(username: string, password: string): Chainable<Element>;
      loginByRequest(username: string, password: string): Chainable<Element>;
      multiSelect(preSelector: string, text: string): Chainable<Element>;
      caseAlertAction(action: string): Chainable<Element>;
    }
  }
}

export {};

/// <reference types="cypress" />
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-cy attribute.
       * @example cy.dataCy('greeting')
       */
      loginByForm(username?: string, password?: string): Chainable<Element>;
      loginByRequest(username: string, password: string): Chainable<Element>;
      multiSelect(preSelector: string, text: string): Chainable<Element>;
      caseAlertAction(action: string): Chainable<Element>;
      checkAndSwitchToCypressTenant(): Chainable<Promise<Element>>;
      clickTableRowLink(
        rowIndex: number,
        linkDataCy: string,
        tabText: string,
      ): Chainable<Promise<Element>>;
      navigateToPage(url: string, pageTitle: string): Chainable<Promise<Element>>;
      toggleFeature(feature: string, enabled: boolean): Chainable<Promise<Element>>;
      /**
       * Looks for a popup message by a text
       * @param text
       */
      message(text: string): Chainable<Element>;
    }
  }
}

export {};

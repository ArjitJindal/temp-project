/// <reference types="cypress" />
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-cy attribute.
       * @example cy.dataCy('greeting')
       */
      loginByRole(
        role: 'super_admin' | 'custom_role' | 'admin',
        permissions?: string[],
      ): Chainable<Element>;
      loginWithPermissions(props: {
        permissions: string[];
        featureFlags?: { [key: string]: boolean }[];
        settingsBody?: any;
      }): Chainable<Element>;
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
      logout(): Chainable<Promise<Element>>;
      setPermissions(permissions: string[]): Chainable<Promise<Element>>;
      apiHandler(props: {
        endpoint: string;
        method: string;
        body?: any;
        baseUrl?: string;
      }): Chainable<Promise<Element>>;
      addSettings(settingsBody: any): Chainable<Promise<Element>>;
    }
  }
}

export {};

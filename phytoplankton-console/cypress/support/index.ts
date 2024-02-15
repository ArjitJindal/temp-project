/// <reference types="cypress" />

import { Feature, TenantSettings } from '../../src/apis';

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
        sessionSuffix?: string,
      ): Chainable<Element>;
      loginWithPermissions(props: {
        permissions: string[];
        features?: Partial<Record<Feature, boolean>>;
        settings?: TenantSettings;
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
      toggleFeatures(features: Partial<Record<Feature, boolean>>): Chainable<Promise<Element>>;
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
      }): Chainable<Promise<Element>>;
      addSettings(settings: TenantSettings): Chainable<Promise<Element>>;
    }
  }
}

export {};

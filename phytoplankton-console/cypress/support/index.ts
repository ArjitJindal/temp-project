/// <reference types="cypress" />

import { Feature, PermissionStatements, TenantSettings } from '../../src/apis';

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
        permissions: PermissionStatements[];
        features?: Partial<Record<Feature, boolean>>;
        settings?: TenantSettings;
        loginWithRole?: 'custom_role' | 'admin';
      }): Chainable<Element>;
      loginByRequest(username: string, password: string): Chainable<Element>;
      multiSelect(preSelector: string, text: string): Chainable<Element>;
      caseAlertAction(action: string): Chainable<Element>;
      checkAndSwitchToTenant(tenantDisplayName: string): Chainable<Promise<Element>>;
      clickTableRowLink(
        rowIndex: number,
        linkDataCy: string,
        tabText: string,
      ): Chainable<Promise<Element>>;
      navigateToPage(url: string, pageTitle: string): Chainable<Promise<Element>>;
      toggleFeatures(features: Partial<Record<Feature, boolean>>): Chainable<Promise<Element>>;
      publicApiHandler(
        method: string,
        endpoint: string,
        requestBody: any,
      ): Chainable<Promise<Element>>;
      closeDrawer(): Chainable<Promise<Element>>;
      closeDrawerWithConfirmation(): Chainable<Promise<Element>>;

      /**
       * Looks for a popup message by a text
       * @param text
       */
      message(text?: string): Chainable<Element>;
      messageBody(text?: string): Chainable<Element>;
      logout(): Chainable<Promise<Element>>;
      setPermissions(permissions: PermissionStatements[]): Chainable<Promise<Element>>;
      apiHandler(props: {
        endpoint: string;
        method: string;
        body?: any;
      }): Chainable<Promise<Element>>;
      addSettings(settings: TenantSettings): Chainable<Promise<Element>>;
      getInputByLabel(label: string, element: 'input' | 'textarea'): Chainable<Element>;
      selectOptionsByLabel(label: string, options: string[]): Chainable<Element>;
      selectRadioByLabel(label: string, value: string): Chainable<Element>;
      selectCheckBoxByLabel(label: string, value: string[]): Chainable<Element>;
      selectSegmentedControl(title: string): Chainable<Element>;
      selectTab(title: string): Chainable<Element>;
      asertInputDisabled(label: string): Chai.Assertion;
      waitNothingLoading(): Chai.Assertion;
      waitSkeletonLoader(): Chai.Assertion;
      assertSkeletonLoader(): Chai.Assertion;
      checkNotification(statement: string[]): Chainable<Element>;
      deleteRuleInstance(ruleInstanceId: string): Chainable<Element>;
      selectAntDropdownByLabel(label: string): Chainable<Element>;
      verifyModalOpen(title?: string): Chainable<Element>;
      assertLoading(): Chai.Assertion;
    }
  }
}

export {};

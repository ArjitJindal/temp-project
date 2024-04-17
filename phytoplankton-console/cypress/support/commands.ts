/// <reference types="cypress" />

import { Feature, TenantSettings } from '../../src/apis';
import { getAccessToken, getAuthTokenKey, getBaseApiUrl, getBaseUrl } from './utils';

Cypress.Commands.add('loginByRole', (role, sessionSuffix = '') => {
  cy.session(
    `login-session-for-${role}-${sessionSuffix}}`,
    () => {
      const username = Cypress.env(`${role}_username`) as string;
      const password = Cypress.env(`${role}_password`) as string;
      const loginUrl = Cypress.env('loginUrl');
      cy.visit(Cypress.config('baseUrl') as string);

      cy.url().should('contains', `${loginUrl}`);
      cy.get('input#username').type(username);
      cy.get('input#password').type(password);
      cy.get('div:not(.ulp-button-bar-hidden) > button[type=submit]')
        .first()
        .click({ force: true });

      cy.location('host', { timeout: 10000 }).should(
        'eq',
        new URL(Cypress.config('baseUrl') as string).host,
      );

      /* eslint-disable-next-line cypress/no-unnecessary-waiting */
      cy.wait(3000);
    },
    { cacheAcrossSpecs: true },
  );
  cy.visit('/');
  cy.intercept('GET', '**/tenants/settings').as('tenantSettings');
  cy.wait('@tenantSettings');
  if (role === 'super_admin') {
    cy.checkAndSwitchToTenant('Cypress Tenant');
  }
});

Cypress.Commands.add('loginWithPermissions', ({ permissions, features = {}, settings }) => {
  cy.loginByRole('super_admin');
  cy.toggleFeatures(features);
  if (settings) {
    cy.addSettings(settings);
  }
  cy.setPermissions(permissions).then(() => {
    cy.loginByRole('custom_role', `${permissions.sort().join('-')}`);
  });
});

Cypress.Commands.add('setPermissions', (permissions) => {
  const roleId = 'rol_BxM56v32qGhImCzc';
  cy.apiHandler({
    endpoint: `roles/${roleId}`,
    method: 'PATCH',
    body: {
      id: roleId,
      name: 'Custom_role',
      description: 'Custom role for RBAC testing',
      permissions: permissions,
    },
  });
});

Cypress.Commands.add('addSettings', (settings) => {
  cy.apiHandler({
    endpoint: 'tenants/settings',
    method: 'POST',
    body: settings,
  });
});

Cypress.Commands.add('apiHandler', ({ endpoint, method, body }) => {
  const baseUrl = getBaseUrl();
  const authTokenKey = getAuthTokenKey();
  const accessToken = getAccessToken(authTokenKey);
  cy.request({
    method: method,
    url: `${baseUrl}${endpoint}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: body,
  });
});

Cypress.Commands.add('logout', () => {
  Cypress.session.clearAllSavedSessions();
});

Cypress.Commands.add('checkAndSwitchToTenant', (tenantDisplayName: string) => {
  cy.intercept('GET', '**/tenants').as('tenants');
  cy.intercept('POST', '**/change_tenant').as('changeTenant');
  cy.visit('/');
  cy.get("button[data-cy='superadmin-panel-button']").should('be.visible').as('superadminButton');
  cy.get('@superadminButton').click();
  cy.get('@superadminButton').then((button) => {
    if (button.text() !== tenantDisplayName) {
      cy.wait('@tenants', { timeout: 15000 }).then((tenantsInterception) => {
        expect(tenantsInterception.response?.statusCode).to.be.oneOf([200, 304]);
        cy.get('.ant-modal .ant-select').first().type(`${tenantDisplayName}{enter}`);
        cy.wait('@changeTenant', { timeout: 15000 }).then((changeTenantInterception) => {
          expect(changeTenantInterception.response?.statusCode).to.eq(200);
        });
        cy.get("button[data-cy='superadmin-panel-button']").should(
          'contain.text',
          tenantDisplayName,
        );
      });
    }
  });
});

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) {
    console.error('Cypress caught "> ResizeObserver error", continuing tests', err);
    return false; // test continues
  }
  return true; // test fails
});

Cypress.Commands.add('loginByRequest', (username: string, password: string) => {
  const env = Cypress.env('environment');
  const scope = 'openid profile email offline_access';
  const client_id = Cypress.env(`${env}_auth0_client_id`);
  const audience = Cypress.env('auth0_audience');
  const options = {
    method: 'POST',
    url: `https://${Cypress.env('auth0_domain')}/oauth/token`,
    body: {
      grant_type: 'password',
      username: username,
      password: password,
      audience: audience,
      scope: scope,
      client_id: client_id,
    },
  };
  cy.request(options).then(({ body: { access_token, expires_in, id_token, token_type } }) => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        `@@auth0spajs@@::${client_id}::${audience}::${scope}`,
        JSON.stringify({
          body: {
            client_id,
            access_token,
            id_token,
            scope,
            expires_in,
            token_type,
            decodedToken: {
              user: JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString('ascii')),
            },
            audience,
          },
          expiresAt: Math.floor(Date.now() / 1000) + expires_in,
        }),
      );
    });
  });
});

Cypress.Commands.add('multiSelect', (preSelector, text) => {
  cy.get(
    `${preSelector} .ant-select > .ant-select-selector > .ant-select-selection-overflow`,
  ).click();
  cy.get(`.ant-select .ant-select-selection-search input`)
    .invoke('attr', 'id')
    .then((_) => {
      cy.get(`${preSelector} .ant-select .ant-select-selection-search input`)
        .eq(0)
        .type(`${text}`, { force: true });
      cy.get(`div[title="${text}"]`).click();
    });
});

Cypress.Commands.add('caseAlertAction', (action: string) => {
  cy.get('div[data-cy="table-footer"] button[data-cy="update-status-button"]', {
    timeout: 8000,
  })
    .contains(action)
    .click();
});

Cypress.Commands.add('message', (text: string) => {
  cy.get('.ant-message').contains(text);
});

Cypress.Commands.add('navigateToPage', (url: string, pageTitle: string) => {
  cy.visit(url, { timeout: 20000 });
  cy.get('h2', { timeout: 20000 }).contains(pageTitle);
  cy.get('[data-test="table"]', { timeout: 20000 });
});

Cypress.Commands.add(
  'clickTableRowLink',
  (rowIndex: number, linkDataCy: string, tabText: string) => {
    cy.get('[data-test="table"]')
      .should('exist')
      .should('be.visible')
      .find(`a[data-cy="${linkDataCy}"]`, { timeout: 20000 })
      .should('be.visible')
      .eq(rowIndex)
      .click({ force: true });
    cy.contains('div[role="tab"]', tabText).should('be.visible');
  },
);

Cypress.Commands.add('toggleFeatures', (features) => {
  if (Object.keys(features).length === 0) {
    return;
  }
  cy.wait('@tenantSettings').then((interception) => {
    const tenantSettings = interception?.response?.body;
    const existingFeatures = (tenantSettings as TenantSettings)?.features ?? [];
    const newFeatures = [...existingFeatures];
    for (const feature in features) {
      const enabled = features[feature];
      if (enabled && !newFeatures.includes(feature as Feature)) {
        newFeatures.push(feature as Feature);
      } else if (!enabled && newFeatures.includes(feature as Feature)) {
        newFeatures.splice(newFeatures.indexOf(feature as Feature), 1);
      }
    }

    if (newFeatures.sort().join(',') !== existingFeatures.sort().join(',')) {
      // Update settings
      cy.apiHandler({
        endpoint: `tenants/settings`,
        method: 'POST',
        body: {
          features: newFeatures,
        },
      });
      cy.reload();
    }
  });
});

Cypress.Commands.add('publicApiHandler', (method, endpoint, requestBody) => {
  cy.apiHandler({
    endpoint: 'tenant/apiKeys',
    method: 'GET',
    body: requestBody,
  }).then((response) => {
    expect(response['status']).to.eq(200);
    const unmaskApiKeyId = response['body'][0].id;
    cy.apiHandler({
      endpoint: `tenant/apiKeys?unmask=true&unmaskApiKeyId=${unmaskApiKeyId}`,
      method: 'GET',
      body: requestBody,
    }).then((response) => {
      expect(response['status']).to.eq(200);
      const apiKey = response['body'][0].key;
      const headers = {
        'tenant-id': 'cypress-tenant',
        'x-api-key': apiKey,
        'content-type': 'application/json',
      };
      const postUrl = getBaseApiUrl();
      const url = `${postUrl}${endpoint}`;
      cy.request({
        method,
        url,
        headers,
        body: requestBody,
      }).then((response) => {
        expect(response.status).to.eq(200);
        /* eslint-disable-next-line cypress/no-unnecessary-waiting */
        cy.wait(3000);
      });
    });
  });
});

Cypress.Commands.add('closeDrawer', () => {
  cy.get('[data-cy="drawer-close-button"]').filter(':visible').first().click();
});

Cypress.Commands.add('getInputByLabel', (label, element) => {
  cy.contains(label)
    .parent('div')
    .parent('div')
    .invoke('attr', 'id')
    .then((parentId) => {
      return cy.get(`#${parentId} ${element}`).first().focus();
    });
});

Cypress.Commands.add('selectOptionsByLabel', (label: string, option: string[]) => {
  cy.getInputByLabel(label, 'input')
    .focus()
    .type(`${option.join('{enter}')}`)
    .blur();
});

Cypress.Commands.add('selectRadioByLabel', (label, option) => {
  cy.contains(label)
    .parent('div')
    .parent('div')
    .within(() => {
      cy.contains(option).click();
    });
});

Cypress.Commands.add('selectCheckBoxByLabel', (label, option) => {
  cy.contains(label)
    .parent('div')
    .parent('div')
    .within(() => {
      option.forEach((opt) => {
        cy.contains(opt).click();
      });
    });
});

Cypress.Commands.add('selectSegmentedControl', (title) => {
  cy.get('div[data-cy="segmented-control"]')
    .first()
    .within(() => {
      cy.contains(title).click();
    });
});

Cypress.Commands.add('selectTab', (title) => {
  cy.get('div[role="tablist"]')
    .first()
    .within(() => {
      cy.contains(title).click();
    });
});

Cypress.Commands.add('asertInputDisabled', (label: string) => {
  expect(cy.getInputByLabel(label, 'input')).to.be.disabled;
});

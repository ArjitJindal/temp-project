/// <reference types="cypress" />

import { Feature, TenantSettings } from '../../src/apis';
import { getAccessToken, getAuthTokenKey, getBaseApiUrl, getBaseUrl } from './utils';

const makeCustomCommandLogger = (commandName: string) => {
  return (message) => {
    Cypress.log({
      name: commandName,
      message: message,
    });
  };
};

Cypress.Commands.add('loginByRole', (role, sessionSuffix = '') => {
  const logger = makeCustomCommandLogger('loginByRole');
  logger(`logging by role "${role}" with session suffix "${sessionSuffix}"`);
  cy.session(
    [`login-session-by-role`, role, sessionSuffix],
    () => {
      cy.intercept('GET', '**/tenants/settings').as('tenantSettings');
      const username = Cypress.env(`${role}_username`) as string;
      const password = Cypress.env(`${role}_password`) as string;
      const loginUrl = Cypress.env('loginUrl');

      logger(`Navigate to 404 page to skip any content loading by default"`);
      cy.visit((Cypress.config('baseUrl') as string) + '404');

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
      logger(
        `Need to wait for page finish loading to make sure auth0 finished setting up the session"`,
      );
      cy.waitNothingLoading();
    },
    {
      cacheAcrossSpecs: true,
    },
  );
  cy.intercept('GET', '**/tenants/settings').as('tenantSettings');
  logger('Navigate to 404 page to skip any content loading by default');
  cy.visit('/404');
  cy.url().should('contains', Cypress.config('baseUrl'));
  cy.waitNothingLoading();
  cy.wait('@tenantSettings', { timeout: 30000 });
  if (role === 'super_admin') {
    cy.checkAndSwitchToTenant('Cypress Tenant');
  }
});

Cypress.Commands.add(
  'loginWithPermissions',
  ({ permissions, features = {}, settings, loginWithRole = 'custom_role' }) => {
    const logger = makeCustomCommandLogger('loginWithPermissions');
    logger(
      `logging with custom permissions (${permissions.length}) and features (${
        Object.keys(features).length
      })`,
    );
    cy.loginByRole('super_admin');
    cy.toggleFeatures(features);
    if (settings) {
      cy.addSettings(settings);
    }
    if (loginWithRole === 'custom_role') {
      cy.setPermissions(permissions).then(() => {
        cy.loginByRole(
          'custom_role',
          'with permissions: ' +
            permissions
              .sort()
              .map(
                (x) =>
                  x.actions.join(',') +
                  ':::' +
                  x.resources.join(',') +
                  (x.filter ? 'filter:' + JSON.stringify(x) : ''),
              )
              .join('; '),
        );
      });
    } else {
      cy.loginByRole('admin');
    }
  },
);

Cypress.Commands.add('setPermissions', (statements) => {
  const logger = makeCustomCommandLogger('setPermissions');
  logger('setPermissions');
  const roleId = 'rol_BxM56v32qGhImCzc';

  cy.apiHandler({
    endpoint: `roles/${roleId}`,
    method: 'PATCH',
    body: {
      id: roleId,
      name: 'Custom_role',
      description: 'Custom role for RBAC testing',
      permissions: [],
      statements,
    },
  });
});

Cypress.Commands.add('addSettings', (settings) => {
  const logger = makeCustomCommandLogger('addSettings');
  logger('addSettings');
  cy.apiHandler({
    endpoint: 'tenants/settings',
    method: 'POST',
    body: settings,
  });
});

Cypress.Commands.add('apiHandler', ({ endpoint, method, body }) => {
  const logger = makeCustomCommandLogger('apiHandler');
  logger('apiHandler');
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
    timeout: 60000,
  });
});

Cypress.Commands.add('logout', () => {
  const logger = makeCustomCommandLogger('logout');
  logger('logout');
  Cypress.session.clearAllSavedSessions();
});

Cypress.Commands.add('checkAndSwitchToTenant', (tenantDisplayName: string) => {
  const logger = makeCustomCommandLogger('checkAndSwitchToTenant');
  logger(`target tenant: "${tenantDisplayName}"`);
  cy.intercept('GET', '**/tenants').as('tenants');
  cy.intercept('POST', '**/change_tenant').as('changeTenant');
  logger('navigate to 404 page to skip any content loading by default');
  cy.visit('/404');
  cy.waitNothingLoading();
  cy.get("button[data-cy='superadmin-panel-button']").then((button) => {
    if (button.text() !== tenantDisplayName) {
      cy.get("button[data-cy='superadmin-panel-button']").click({ force: true });
      cy.verifyModalOpen('Super admin panel');
      cy.waitNothingLoading();
      cy.wait('@tenants').then((tenantsInterception) => {
        expect(tenantsInterception.response?.statusCode).to.be.oneOf([200, 304]);
        cy.singleSelect('*[data-cy="tenant-name"]', tenantDisplayName);
        cy.wait('@changeTenant').then((changeTenantInterception) => {
          expect(changeTenantInterception.response?.statusCode).to.eq(200);
        });
        cy.waitNothingLoading();
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
  const logger = makeCustomCommandLogger('loginByRequest');
  logger('loginByRequest');
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

Cypress.Commands.add('singleSelect', (preSelector, textOrIndex: string | number) => {
  const logger = makeCustomCommandLogger('singleSelect');
  logger('singleSelect');
  cy.get(`${preSelector} *[data-cy~=select-root]:not([data-cy~=disabled])`)
    .first()
    .scrollIntoView();
  if (typeof textOrIndex === 'number') {
    cy.get(`${preSelector} *[data-cy~=select-root]:not([data-cy~=disabled])`).first().click();
    cy.document().within(() => {
      cy.get(`*[data-cy~=select-menu-wrapper][data-cy~=open] *[data-cy^=select-menu]`).within(
        () => {
          cy.get(`*[data-cy^=menu-item-label]:visible`).eq(textOrIndex).click();
        },
      );
    });
  } else {
    cy.get(`${preSelector} *[data-cy~=select-root]:not([data-cy~=disabled])`)
      .first()
      .click()
      .type(`${textOrIndex}`);
    cy.document().within(() => {
      cy.get(`*[data-cy~=select-menu-wrapper][data-cy~=open] *[data-cy^=select-menu]`).within(
        () => {
          cy.get(`*[data-cy^=menu-item-label][title*="${textOrIndex}"]:visible`).first().click();
        },
      );
    });
  }
});

Cypress.Commands.add('multiSelect', (preSelector, options, params = {}) => {
  const logger = makeCustomCommandLogger('multiSelect');
  logger('multiSelect');
  const { fullOptionMatch = false, clear = false } = params;
  const toSelect = Array.isArray(options) ? options : [options];
  cy.get(`${preSelector} *[data-cy~=select-root]:not([data-cy~=disabled])`)
    .first()
    .click({ force: true });
  cy.document().within(() => {
    cy.get(`*[data-cy~=select-menu-wrapper][data-cy~=open] *[data-cy^=select-menu]`)
      .should('be.visible')
      .first()
      .within(() => {
        if (clear) {
          cy.get(`input[type=checkbox]:checked`).uncheck();
        }

        if (!clear && toSelect.length > 0) {
          for (const toSelectElement of toSelect) {
            cy.get(
              `*[data-cy^=menu-item-label][title${
                fullOptionMatch ? '=' : '^='
              }"${toSelectElement}"]`,
            ).click();
          }
        }
      });
  });
});

Cypress.Commands.add('caseAlertAction', (action: string) => {
  const logger = makeCustomCommandLogger('caseAlertAction');
  logger('caseAlertAction');
  cy.get('div[data-cy="table-footer"] button[data-cy="update-status-button"]', {
    timeout: 8000,
  })
    .contains(action)
    .click()
    .should('not.be.disabled');
});

Cypress.Commands.add('message', (text?: string) => {
  const logger = makeCustomCommandLogger('message');
  logger('message');
  cy.get('[data-cy="toast-message-title"]').as('message');
  if (text) {
    cy.get('@message').contains(text);
  }
});

Cypress.Commands.add('messageBody', (text?: string) => {
  const logger = makeCustomCommandLogger('messageBody');
  logger('messageBody');
  cy.get('[data-cy="toast-message-body"]').as('messageBody');
  if (text) {
    cy.get('@messageBody').contains(text);
  }
});

Cypress.Commands.add('navigateToPage', (url: string, pageTitle: string) => {
  const logger = makeCustomCommandLogger('navigateToPage');
  logger(`navigate to "${url}" with page title "${pageTitle}"`);
  cy.visit(url, { timeout: 20000 });
  cy.get('h2', { timeout: 20000 }).contains(pageTitle);
  cy.get('[data-test="table"]', { timeout: 20000 });
});

Cypress.Commands.add(
  'clickTableRowLink',
  (rowIndex: number, linkDataCy: string, tabText: string) => {
    const logger = makeCustomCommandLogger('clickTableRowLink');
    logger(`click row #${rowIndex} with linkDataCy "${linkDataCy}" and tabText "${tabText}"`);
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
  const logger = makeCustomCommandLogger('toggleFeatures');
  logger(`toggle features ${Object.keys(features).join(', ')}`);
  if (Object.keys(features).length === 0) {
    return;
  }
  cy.wait('@tenantSettings', { timeout: 30000 }).then((interception) => {
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
      const hasNotificationFeature = newFeatures.includes('NOTIFICATIONS');
      // Update settings
      cy.apiHandler({
        endpoint: `tenants/settings`,
        method: 'POST',
        body: {
          features: newFeatures,
          ...(hasNotificationFeature
            ? {
                notificationsSubscriptions: {
                  console: [
                    'CASE_ASSIGNMENT',
                    'ALERT_ASSIGNMENT',
                    'CASE_UNASSIGNMENT',
                    'ALERT_UNASSIGNMENT',
                    'CASE_ESCALATION',
                    'ALERT_ESCALATION',
                    'ALERT_COMMENT_MENTION',
                    'CASE_COMMENT_MENTION',
                    'USER_COMMENT_MENTION',
                    'CASE_IN_REVIEW',
                    'ALERT_IN_REVIEW',
                    'ALERT_COMMENT',
                    'CASE_COMMENT',
                    'ALERT_STATUS_UPDATE',
                    'CASE_STATUS_UPDATE',
                    'RISK_CLASSIFICATION_APPROVAL',
                    'RISK_FACTORS_APPROVAL',
                  ],
                },
              }
            : {}),
        },
      });
      cy.reload();
    }
  });
});

Cypress.Commands.add('publicApiHandler', (method, endpoint, requestBody) => {
  const logger = makeCustomCommandLogger('publicApiHandler');
  logger('publicApiHandler');
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
        timeout: 60000,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });
});

Cypress.Commands.add('closeDrawer', () => {
  const logger = makeCustomCommandLogger('closeDrawer');
  logger('closeDrawer');
  cy.get('[data-cy="drawer-close-button"]').filter(':visible').first().click();
});

Cypress.Commands.add('closeDrawerWithConfirmation', () => {
  const logger = makeCustomCommandLogger('closeDrawerWithConfirmation');
  logger('closeDrawerWithConfirmation');
  cy.closeDrawer();
  cy.get('button[data-cy="modal-ok"]').filter(':visible').first().click();
});

Cypress.Commands.add('getInputContainerByLabel', (label: string) => {
  const logger = makeCustomCommandLogger('getInputContainerByLabel');
  logger('getInputContainerByLabel');
  cy.get(`[data-cy~=label]`).contains(label).parent('div').parent('div');
});

Cypress.Commands.add('getInputByLabel', (label, element) => {
  const logger = makeCustomCommandLogger('getInputByLabel');
  logger('getInputByLabel');
  cy.contains(label)
    .parent('div')
    .parent('div')
    .invoke('attr', 'id')
    .then((parentId) => {
      return cy.get(`#${parentId} ${element}`).first().focus();
    });
});

Cypress.Commands.add('selectOptionsByLabel', (label: string, option: string[]) => {
  const logger = makeCustomCommandLogger('selectOptionsByLabel');
  logger('selectOptionsByLabel');
  cy.contains(label)
    .parent('div')
    .parent('div')
    .within(() => {
      cy.multiSelect('', option);
    });
  // hacky way to close the select portal should be updated after FDT-7776
  cy.contains(label).click();
});

Cypress.Commands.add('selectRadioByLabel', (label, option) => {
  const logger = makeCustomCommandLogger('selectRadioByLabel');
  logger('selectRadioByLabel');
  cy.contains(label)
    .parent('div')
    .parent('div')
    .within(() => {
      cy.contains(option).click();
    });
});

Cypress.Commands.add('selectCheckBoxByLabel', (label, option) => {
  const logger = makeCustomCommandLogger('selectCheckBoxByLabel');
  logger('selectCheckBoxByLabel');
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
  const logger = makeCustomCommandLogger('selectSegmentedControl');
  logger('selectSegmentedControl');
  cy.get('div[data-cy="segmented-control"]')
    .first()
    .within(() => {
      cy.contains(title).click();
    });
});

Cypress.Commands.add('selectTab', (title) => {
  const logger = makeCustomCommandLogger('selectTab');
  logger('selectTab');
  cy.get('div[role="tablist"]')
    .first()
    .within(() => {
      cy.contains(title).click();
    });
});

Cypress.Commands.add('asertInputDisabled', (label: string) => {
  const logger = makeCustomCommandLogger('asertInputDisabled');
  logger('asertInputDisabled');
  expect(cy.getInputByLabel(label, 'input')).to.be.disabled;
});

Cypress.Commands.add('waitNothingLoading', () => {
  const logger = makeCustomCommandLogger('waitNothingLoading');
  logger('waitNothingLoading');
  // wait cy loading element to be removed
  cy.document().within(() => {
    cy.get('[data-cy=AppWrapper]', { timeout: 60000 }).should('exist');
  });
  cy.get('.cy-loading,*[data-cy=cy-loading]', { timeout: 60000 }).should('not.exist');
});

Cypress.Commands.add('confirmIfRequired', () => {
  const logger = makeCustomCommandLogger('confirmIfRequired');
  logger('confirmIfRequired');
  cy.waitNothingLoading();
  cy.get('body').then(($body) => {
    const length = $body.find('*[data-cy~="confirmation-modal"][data-cy~="open"]').length;
    if (length > 0) {
      cy.get('*[data-cy="modal-ok"]').click();
      cy.waitNothingLoading();
      cy.get('*[data-cy~="confirmation-modal"][data-cy~="open"]').should('not.exist');
    }
  });
});

Cypress.Commands.add('waitSkeletonLoader', () => {
  const logger = makeCustomCommandLogger('waitSkeletonLoader');
  logger('waitSkeletonLoader');
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="skeleton"]').length > 0) {
      cy.get('[data-cy="skeleton"]', { timeout: 10000 }).should('not.exist');
    } else {
      cy.log('No skeleton found, continuing...');
    }
  });
});

Cypress.Commands.add('assertSkeletonLoader', () => {
  const logger = makeCustomCommandLogger('assertSkeletonLoader');
  logger('assertSkeletonLoader');
  cy.get("[data-cy='skeleton']").should('exist');
  cy.get("[data-cy='skeleton']").should('not.exist');
});

Cypress.Commands.add('assertLoading', () => {
  const logger = makeCustomCommandLogger('assertLoading');
  logger('assertLoading');
  cy.get("[data-cy='cy-loading']").should('exist');
  cy.get("[data-cy='cy-loading']").should('not.exist');
});

function replaceStraightQuotes(text) {
  let toggle = true;
  return text.replace(/'/g, () => {
    const quote = toggle ? '‘' : '’';
    toggle = !toggle;
    return quote;
  });
}

Cypress.Commands.add('scrollDownUntil', (selector: string, checkF) => {
  const logger = makeCustomCommandLogger('scrollDownUntil');
  logger('scrollDownUntil');
  cy.get(selector).then(($container) => {
    return new Promise((resolve, reject) => {
      let iteration = 0;
      const retry = () => {
        if ($container.find('.cy-loading,*[data-cy=cy-loading]').length > 0) {
          setTimeout(retry, 100);
          return;
        }
        if (checkF($container)) {
          resolve(true);
          return;
        }
        iteration++;
        if (iteration > 20) {
          reject('Unable to reach the end of an infinite scroll after 20 iterations');
          return;
        }
        $container.prop('scrollTop', $container.prop('scrollHeight'));
        setTimeout(retry, 100);
      };
      retry();
    });
  });
});

Cypress.Commands.add('checkNotification', (statements: string[]) => {
  const logger = makeCustomCommandLogger('checkNotification');
  logger('checkNotification');
  cy.loginByRole('admin');
  cy.get('div[data-cy="notifications"]').click();
  cy.waitNothingLoading();
  cy.scrollDownUntil('div[data-cy="notifications-drawer-items"]', ($container) => {
    return $container.attr('data-cy')?.split(/\s+/)?.includes('no-more') ?? false;
  });
  cy.waitNothingLoading();
  cy.get('div[data-cy="notification-message"]').then(($elements) => {
    const texts = $elements.map((_index, el) => Cypress.$(el).text()).get();
    for (const statement of statements) {
      expect(texts).to.include(replaceStraightQuotes(statement));
    }
  });
});

Cypress.Commands.add('deleteRuleInstance', (ruleInstanceId: string) => {
  const logger = makeCustomCommandLogger('deleteRuleInstance');
  logger('deleteRuleInstance');
  cy.visit('/rules/my-rules');
  cy.intercept('GET', '**/rule_instances**').as('ruleInstances');
  cy.get('th').contains('Updated at').click({ force: true });
  cy.wait('@ruleInstances').then((interception) => {
    expect(interception.response?.statusCode).to.be.oneOf([200, 304]);
    cy.get('th').contains('Updated at').click({ force: true });
    cy.wait('@ruleInstances').then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 304]);
      cy.get('[data-cy="rule-actions-menu"]').first().click();
      cy.get('[data-cy="rule-delete-button"]').first().should('exist').click();
      cy.get('[data-cy="modal-title"]').should('contain', ruleInstanceId);
      cy.get('button[data-cy="modal-ok"]').eq(0).should('exist').click();
      cy.message(`Rule deleted successfully`).should('exist');
      cy.messageBody(`rule ${ruleInstanceId}`).should('exist');
      cy.get('td[data-cy="ruleId"]').should('not.contain', ruleInstanceId);
    });
  });
});

Cypress.Commands.add('selectAntDropdownByLabel', (label: string) => {
  const logger = makeCustomCommandLogger('selectAntDropdownByLabel');
  logger('selectAntDropdownByLabel');
  cy.get('li[role="menuitem"]').should('be.visible');
  cy.get('li[role="menuitem"]').contains(label).click();
});

Cypress.Commands.add('verifyModalOpen', (title?: string) => {
  const logger = makeCustomCommandLogger('verifyModalOpen');
  logger(`verify modal "${title}" is open`);
  cy.get('.ant-modal').should('be.visible');
  cy.get('.ant-modal-content').should('exist');
  if (title) {
    cy.get('.ant-modal-title').should('contain.text', title);
  }
});

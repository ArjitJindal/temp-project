/// <reference types="cypress" />

Cypress.Commands.add('loginByForm', (inputUsername?: string, inputPassword?: string) => {
  cy.session('login-session', () => {
    const username = (inputUsername || Cypress.env('username')) as string;
    const password = (inputPassword || Cypress.env('password')) as string;
    const loginUrl = Cypress.env('loginUrl');
    cy.visit(Cypress.config('baseUrl') as string);

    cy.url().should('contains', `${loginUrl}`);
    cy.get('input#username').type(username);
    cy.get('input#password').type(password);
    cy.get('div:not(.ulp-button-bar-hidden) > button[type=submit]').first().click({ force: true });

    cy.location('host', { timeout: 10000 }).should(
      'eq',
      new URL(Cypress.config('baseUrl') as string).host,
    );
    /* eslint-disable-next-line cypress/no-unnecessary-waiting */
    cy.wait(3000);
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
  const scope = 'openid profile email offline_access';
  const client_id = Cypress.env('auth0_client_id');
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
      cy.reload();
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
      cy.get(`${preSelector} .ant-select .ant-select-selection-search input`).eq(0).type(`${text}`);
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

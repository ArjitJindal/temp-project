import { random } from 'lodash';
import { PERMISSIONS } from '../../support/permissions';

describe('Custom Role - CRUD Test', () => {
  beforeEach(() => {
    const REQUIRED_PERMISSIONS = [
      ...PERMISSIONS.SETTINGS_ORGANIZATION,
      ...PERMISSIONS.ACCOUNTS,
      ...PERMISSIONS.ROLES,
    ];
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('perform crud operation on custom role', () => {
    cy.visit('/accounts/roles');
    cy.contains('Create role').click();
    const roleName = `Role ${random(0, 1000)}`;
    cy.log(roleName);

    //create a custom role
    cy.get('input[placeholder="Enter role name"]').type(`${roleName}`);
    cy.get('input[placeholder="Enter a description"]').type('Custom test role description');
    cy.contains('Save').click();
    cy.message(`${roleName} role saved`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    //update a custom role
    cy.get('div[data-cy="roles-menu-item"]').contains(roleName).click();
    cy.get('button[data-cy="edit-role"]').click();
    cy.get('input[placeholder="Enter a description"]').type(
      'Custom test role description after changing',
    );
    cy.contains('Save').click();
    cy.message(`${roleName} role saved`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    //delete a custom role
    cy.get('div[data-cy="roles-menu-item"]').contains(`${roleName}`).click();
    cy.get('button[data-cy="edit-role"]').click();
    cy.get('button[data-cy="delete-role"]').click();
    cy.message(`${roleName} was deleted.`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    cy.get('div[data-cy="roles-menu-item"]').contains(`${roleName}`).should('not.exist');
  });
});

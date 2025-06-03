import { random } from 'lodash';
import { PERMISSIONS } from '../../support/permissions';

describe('Custom Role - CRUD Test', () => {
  beforeEach(() => {
    const REQUIRED_PERMISSIONS = [
      ...PERMISSIONS.SETTINGS_ORGANIZATION,
      ...PERMISSIONS.ACCOUNTS,
      ...PERMISSIONS.ROLES,
    ];
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { RBAC_V2: true },
    });
  });

  it('perform crud operation on custom role', () => {
    cy.visit('/accounts/roles');
    cy.contains('Create').click();
    const roleName = `Role ${random(0, 1000)}`;
    cy.log(roleName);

    //create a custom role
    cy.get('input[placeholder="Enter role name"]').type(`${roleName}`);
    cy.get('textarea[placeholder="Enter role description"]').type('Custom test role description');
    cy.get('button[data-cy="save-role-button"]').click();
    cy.message(`Role '${roleName.toLowerCase()}' created successfully`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    //update a custom role
    cy.get(`[data-cy="role-name-${roleName.toLowerCase()}"]`).click();
    cy.get(`[data-cy="edit-role-button-${roleName.toLowerCase()}"]`).click();
    cy.get('textarea[placeholder="Enter role description"]').type(
      'Custom test role description after changing',
    );
    cy.contains('Save').click();
    cy.message(`Role '${roleName.toLowerCase()}' updated successfully`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    //delete a custom role
    cy.get(`[data-cy="delete-role-button-${roleName.toLowerCase()}"]`).click();
    cy.get('button[data-cy="modal-ok"]').click();
    cy.message(`Role "${roleName}" has been deleted`).should('exist');
    cy.message().should('not.exist');
    cy.waitNothingLoading();

    cy.get(`[data-cy="role-name-${roleName.toLowerCase()}"]`).should('not.exist');
  });
});

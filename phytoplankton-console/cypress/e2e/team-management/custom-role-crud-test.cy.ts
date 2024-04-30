import { random } from 'lodash';
import { PERMISSIONS } from '../../support/permissions';

describe('Custom Role - CRUD Test', () => {
  beforeEach(() => {
    const REQUIRED_PERMISSIONS = [...PERMISSIONS.SETTINGS_ORGANIZATION];
    cy.loginWithPermissions({ permissions: REQUIRED_PERMISSIONS });
  });

  it('perform crud operation on custom role', async () => {
    cy.visit('/accounts/roles');
    cy.contains('Create role').click();
    const roleName = `Role ${random(0, 1000)}`;
    cy.log(roleName);

    //create a custom role
    cy.get('input[placeholder="Enter role name"]').type(`${roleName}`);
    cy.get('input[placeholder="Enter a description"]').type('Custom test role description');
    cy.intercept('GET', '**/roles**').as('custom-roles-save');
    cy.contains('Save').click();
    cy.wait('@custom-roles-save').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });

    //update a custom role
    cy.get('div[data-cy="configure-roles"]').contains(roleName).click();
    cy.get('button[data-cy="edit-role"]').click();
    cy.get('input[placeholder="Enter a description"]').type(
      'Custom test role description after changing',
    );
    cy.contains('Save').click();
    cy.wait('@custom-roles-save').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });

    //delete a custom role
    cy.get('div[data-cy="configure-roles"]').contains(`${roleName}`).click();
    cy.get('button[data-cy="edit-role"]').click();
    cy.get('button[data-cy="delete-role"]').click();
    cy.wait('@custom-roles-save').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });
  });
});

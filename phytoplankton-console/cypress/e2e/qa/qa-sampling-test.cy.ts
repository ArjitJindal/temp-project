import { PERMISSIONS } from '../../support/permissions';

describe('QA Assignee Column', () => {
  let qaFlag = false;
  beforeEach(() => {
    const REQUIRED_PERMISSIONS = [
      ...PERMISSIONS.CASE_OVERVIEW,
      ...PERMISSIONS.QA,
      ...PERMISSIONS.CASE_DETAILS,
      ...PERMISSIONS.TRANSACTION_OVERVIEW,
    ];
    cy.loginWithPermissions({
      permissions: REQUIRED_PERMISSIONS,
      features: { QA: qaFlag },
    });
  });

  it('Dropdown should not be visible if QA flag is false', () => {
    cy.visit('/case-management/cases');
    cy.reload();
    cy.get('[data-cy="qa-sampling-dropdown"]').should('not.exist');
    qaFlag = true;
  });

  it('Should Create a Sample if QA flag is true', () => {
    cy.visit('/case-management/cases');
    cy.get('[data-cy="qa-toggle"]').click();
    cy.get('[data-cy="segmented-control-qa-unchecked-alerts"]').click();
    cy.get('[data-cy="qa-sampling-dropdown"]').should('exist').click();
    cy.get('.ant-dropdown-menu-item').first().click();
    const sampleName = 'Sample ' + Math.floor(Math.random() * 1000);
    cy.get('.ant-modal-root input').eq(0).type(sampleName);
    cy.get('.ant-modal-root textarea').type('This is a test sample');
    cy.get('[data-cy="sampling-quantity"]').should('exist').first().type('1');
    cy.get('.ant-modal-footer [data-cy="modal-ok"]').click();
    cy.get('[data-cy="qa-sampling-dropdown"]').should('exist').click();
    cy.get('.ant-dropdown-menu-item').eq(1).click();
    cy.get('[data-cy="samplingName"]').first().should('have.text', sampleName);
    cy.get('[data-cy="sampling-id"]').first().click();
    cy.get('[data-cy="alert-id"]').should('exist');
    const editSampleName = 'Edit Sample ' + Math.floor(Math.random() * 1000);
    cy.get('[data-cy="edit-sampling"]').click();
    cy.get('.ant-modal-root input').eq(0).clear().type(editSampleName);
    cy.get('.ant-modal-footer [data-cy="modal-ok"]').click();
    cy.get('[data-cy="samplingName"] p').first().should('have.text', editSampleName);
    cy.visit('/case-management/cases');
    cy.get('[data-cy="row-table-checkbox"]').first().click();
    cy.get('[data-cy="create-sample-button"]').click();
    const manualSampleName = 'Manual Sample ' + Math.floor(Math.random() * 1000);
    cy.get('.ant-modal-root input').eq(0).type(manualSampleName);
    cy.get('.ant-modal-root textarea').type('This is a manual test sample');
    cy.get('.ant-modal-footer [data-cy="modal-ok"]').click();
    cy.get('[data-cy="qa-sampling-dropdown"]').should('exist').click();
    cy.get('.ant-dropdown-menu-item').eq(1).click();
    cy.get('[data-cy="samplingName"]').first().should('have.text', manualSampleName);
  });
});

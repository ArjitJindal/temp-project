describe('Checklkist Crud', () => {
  beforeEach(() => {
    cy.loginByRole('admin');
  });

  it('perform crud operation on checklist', () => {
    cy.visit('/settings/case-management');
    cy.intercept('POST', '**/checklist-templates**').as('checklist-templates-post');
    cy.intercept('GET', '**/checklist-templates**').as('checklist-templates-get');

    //create checklist template
    const randomNumber = Math.floor(Math.random() * 10000);
    const checklistText = `Test ${randomNumber}`;
    const checklistDescription = `Test Description-${randomNumber}`;
    cy.contains('Create template').click();
    cy.get('input[placeholder="Enter text"]').eq(0).type(checklistText);
    cy.get('input[placeholder="Enter text"]').eq(1).type(checklistDescription);
    cy.get('button[data-cy="next-button"]').click();
    cy.get('button[data-cy="add-new-category-button"]').click();
    cy.get('input[placeholder="Enter checklist category name"]').eq(0).type('Test');
    cy.get('button[data-cy="add-new-checklist-item-button"]').eq(0).click();
    cy.get('div[data-cy="checklist-item-text-area"]').type('Test');
    cy.get('button[data-cy="check-button"]').click();
    cy.get('button[data-cy="next-button"]').click();
    cy.get('label[data-cy="Property/p1Errors"]').find('input').type('0');
    cy.get('label[data-cy="Property/p2Errors"]').find('input').type('0');
    cy.get('button[data-cy="action-button"]').contains('Create').click({ force: true });
    cy.wait(`@checklist-templates-post`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);
    cy.wait(`@checklist-templates-get`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //update checklist template
    cy.contains('td', checklistText)
      .parent()
      .find('.ant-space-item button')
      .contains('Edit')
      .click({ force: true });
    cy.get('input[placeholder="Enter text"]').eq(1).type(` Updated`);
    cy.get('button[data-cy="next-button"]').click();
    cy.get('button[data-cy="next-button"]').click();
    cy.get('button[data-cy="action-button"]').contains('Update').click({ force: true });

    //check if checklist template is showing when still in draft
    cy.visit('/rules/rules-library');
    cy.get('button[data-cy="configure-rule-button"]').first().click();
    cy.contains('Checklist details').click();
    cy.get('.ant-select-selector').click();
    cy.get('.ant-select-selector').each(($el) => {
      const text = $el.text().trim();
      expect(text).not.to.contain(checklistText);
    });

    //making checklist template from draft to acive
    cy.visit('/settings/case-management');
    cy.contains('td', checklistText)
      .parent()
      .find('button[data-cy="status-button"]')
      .contains('Draft')
      .click({ force: true });
    cy.get('button[data-cy="modal-ok"]').click();
    cy.wait(`@checklist-templates-get`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //making sure that we cannot update the checklist after making into acive
    cy.contains('td', checklistText)
      .parent()
      .find('button[data-cy="edit-button"]')
      .contains('View');

    //making sure that checklist template shows in the rules configuration
    cy.visit('/rules/rules-library');
    cy.get('button[data-cy="configure-rule-button"]').first().click();
    cy.contains('Checklist details').click();
    cy.get('.ant-select-selector').click();
    cy.contains(checklistText);

    //deleting the checklist template
    cy.visit('/settings/case-management');
    cy.contains('td', checklistText)
      .parent()
      .find('button[data-cy="delete-button"]')
      .contains('Delete')
      .click({ force: true });
    cy.get('button[data-cy="modal-ok"]').click();
    cy.wait(`@checklist-templates-get`, { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 304]);

    //check if checklist template is not shown after it is deleted
    cy.visit('/rules/rules-library');
    cy.get('button[data-cy="configure-rule-button"]').first().click();
    cy.contains('Checklist details').click();
    cy.get('.ant-select-selector').click();
    cy.get('.ant-select-selector').each(($el) => {
      const text = $el.text().trim();
      expect(text).not.to.contain(checklistText);
    });
  });
});

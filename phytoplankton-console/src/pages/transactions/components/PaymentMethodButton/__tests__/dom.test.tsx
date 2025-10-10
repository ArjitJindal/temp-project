import { test, expect } from '@jest/globals';

import React from 'react';
import { render, screen } from 'testing-library-wrapper';
import Component from '..';

test('Proper title formatting', async () => {
  render(<Component direction={'ORIGIN'} methods={['card', 'IBAN']} onConfirm={() => {}} />);
  const result = await screen.findByText(`Origin payment method: card, IBAN`);
  expect(result).not.toBeNull();
});

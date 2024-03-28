import { test, expect } from '@jest/globals';

import React from 'react';
import { render, screen } from 'testing-library-wrapper';
import Component from '../index';

test('Proper role humanization', async () => {
  render(<Component role="root" />);
  const result = await screen.findByText(`Root`);
  expect(result).not.toBeNull();
});

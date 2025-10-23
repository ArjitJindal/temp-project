/**
 * Tests for CSP utilities
 */

import { describe, expect } from '@jest/globals';
import { CSPStyleManager, CSPScriptLoader, CSPViolationReporter } from '../csp-utils';

describe('CSPStyleManager', () => {
  beforeEach(() => {
    CSPStyleManager.clear();
  });

  test('should generate CSS class for inline styles', () => {
    const styles = { color: 'red', fontSize: '14px' };
    const className = CSPStyleManager.getCSSClass(styles);

    expect(/^csp-style-\d+$/.test(className)).toBe(true);
  });

  test('should reuse CSS class for identical styles', () => {
    const styles = { color: 'red', fontSize: '14px' };
    const className1 = CSPStyleManager.getCSSClass(styles);
    const className2 = CSPStyleManager.getCSSClass(styles);

    expect(className1).toBe(className2);
  });

  test('should generate different CSS classes for different styles', () => {
    const styles1 = { color: 'red' };
    const styles2 = { color: 'blue' };

    const className1 = CSPStyleManager.getCSSClass(styles1);
    const className2 = CSPStyleManager.getCSSClass(styles2);

    expect(className1).not.toBe(className2);
  });

  test('should generate CSS rules', () => {
    const styles = { color: 'red', fontSize: '14px' };
    CSPStyleManager.getCSSClass(styles);

    const css = CSPStyleManager.getGeneratedCSS();
    expect(css).toContain('color: red');
    expect(css).toContain('font-size: 14px');
  });
});

describe('CSPViolationReporter', () => {
  beforeEach(() => {
    CSPViolationReporter.clearViolations();
  });

  test('should initialize without errors', () => {
    expect(() => CSPViolationReporter.init()).not.toThrow();
  });

  test('should start with empty violations', () => {
    const violations = CSPViolationReporter.getViolations();
    expect(violations).toEqual([]);
  });

  test('should clear violations', () => {
    // Simulate adding a violation
    CSPViolationReporter.clearViolations();
    const violations = CSPViolationReporter.getViolations();
    expect(violations).toEqual([]);
  });
});

describe('CSPScriptLoader', () => {
  // Mock DOM methods
  const mockAppendChild = jest.fn();
  const mockQuerySelector = jest.fn();

  beforeEach(() => {
    // Mock document methods
    Object.defineProperty(document, 'querySelector', {
      value: mockQuerySelector,
      writable: true,
    });

    Object.defineProperty(document, 'createElement', {
      value: jest.fn(() => ({
        src: '',
        async: false,
        defer: false,
        nonce: '',
        onload: null,
        onerror: null,
        appendChild: mockAppendChild,
      })),
      writable: true,
    });

    Object.defineProperty(document, 'head', {
      value: { appendChild: mockAppendChild },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should load script with correct attributes', async () => {
    mockQuerySelector.mockReturnValue(null); // Script not already loaded

    const createElementSpy = jest.spyOn(document, 'createElement');
    const mockScript = {
      src: '',
      async: false,
      defer: false,
      nonce: '',
      onload: null,
      onerror: null,
    } as any;

    createElementSpy.mockReturnValue(mockScript);

    // Simulate successful script load
    const loadPromise = CSPScriptLoader.loadScript('https://example.com/script.js', {
      async: true,
      defer: true,
      nonce: 'test-nonce',
    });

    // Trigger the onload callback
    if (mockScript.onload) {
      mockScript.onload();
    }

    await loadPromise;

    expect(createElementSpy).toHaveBeenCalledWith('script');
    expect(mockAppendChild).toHaveBeenCalled();
  });

  test('should not load script if already exists', async () => {
    mockQuerySelector.mockReturnValue({}); // Script already exists

    const createElementSpy = jest.spyOn(document, 'createElement');

    await CSPScriptLoader.loadScript('https://example.com/script.js');

    expect(createElementSpy).not.toHaveBeenCalled();
  });
});

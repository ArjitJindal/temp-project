/**
 * CSP (Content Security Policy) Utilities
 *
 * This file provides utilities to help migrate from inline styles to CSP-compliant approaches.
 * It helps identify and replace inline styles with CSS classes or CSS-in-JS solutions.
 */

import { CSSProperties } from 'react';

/**
 * Type for style objects that can be converted to CSS classes
 */
export type StyleObject = CSSProperties;

/**
 * Utility to generate CSS class names for common inline styles
 * This helps migrate from inline styles to CSS classes
 */
export class CSPStyleManager {
  private static styleMap = new Map<string, string>();
  private static counter = 0;

  /**
   * Convert inline styles to CSS class names
   * This is a temporary solution during migration - ideally all styles should be in CSS files
   */
  static getCSSClass(styles: StyleObject): string {
    const styleString = this.serializeStyles(styles);

    if (this.styleMap.has(styleString)) {
      return this.styleMap.get(styleString) ?? '';
    }

    const className = `csp-style-${++this.counter}`;
    this.styleMap.set(styleString, className);

    // In a real implementation, you would inject this CSS into the document
    // For now, this is a placeholder for the migration process
    console.warn(
      `CSP Migration: Inline styles detected. Consider moving to CSS class: ${className}`,
    );

    return className;
  }

  /**
   * Serialize style object to CSS string
   */
  private static serializeStyles(styles: StyleObject): string {
    return Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');
  }

  /**
   * Convert camelCase to kebab-case
   */
  private static camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Get all generated CSS rules
   * This should be called to generate the CSS file during build
   */
  static getGeneratedCSS(): string {
    const rules: string[] = [];

    for (const [styleString, className] of this.styleMap.entries()) {
      rules.push(`.${className} { ${styleString} }`);
    }

    return rules.join('\n');
  }

  /**
   * Clear the style map (useful for testing)
   */
  static clear(): void {
    this.styleMap.clear();
    this.counter = 0;
  }
}

/**
 * Hook to help migrate inline styles to CSS classes
 * Usage: const className = useCSPStyle({ color: 'red', fontSize: '14px' });
 */
export function useCSPStyle(styles: StyleObject): string {
  return CSPStyleManager.getCSSClass(styles);
}

/**
 * Common inline style patterns that should be converted to CSS classes
 */
export const COMMON_INLINE_STYLES = {
  FLEX_CENTER: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  FLEX_COLUMN: {
    display: 'flex',
    flexDirection: 'column',
  },
  FLEX_ROW: {
    display: 'flex',
    flexDirection: 'row',
  },
  GRID_CENTER: {
    display: 'grid',
    placeItems: 'center',
  },
  HIDDEN: {
    display: 'none',
  },
  VISIBLE: {
    display: 'block',
  },
} as const;

/**
 * CSP-compliant script loading utility
 * Replaces dynamic script creation with CSP-compliant approaches
 */
export class CSPScriptLoader {
  /**
   * Load external scripts in a CSP-compliant way
   * Scripts should be whitelisted in the CSP policy
   */
  static async loadScript(
    src: string,
    options: {
      async?: boolean;
      defer?: boolean;
      nonce?: string;
    } = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = options.async ?? true;
      script.defer = options.defer ?? false;

      if (options.nonce) {
        script.nonce = options.nonce;
      }

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

      document.head.appendChild(script);
    });
  }

  /**
   * Load Freshworks widget in a CSP-compliant way
   */
  static async loadFreshworksWidget(widgetId: string): Promise<void> {
    // Ensure the script source is whitelisted in CSP
    const scriptSrc = `https://widget.freshworks.com/widgets/${widgetId}.js`;

    // Set widget settings before loading
    (window as any).fwSettings = { widget_id: widgetId, locale: 'en' };

    await this.loadScript(scriptSrc);
  }
}

/**
 * CSP violation reporter
 * Helps identify CSP violations during development
 */
export class CSPViolationReporter {
  private static violations: string[] = [];

  static init(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
      };

      this.violations.push(JSON.stringify(violation));
      console.error('CSP Violation:', violation);
    });
  }

  static getViolations(): string[] {
    return [...this.violations];
  }

  static clearViolations(): void {
    this.violations = [];
  }
}

/**
 * Initialize CSP utilities
 */
export function initCSPUtils(): void {
  CSPViolationReporter.init();
}

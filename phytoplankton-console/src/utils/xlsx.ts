const EXCEL_CHAR_LIMIT = Math.pow(2, 15) - 1;

export function xlsxValue(value: unknown): string {
  if (value === null || value === '' || value === undefined) {
    return '-';
  }

  let str: string;

  if (typeof value === 'number' || typeof value === 'boolean') {
    str = value.toString();
  } else if (typeof value === 'string') {
    if (value.trim() === '' || value.trim() === '""') {
      return '-';
    }
    str = value;
  } else if (Array.isArray(value)) {
    str = value.join(', ');
  } else {
    str = JSON.stringify(value);
  }

  str = str.replace(/"/g, '');

  if (str.length > EXCEL_CHAR_LIMIT) {
    const label = '... (TRUNCATED)';
    str = str.substring(0, EXCEL_CHAR_LIMIT - label.length) + label;
  }
  return str;
}

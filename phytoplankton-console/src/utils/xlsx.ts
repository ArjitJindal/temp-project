export function xlsxValue(value: unknown): string {
  if (value === null || value === '') {
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

  return str;
}

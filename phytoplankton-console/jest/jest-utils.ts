import { screen, within, queryHelpers } from './testing-library-wrapper';

export function getNotNull<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error(`Can not be null`);
  }
  return value;
}

export async function getByClass(container: HTMLElement, className: string) {
  return await queryHelpers.queryByAttribute('class', container, (value) => {
    return value.split(' ').some((x) => x === className);
  });
}

export async function findByClass(container: HTMLElement, className: string) {
  return await queryHelpers.queryAllByAttribute('class', container, (value) => {
    return value.split(' ').some((x) => x === className);
  });
}

export async function findCheckbox(testName: string, container?: HTMLElement) {
  return await (container ? within(container) : screen).findByTestId(`${testName}-checkbox`);
}

import '@testing-library/jest-dom';
import { describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import StepButtons from '..';
import {
  findActionButton,
  clickPreviousButton,
  clickNextButton,
  clickActionButton,
  expectButtonVisible,
} from './step-button.jest-helpers';

describe('StepButtons', () => {
  it('renders the component with basic case', () => {
    render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={() => {}}
        onPrevious={() => {}}
      />,
    );

    expectButtonVisible('Previous');
    expectButtonVisible('Next');
  });

  it('renders the component with action', async () => {
    render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={true}
        onNext={() => {}}
        onPrevious={() => {}}
        actionProps={{
          actionText: 'Save',
          onAction: () => null,
        }}
      />,
    );

    expectButtonVisible('Previous');
    const saveButton = findActionButton('Save');
    expect(saveButton).toBeInTheDocument();
  });

  it('calls onPrevious when Previous button is clicked', async () => {
    const onPreviousMock = jest.fn();
    render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={() => {}}
        onPrevious={onPreviousMock}
      />,
    );

    await clickPreviousButton();
    expect(onPreviousMock).toHaveBeenCalled();
  });

  it('calls onNext when Next button is clicked', async () => {
    const onNextMock = jest.fn();
    render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={onNextMock}
        onPrevious={() => {}}
      />,
    );

    await clickNextButton();
    expect(onNextMock).toHaveBeenCalled();
  });

  it('calls onAction when Action button is clicked', async () => {
    const onActionMock = jest.fn();
    render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={true}
        onNext={() => {}}
        onPrevious={() => {}}
        actionProps={{
          actionText: 'Save',
          onAction: onActionMock,
        }}
      />,
    );

    await clickActionButton('Save');
    expect(onActionMock).toHaveBeenCalled();
  });
});

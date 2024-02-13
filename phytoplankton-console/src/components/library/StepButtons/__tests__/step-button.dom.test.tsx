import '@testing-library/jest-dom';
import { describe, expect } from '@jest/globals';
import { render, fireEvent, screen } from 'testing-library-wrapper';
import StepButtons from '..';

describe('StepButtons', () => {
  it('renders the component with basic case', () => {
    const { getByText } = render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={() => {}}
        onPrevious={() => {}}
      />,
    );

    expect(getByText('Previous')).toBeInTheDocument();
    expect(getByText('Next')).toBeInTheDocument();
  });

  it('renders the component with action', async () => {
    const { getByText } = render(
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

    expect(getByText('Previous')).toBeInTheDocument();
    const saveButton = await screen.findByText('Save');
    expect(saveButton).toBeInTheDocument();
  });

  it('calls onPrevious when Previous button is clicked', () => {
    const onPreviousMock = jest.fn();
    const { getByText } = render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={() => {}}
        onPrevious={onPreviousMock}
      />,
    );

    fireEvent.click(getByText('Previous'));
    expect(onPreviousMock).toHaveBeenCalled();
  });

  it('calls onNext when Next button is clicked', () => {
    const onNextMock = jest.fn();
    const { getByText } = render(
      <StepButtons
        prevDisabled={false}
        nextDisabled={false}
        onNext={onNextMock}
        onPrevious={() => {}}
      />,
    );

    fireEvent.click(getByText('Next'));
    expect(onNextMock).toHaveBeenCalled();
  });

  it('calls onAction when Action button is clicked', () => {
    const onActionMock = jest.fn();
    const { getByText } = render(
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

    fireEvent.click(getByText('Save'));
    expect(onActionMock).toHaveBeenCalled();
  });
});

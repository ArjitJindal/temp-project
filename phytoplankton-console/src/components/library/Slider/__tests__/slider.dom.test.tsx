import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, fireEvent, screen } from 'testing-library-wrapper';
import '@testing-library/jest-dom/extend-expect';
import Slider from '..';
import '@testing-library/jest-dom';

describe('Slider Component', () => {
  const mockOnChange = jest.fn();
  const renderSlider = (props) => {
    return render(<Slider {...props} onChange={mockOnChange} />);
  };

  it('renders Single mode correctly', () => {
    renderSlider({
      mode: 'SINGLE',
      value: 50,
      min: 0,
      max: 100,
      isDisabled: false,
    });

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();

    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('renders Range mode correctly', () => {
    renderSlider({
      mode: 'RANGE',
      value: [30, 70],
      min: 0,
      max: 100,
      isDisabled: false,
      startExclusive: true,
      endExclusive: true,
    });

    // Check if the range slider is rendered
    const rangeSlider = screen.getAllByRole('slider');
    expect(rangeSlider).toHaveLength(2);

    // Check if the range slider has the correct values
    expect(rangeSlider[0]).toHaveAttribute('aria-valuenow', '30');
    expect(rangeSlider[1]).toHaveAttribute('aria-valuenow', '70');
  });

  it('calls onChange when slider value changes', () => {
    const handleChange = jest.fn();

    const { getByTestId } = render(
      <Slider mode="SINGLE" value={50} min={0} max={100} onChange={handleChange} />,
    );

    const slider = getByTestId('age-range-slider')?.querySelector('.ant-slider') as any;

    fireEvent.mouseDown(slider);
    fireEvent.mouseMove(slider, { clientX: 70 });
    fireEvent.mouseUp(slider);

    expect(handleChange).toHaveBeenCalled();
  });

  it('handles disabled state', () => {
    const handleChange = jest.fn();

    const { getByTestId } = render(
      <Slider
        mode="SINGLE"
        value={50}
        min={0}
        max={100}
        onChange={handleChange}
        isDisabled={true}
      />,
    );

    const slider = getByTestId('age-range-slider')?.querySelector('.ant-slider') as any;

    // Attempt to interact with the disabled slider
    fireEvent.mouseDown(slider);

    // Check if onChange is not called
    expect(handleChange).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen } from 'testing-library-wrapper';
import Drawer from '..';

const props = {
  isVisible: true,
  title: 'Test Drawer',
  onChangeVisibility: jest.fn(),
  children: <div>Drawer Content</div>,
};

describe('Drawer Component', () => {
  it('renders Drawer component with title', () => {
    render(<Drawer {...props} />);
    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
  });

  it('closes Drawer on click outside when clickAway is enabled', () => {
    render(<Drawer {...props} isClickAwayEnabled />);
    fireEvent.click(document.body);
    setTimeout(() => {
      expect(props.onChangeVisibility).toHaveBeenCalledWith(false);
    }, 0);
  });

  it('closes Drawer on clicking the close button', () => {
    render(<Drawer {...props} />);
    fireEvent.click(screen.getByTestId('drawer-close-button'));
    expect(props.onChangeVisibility).toHaveBeenCalledWith(false);
  });

  it('renders Drawer with children', () => {
    render(<Drawer {...props} />);
    expect(screen.getByText('Drawer Content')).toBeInTheDocument();
  });

  it('renders Drawer with footer', () => {
    render(<Drawer {...props} footer={<div>Footer Content</div>} />);
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('renders Drawer with description', () => {
    const propsWithDescription = {
      ...props,
      description: 'Test Description',
    };
    render(<Drawer {...propsWithDescription} />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders Drawer with right-aligned buttons in footer', () => {
    const propsWithRightAlignedFooter = {
      ...props,
      footer: (
        <div>
          <button>Cancel</button>
          <button>Save</button>
        </div>
      ),
      rightAlignButtonsFooter: true,
    };
    render(<Drawer {...propsWithRightAlignedFooter} />);
    const footer = screen.getByTestId('drawer-footer');
    expect(footer).toHaveClass(
      'src_components_library_Drawer_index_module_less___rightAlignButtonsFooter',
    );
  });
});

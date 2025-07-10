import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen } from 'testing-library-wrapper';
import Drawer from '..';
import s from '../index.module.less';

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
      footerRight: (
        <div>
          <button>Cancel</button>
          <button>Save</button>
        </div>
      ),
    };
    render(<Drawer {...propsWithRightAlignedFooter} />);
    const footerSections = screen.getAllByClassName(s.footerSection);
    expect(footerSections).toHaveLength(1);
    const [footerSection] = footerSections;
    expect(footerSection).toHaveClass(s.right);
  });

  it('shows confirmation dialog when closing Drawer with unsaved changes', () => {
    const onChangeVisibility = jest.fn();
    render(<Drawer {...props} hasChanges={true} onChangeVisibility={onChangeVisibility} />);

    fireEvent.click(screen.getByTestId('drawer-close-button'));

    expect(
      screen.getByText(
        'Are you sure you want to close the drawer? You will lose all unsaved changes.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(onChangeVisibility).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('drawer-close-button'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(onChangeVisibility).toHaveBeenCalledWith(false);
  });

  it('does not show confirmation dialog when closing Drawer without unsaved changes', () => {
    const onChangeVisibility = jest.fn();
    render(<Drawer {...props} hasChanges={false} onChangeVisibility={onChangeVisibility} />);

    fireEvent.click(screen.getByTestId('drawer-close-button'));

    expect(screen.queryByText('Are you sure you want to close?')).not.toBeInTheDocument();
    expect(onChangeVisibility).toHaveBeenCalledWith(false);
  });
});

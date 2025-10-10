import { describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import Drawer from '..';
import {
  findDrawerTitle,
  findDrawerContent,
  findFooterContent,
  findDescription,
  clickCloseButton,
  clickButton,
  expectFooterAlignment,
  expectConfirmationDialogVisible,
} from './drawer.jest-helpers';

const props = {
  isVisible: true,
  title: 'Test Drawer',
  onChangeVisibility: jest.fn(),
  children: <div>Drawer Content</div>,
};

describe('Drawer Component', () => {
  it('renders Drawer component with title', () => {
    render(<Drawer {...props} />);
    expect(findDrawerTitle('Test Drawer')).toBeInTheDocument();
  });

  it('closes Drawer on clicking the close button', async () => {
    render(<Drawer {...props} />);
    await clickCloseButton();
    expect(props.onChangeVisibility).toHaveBeenCalledWith(false);
  });

  it('renders Drawer with children', () => {
    render(<Drawer {...props} />);
    expect(findDrawerContent('Drawer Content')).toBeInTheDocument();
  });

  it('renders Drawer with footer', () => {
    render(<Drawer {...props} footer={<div>Footer Content</div>} />);
    expect(findFooterContent('Footer Content')).toBeInTheDocument();
  });

  it('renders Drawer with description', () => {
    const propsWithDescription = {
      ...props,
      description: 'Test Description',
    };
    render(<Drawer {...propsWithDescription} />);
    expect(findDescription('Test Description')).toBeInTheDocument();
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
    expectFooterAlignment('right');
  });

  it('shows confirmation dialog when closing Drawer with unsaved changes', async () => {
    const onChangeVisibility = jest.fn();
    render(<Drawer {...props} hasChanges={true} onChangeVisibility={onChangeVisibility} />);

    await clickCloseButton();

    expectConfirmationDialogVisible(
      true,
      'Are you sure you want to close the drawer? You will lose all unsaved changes.',
    );

    await clickButton('Cancel');
    expect(onChangeVisibility).not.toHaveBeenCalled();

    await clickCloseButton();
    await clickButton('Confirm');
    expect(onChangeVisibility).toHaveBeenCalledWith(false);
  });

  it('does not show confirmation dialog when closing Drawer without unsaved changes', async () => {
    const onChangeVisibility = jest.fn();
    render(<Drawer {...props} hasChanges={false} onChangeVisibility={onChangeVisibility} />);

    await clickCloseButton();

    expectConfirmationDialogVisible(false, 'Are you sure you want to close?');
    expect(onChangeVisibility).toHaveBeenCalledWith(false);
  });
});

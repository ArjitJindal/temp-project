import { describe, expect } from '@jest/globals';
import { render, screen, fireEvent } from 'testing-library-wrapper';
import Modal from '..';
import {
  findModalTitle,
  clickCloseButton,
  clickOkButton,
  expectOkButtonVisible,
  expectHeaderVisible,
  expectFooterVisible,
  findTab,
  clickTab,
  expectTabContentVisible,
} from './modal.jest-helpers';

const MockChildComponent = ({ onChildClick }) => {
  return <button onClick={onChildClick}>Child Component Button</button>;
};

describe('Modal Component', () => {
  it('renders modal with title and content', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} title="Test Modal" onCancel={onCancelMock} />);
    const title = findModalTitle('Test Modal');
    expect(title).toBeInTheDocument();
  });
  it('calls onCancel callback when close button is clicked', async () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} onCancel={onCancelMock} />);
    await clickCloseButton();
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
  it('calls onOk callback when OK button is clicked', async () => {
    const onOkMock = jest.fn();
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} onOk={onOkMock} onCancel={onCancelMock} />);
    await clickOkButton();
    expect(onOkMock).toHaveBeenCalledTimes(1);
  });
  it('does not render OK button when hideOk is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideOk={true} onCancel={onCancelMock} />);
    expectOkButtonVisible(false);
  });

  it('does not render header when hideHeader is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideHeader={true} onCancel={onCancelMock} />);
    expectHeaderVisible(false);
  });
  it('does not render footer when hideFooter is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideFooter={true} onCancel={onCancelMock} />);
    expectFooterVisible(false);
  });
  it('renders cancel button with custom text', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} cancelText="Close" onCancel={onCancelMock} />);
    const cancelButton = screen.getByText('Close');
    expect(cancelButton).toBeInTheDocument();
  });
  it('renders OK button with custom text', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} okText="Submit" onCancel={onCancelMock} />);
    const okButton = screen.getByText('Submit');
    expect(okButton).toBeInTheDocument();
  });
  it('renders modal with tabs', () => {
    const onCancelMock = jest.fn();
    render(
      <Modal
        isOpen={true}
        tabs={[
          { title: 'Tab 1', key: 'Tab 1 Content' },
          { title: 'Tab 2', key: 'Tab 2 Content' },
        ]}
        onCancel={onCancelMock}
      />,
    );
    const tab1 = findTab('Tab 1');
    const tab2 = findTab('Tab 2');
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();
  });
  it('renders modal with custom icon', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} icon={<div>Icon</div>} onCancel={onCancelMock} />);
    const icon = screen.getByText('Icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders content of the active tab', async () => {
    const onCancelMock = jest.fn();
    render(
      <Modal
        isOpen={true}
        tabs={[
          { title: 'Tab 1', key: 'Tab 1 Content', children: <div>Tab 1 Content</div> },
          { title: 'Tab 2', key: 'Tab 2 Content', children: <div>Tab 2 Content</div> },
        ]}
        onCancel={onCancelMock}
      />,
    );

    await clickTab('Tab 2');
    expectTabContentVisible('Tab 2 Content');
  });

  it('passes props to child component and handles interaction', async () => {
    const onChildClickMock = jest.fn();
    const onCancelMock = jest.fn();

    render(
      <Modal isOpen={true} onCancel={onCancelMock}>
        <MockChildComponent onChildClick={onChildClickMock} />
      </Modal>,
    );

    const childComponentButton = screen.getByText('Child Component Button');
    expect(childComponentButton).toBeInTheDocument();

    fireEvent.click(childComponentButton);

    expect(onChildClickMock).toHaveBeenCalledTimes(1);
  });
});

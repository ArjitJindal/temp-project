import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen } from 'testing-library-wrapper';
import Modal from '..';

const MockChildComponent = ({ onChildClick }) => {
  return <button onClick={onChildClick}>Child Component Button</button>;
};

describe('Modal Component', () => {
  it('renders modal with title and content', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} title="Test Modal" onCancel={onCancelMock} />);
    const title = screen.getByText('Test Modal');
    expect(title).toBeInTheDocument();
  });
  it('calls onCancel callback when close button is clicked', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} onCancel={onCancelMock} />);
    const closeButton = screen.getByTestId('modal-close');
    fireEvent.click(closeButton);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
  it('calls onOk callback when OK button is clicked', () => {
    const onOkMock = jest.fn();
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} onOk={onOkMock} onCancel={onCancelMock} />);
    const okButton = screen.getByTestId('modal-ok');
    fireEvent.click(okButton);
    expect(onOkMock).toHaveBeenCalledTimes(1);
  });
  it('does not render OK button when hideOk is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideOk={true} onCancel={onCancelMock} />);
    const okButton = screen.queryByTestId('modal-ok');
    expect(okButton).not.toBeInTheDocument();
  });

  it('does not render header when hideHeader is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideHeader={true} onCancel={onCancelMock} />);
    const header = screen.queryByTestId('modal-header');
    expect(header).not.toBeInTheDocument();
  });
  it('does not render footer when hideFooter is true', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} hideFooter={true} onCancel={onCancelMock} />);
    const footer = screen.queryByTestId('modal-footer');
    expect(footer).not.toBeInTheDocument();
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
    const tab1 = screen.getByText('Tab 1');
    const tab2 = screen.getByText('Tab 2');
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();
  });
  it('renders modal with custom icon', () => {
    const onCancelMock = jest.fn();
    render(<Modal isOpen={true} icon={<div>Icon</div>} onCancel={onCancelMock} />);
    const icon = screen.getByText('Icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders content of the active tab', () => {
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

    const tab2 = screen.getByText('Tab 2');
    fireEvent.click(tab2);

    const tab2Content = screen.getByText('Tab 2 Content');
    expect(tab2Content).toBeInTheDocument();
  });

  it('passes props to child component and handles interaction', () => {
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

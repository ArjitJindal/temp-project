import React from 'react';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import FontSizeIcon from '@/components/ui/icons/Remix/editor/font-size.react.svg';

function Component(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1>{props.title}</h1>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {props.children}
      </div>
    </div>
  );
}

function Case(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{props.title}</h2>
      {props.children}
    </div>
  );
}

export default function () {
  // todo: i18n
  return (
    <div>
      <Component title={'@/components/ui/Card'}>
        <Case title="Single section">
          <Card.Root>
            <Card.Section>Section</Card.Section>
          </Card.Root>
        </Case>
        <Case title="Multiple sections">
          <Card.Root>
            <Card.Section>Section 1</Card.Section>
            <Card.Section>Section 2</Card.Section>
            <Card.Section>Section 3</Card.Section>
            <Card.Section>Section 4</Card.Section>
          </Card.Root>
        </Case>
        <Case title="With title">
          <Card.Root>
            <Card.Section>
              <Card.Title>Card title</Card.Title>
            </Card.Section>
            <Card.Section>Section 2</Card.Section>
            <Card.Section>Section 3</Card.Section>
            <Card.Section>Section 4</Card.Section>
          </Card.Root>
        </Case>
        <Case title="Complex layout">
          <Card.Root>
            <Card.Section>Section 1</Card.Section>
            <Card.Row>
              <Card.Section>Section 2.1</Card.Section>
              <Card.Column>
                <Card.Section>Section 2.2.1</Card.Section>
                <Card.Section>Section 2.2.2</Card.Section>
              </Card.Column>
            </Card.Row>
            <Card.Section>Section 4</Card.Section>
          </Card.Root>
        </Case>
      </Component>
      <Component title={'@/components/ui/Form'}>
        <Case title="Label with icon">
          <Card.Root>
            <Card.Section direction="horizontal">
              <Form.Layout.Label icon={<FontSizeIcon />} title="Font size">
                Some label content
              </Form.Layout.Label>
              <Form.Layout.Label icon={<FontSizeIcon />} title="Bold title" variant="bold">
                Another content
              </Form.Layout.Label>
            </Card.Section>
          </Card.Root>
        </Case>
      </Component>
    </div>
  );
}

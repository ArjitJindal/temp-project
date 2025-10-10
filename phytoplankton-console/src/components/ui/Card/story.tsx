import React from 'react';
import * as Card from './';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Single section">
        <Card.Root>
          <Card.Section>Section</Card.Section>
        </Card.Root>
      </UseCase>
      <UseCase title="Multiple sections">
        <Card.Root>
          <Card.Section>Section 1</Card.Section>
          <Card.Section>Section 2</Card.Section>
          <Card.Section>Section 3</Card.Section>
          <Card.Section>Section 4</Card.Section>
        </Card.Root>
      </UseCase>
      <UseCase title="With title">
        <Card.Root
          header={{
            title: 'Card title',
          }}
        >
          <Card.Section>Section 2</Card.Section>
          <Card.Section>Section 3</Card.Section>
          <Card.Section>Section 4</Card.Section>
        </Card.Root>
      </UseCase>
      <UseCase title="Complex layout">
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
      </UseCase>
    </>
  );
}

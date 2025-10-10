import { useState } from 'react';
import { DrawerStepperJsonSchemaForm, DrawerStepperJsonSchemaFormStep } from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';

const STEPS: DrawerStepperJsonSchemaFormStep[] = [
  {
    step: {
      key: '1',
      title: 'Step one',
      description: 'Step one description',
    },
    jsonSchema: {
      title: 'Name',
      type: 'object',
      properties: {
        firstName: {
          type: 'string',
          description: "The person's first name.",
        },
        lastName: {
          type: 'string',
          description: "The person's last name.",
        },
        age: {
          description: 'Age in years which must be equal to or greater than zero.',
          type: 'integer',
          minimum: 0,
        },
      },
    },
  },
  {
    step: {
      key: '2',
      title: 'Step two',
      description: 'Step two description',
    },
    jsonSchema: {
      title: 'Age',
      type: 'object',
      properties: {
        age: {
          description: 'Age in years which must be equal to or greater than zero.',
          type: 'integer',
          minimum: 0,
        },
      },
    },
  },
];

function SingleStep() {
  const [isVisible, setVisible] = useState(false);
  return (
    <UseCase title="Single step" description="Click button to show the drawer">
      <DrawerStepperJsonSchemaForm
        isVisible={isVisible}
        onChangeVisibility={setVisible}
        title={'Awesome json schema form'}
        description={'JSON schema is amazing'}
        mode={'CREATE'}
        steps={[STEPS[0]]}
        onSubmit={() => null}
        drawerMaxWidth="800px"
      />
      <Button
        onClick={() => {
          setVisible(true);
        }}
      >
        Open drawer
      </Button>
    </UseCase>
  );
}
function MultiStep() {
  const [isVisible, setVisible] = useState(false);
  return (
    <UseCase title="Basic" description="Click button to show the drawer">
      <DrawerStepperJsonSchemaForm
        isVisible={isVisible}
        onChangeVisibility={setVisible}
        title={'Awesome json schema form'}
        description={'JSON schema is amazing'}
        mode={'CREATE'}
        steps={STEPS}
        onSubmit={() => null}
        drawerMaxWidth="800px"
      />
      <Button
        onClick={() => {
          setVisible(true);
        }}
      >
        Open drawer
      </Button>
    </UseCase>
  );
}

export default function (): JSX.Element {
  return (
    <>
      <SingleStep />
      <MultiStep />
    </>
  );
}

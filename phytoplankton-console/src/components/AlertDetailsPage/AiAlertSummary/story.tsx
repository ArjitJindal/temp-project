import { AiAlertSummary } from '.';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <UseCase title="AI alert summary" initialState={{}}>
      {() => (
        <AiAlertSummary
          alertId="A-1"
          summary="Lorem ipsum is placeholder text commonly used in the graphic, print, and publishing industries for previewing layouts and visual mockups."
          onReload={() => {}}
        />
      )}
    </UseCase>
  );
}

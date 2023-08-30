import { useState } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { UseCase } from '@/pages/storybook/components';
import Narrative, { NarrativeFormValues } from '@/components/Narrative';
import { providerConfig } from '@/components/AppWrapper/Providers/AuthProvider';

export default function (): JSX.Element {
  const [values, setValues] = useState<NarrativeFormValues>({
    isValid: false,
    values: {
      reasons: [],
      reasonOther: '',
      files: [],
      comment: '',
    },
  });
  const [submitted, setSubmitted] = useState<NarrativeFormValues | undefined>();
  const [showErrors, setShowErrors] = useState(false);
  const onSubmit = () => {
    setSubmitted(values);
    setShowErrors(true);
  };
  return (
    <Auth0Provider {...providerConfig}>
      <UseCase title={'CRUD table'}>
        <Narrative
          values={values}
          onChange={setValues}
          placeholder={'A placeholder to prompt the user'}
          possibleReasons={['Suspicious activity reported (SAR)', 'Terrorist financing']}
          onSubmit={onSubmit}
          showErrors={showErrors}
          entityType={'CASE'}
        />
        {submitted && <>Submitted: {JSON.stringify(submitted)}</>}
      </UseCase>
    </Auth0Provider>
  );
}

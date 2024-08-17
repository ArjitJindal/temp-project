import { useRef, useState } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { sanitizeComment } from '../markdown/MarkdownEditor/mention-utlis';
import { UseCase } from '@/pages/storybook/components';
import Narrative, { NarrativeFormValues, NarrativeRef } from '@/components/Narrative';
import { providerConfig } from '@/components/AppWrapper/Providers/AuthProvider';

export default function (): JSX.Element {
  const [values, setValues] = useState<NarrativeFormValues<any>>({
    isValid: false,
    values: {
      reasons: [],
      reasonOther: '',
      files: [],
      comment: '',
    },
  });
  const [submitted, setSubmitted] = useState<NarrativeFormValues<any> | undefined>();
  const [showErrors, setShowErrors] = useState(false);
  const narrativeRef = useRef<NarrativeRef>(null);
  const onSubmit = () => {
    const sanitizedComment = values.values.comment ? sanitizeComment(values.values.comment) : '';
    setSubmitted({ ...values, values: { ...values.values, comment: sanitizedComment } });
    narrativeRef?.current?.reset();
    setShowErrors(true);
  };
  return (
    <Auth0Provider {...providerConfig}>
      <UseCase title={'CRUD table'}>
        <Narrative
          ref={narrativeRef}
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

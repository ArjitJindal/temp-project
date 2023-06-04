import _ from 'lodash';
import CRMCommunicationCard from '../CRMCommunicationCard';
import { SalesforceAccountResponseNotes } from '@/apis';

interface Props {
  notes: Array<SalesforceAccountResponseNotes>;
}

const Notes = (props: Props) => {
  const { notes } = props;
  return (
    <>
      {_.sortBy(notes, 'createdAt')
        .reverse()
        .map((note, i) => (
          <CRMCommunicationCard
            key={`notes-${i}`}
            body={note?.body}
            name={note?.user}
            createdAt={note?.createdAt}
            link={note?.link}
            title={note?.title}
            tab="notes"
          />
        ))}
    </>
  );
};

export default Notes;

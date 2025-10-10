import { sortBy } from 'lodash';
import CRMCommunicationCard from '../CRMCommunicationCard';
import { CrmAccountResponseNotes } from '@/apis';

interface Props {
  notes: Array<CrmAccountResponseNotes>;
}

const Notes = (props: Props) => {
  const { notes } = props;
  return (
    <>
      {sortBy(notes, 'createdAt')
        .reverse()
        .map((note, i) => (
          <CRMCommunicationCard
            key={`notes-${i}`}
            body={note.body}
            name={note.user}
            createdAt={note.createdAt}
            tab="notes"
          />
        ))}
    </>
  );
};

export default Notes;

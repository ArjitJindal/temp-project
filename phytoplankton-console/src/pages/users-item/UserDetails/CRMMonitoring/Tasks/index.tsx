import { sortBy } from 'lodash';
import CRMCommunicationCard from '../CRMCommunicationCard';
import { CrmAccountResponseTasks } from '@/apis';

interface Props {
  tasks: Array<CrmAccountResponseTasks>;
}

const Tasks = (props: Props) => {
  const { tasks } = props;

  return (
    <>
      {sortBy(tasks, 'createdAt')
        .reverse()
        .map((comment, i) => (
          <CRMCommunicationCard
            key={`comments-${i}`}
            body={comment.content}
            name={comment.user}
            createdAt={comment.createdAt}
            tab="tasks"
          />
        ))}
    </>
  );
};

export default Tasks;

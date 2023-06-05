import _ from 'lodash';
import CRMCommunicationCard from '../CRMCommunicationCard';
import { SalesforceAccountResponseComments } from '@/apis';

interface Props {
  comments: Array<SalesforceAccountResponseComments>;
}

const Comments = (props: Props) => {
  const { comments } = props;

  return (
    <>
      {_.sortBy(comments, 'createdAt')
        .reverse()
        .map((comment, i) => (
          <CRMCommunicationCard
            key={`comments-${i}`}
            body={comment?.body}
            name={comment?.user}
            createdAt={comment?.createdAt}
            link={comment?.link}
            tab="comments"
          />
        ))}
    </>
  );
};

export default Comments;

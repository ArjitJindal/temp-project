import { Collapse } from 'antd';
import { sortBy } from 'lodash';
import CRMCommunicationCard from '../CRMCommunicationCard';
import s from './index.module.less';
import { CrmAccountResponseEngagements } from '@/apis';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';

interface Props {
  engagements: Array<CrmAccountResponseEngagements>;
}

const { Panel } = Collapse;
const Emails = (props: Props) => {
  const { engagements: emails } = props;
  return (
    <Collapse defaultActiveKey={['1']} ghost>
      {sortBy(emails, 'createdAt')
        .reverse()
        .map((thisEmail, i) => (
          <Panel
            header={
              <div className={s.panel}>
                <div className={s.panelHeader}>
                  <span className={s.panelHeading}>
                    {thisEmail.subject ? thisEmail.subject : 'No subject'}
                  </span>
                  {thisEmail.createdAt && (
                    <span className={s.greyText}>
                      {dayjs(thisEmail.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}
                    </span>
                  )}
                </div>
              </div>
            }
            key={i}
          >
            <div className={s.emails}>
              <CRMCommunicationCard
                name={thisEmail.user}
                to={thisEmail.to}
                body={thisEmail.content}
                createdAt={thisEmail.createdAt}
                tab="emails"
              />
            </div>
          </Panel>
        ))}
      <Button icon={<EditLineIcon />}>Compose</Button>
    </Collapse>
  );
};

export default Emails;

import { Collapse } from 'antd';
import _ from 'lodash';
import CompanyHeader from '../CompanyHeader';
import CRMCommunicationCard from '../CRMCommunicationCard';
import { getFormatedDate } from '../CRMCommunicationCard/GetFormatedDate';
import s from './index.module.less';
import { SalesforceAccountResponseEmails } from '@/apis';

interface Props {
  emails: Array<SalesforceAccountResponseEmails>;
}

const { Panel } = Collapse;
const Emails = (props: Props) => {
  const { emails } = props;
  return (
    <Collapse defaultActiveKey={['1']} ghost>
      {_.sortBy(emails, 'createdAt')
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
                    <span className={s.greyText}>{getFormatedDate(thisEmail.createdAt)}</span>
                  )}
                </div>
                {thisEmail.link && <CompanyHeader link={thisEmail.link} />}
              </div>
            }
            key={i}
          >
            <div className={s.emails}>
              <CRMCommunicationCard
                name={thisEmail?._from}
                to={thisEmail?.to}
                body={thisEmail?.body}
                tab="emails"
              />
            </div>
          </Panel>
        ))}
    </Collapse>
  );
};

export default Emails;

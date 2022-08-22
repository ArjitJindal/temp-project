import React, { useState } from 'react';
import { Card } from 'antd';
import ProCard from '@ant-design/pro-card';
import RcResizeObserver from 'rc-resize-observer';
import { PageContainer } from '@ant-design/pro-layout';
import styles from './style.module.less';

const { Divider } = ProCard;
const RiskAlgorithmTable: React.FC = () => {
  const [responsive, setResponsive] = useState(false);
  return (
    <>
      <Card bordered={false}>
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>Dynamic Risk Score (DRS)</span>
              <div className={styles.KRSsubheader}>
                Dynamic aggregate score of your customer based on their KRS and ARS.
              </div>
            </>
          }
          collapsible
          extra="DRS"
          hoverable
        >
          <ProCard bordered bodyStyle={{ border: 10 }}>
            <pre className={styles.pre}>
              <div className={styles.header}>Formula</div>
              <div> </div>
              <div className={styles.KRSformula}>
                DRS[i] = avg (KRS + DRS[i-1] + ARS[i] )[i] = avg (KRS + DRS[i-1] + ARS[i] )
              </div>
              <div className={styles.KRSformula}>DRS[0] = KRS</div>
              <div className={styles.KRSformula}>DRS[1] = avg ( KRS + ARS[1] )</div>
              <div className={styles.KRSformula}>DRS[2] = avg ( KRS + DRS[1] + ARS[2] )</div>
            </pre>
          </ProCard>
        </ProCard>
        <Divider style={{ margin: '18px 0' }} />
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>KYC Risk Score</span>
              <div className={styles.KRSsubheader}>
                Risk score of your customer’s profile. KRS changes slowly over time.
              </div>
            </>
          }
          collapsible
          extra="KRS"
          hoverable
        >
          <ProCard
            tabs={{
              type: 'card',
            }}
            bordered
            bodyStyle={{ border: 10 }}
          >
            <ProCard.TabPane key=" tab1 " tab="Consumers">
              <RcResizeObserver
                key="resize-observer"
                onResize={(offset) => {
                  setResponsive(offset.width < 1100);
                }}
              >
                <ProCard
                  style={{ display: 'flex', position: 'relative' }}
                  direction={responsive ? 'column' : 'row'}
                >
                  <ProCard style={{ display: 'flex' }}>
                    <pre className={styles.pre}>
                      <div className={styles.header}>Formula</div>
                      <div> </div>
                      <div className={styles.KRSformula}>KRS = avg [ cRes + nat + age ]</div>
                      <div> </div>
                      <div>where:</div>
                      <div>cRes: Country of residence risk</div>
                      <div>nat: Country of nationality risk</div>
                      <div>age: age group risk</div>
                    </pre>
                  </ProCard>
                  <Divider type={responsive ? 'horizontal' : 'vertical'} />
                  <ProCard style={{ display: 'flex' }}>
                    <pre className={styles.pre}>
                      <div className={styles.header}>Example</div>
                      <div> </div>
                      <div>
                        For an Indian national between the ages of 30 - 40 <br></br>
                        residing in Dubai, KRS will be:
                      </div>
                      <div> </div>
                      <div className={styles.KRSformula}>Variables</div>
                      <div> </div>
                      <div>cRes = 44 (Risk score of Indian national)</div>
                      <div>cNat = 54 (Risk score for Dubai resident)</div>
                      <div>age = 76 (Risk score for Age group)</div>
                      <div>KRS = avg( 44 + 54 + 76 ) = 58</div>
                    </pre>
                  </ProCard>
                  <Divider type={responsive ? 'horizontal' : 'vertical'} />
                  <ProCard style={{ display: 'flex' }}>
                    <pre className={styles.pre}>
                      <div className={styles.header}>Result</div>
                      <div> </div>
                      <div>
                        Result User has a KRS score of 58<br></br>and is of Medium Risk.
                      </div>
                    </pre>
                  </ProCard>
                </ProCard>
              </RcResizeObserver>
            </ProCard.TabPane>

            <ProCard.TabPane key=" tab2 " tab="Business Users">
              <pre className={styles.pre}>
                <div className={styles.header}>Formula</div>
                <div> </div>
                <div className={styles.KRSformula}>
                  KRS = avg [ avg &#123; cReg + avg [directorNAT] + avg [uboNAT] &#125; + rAGE +
                  bizDomain ]
                </div>
                <div> </div>
                <div className="token-line ">where:</div>
                <div className="token-line ">cReg: Business country of registration risk</div>
                <div className="token-line ">
                  directorNat: average risk score of director nationalities
                </div>
                <div className="token-line ">uboNat: average risk score of UBO nationalities</div>
                <div className="token-line ">rAge: Business age risk</div>
                <div className="token-line ">
                  bizDomain: Risk of the business operating industry
                </div>
              </pre>
            </ProCard.TabPane>
          </ProCard>
        </ProCard>
        <Divider style={{ margin: '18px 0' }} />
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>Action Risk Score (ARS)</span>
              <div className={styles.KRSsubheader}>
                Risk score of your customer’s transaction activity. ARS changes corresponding to
                user activity.
              </div>
            </>
          }
          collapsible
          extra="ARS"
          hoverable
        >
          <ProCard bordered bodyStyle={{ border: 10 }}>
            <pre className={styles.pre}>
              <div className={styles.header}>Formula</div>
              <div> </div>
              <div className={styles.KRSformula}>
                ARSi = avg [ rORG[i] + rDES[i] + rMET[i] + rMER[i] + rPOMET[i] + amount]
              </div>
              <div> </div>
              <div className="token-line ">where:</div>
              <div className="token-line ">rORG: payment origin country risk</div>
              <div className="token-line ">rDES: payment destination country risk</div>
              <div className="token-line ">rMER: Receiver merchant risk</div>
              <div className="token-line ">rMET: payment method risk</div>
              <div className="token-line ">
                rPOMET: Receiving payment method risk (payout method)
              </div>
              <div className="token-line ">Amount: Transaction amount risk</div>
            </pre>
          </ProCard>
        </ProCard>
      </Card>
    </>
  );
};

export default RiskAlgorithmTable;

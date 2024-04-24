import React, { useState } from 'react';
import { Card } from 'antd';
import ProCard from '@ant-design/pro-card';
import RcResizeObserver from 'rc-resize-observer';
import { Link } from 'react-router-dom';
import { InlineMath } from 'react-katex';
import styles from './style.module.less';
import { getBranding } from '@/utils/branding';
import { H4, P } from '@/components/ui/Typography';

const branding = getBranding();

const { Divider } = ProCard;
const RiskAlgorithmTable: React.FC = () => {
  const [responsive, setResponsive] = useState(false);

  return (
    <>
      <Card bordered={false}>
        <div className={styles.container}>
          <h2>System behavior</h2>
          <ul>
            <li>
              <H4 bold>How is the score calculated when there is no data?</H4>
              <P variant="m">
                When there is no data available for a risk factor, {branding.companyName} system
                defaults to very high risk. For example, for a user for whom there's no data on
                country of nationality, {branding.companyName} systems assume the risk level of very
                high risk for that parameter.
              </P>
            </li>
            <li>
              <H4 bold>How the risk level is converted to risk score?</H4>
              <P variant="m">
                Risk levels are quantified into risk scores by taking the average of the lower and
                upper bound score of risk levels configured in{' '}
                <Link to={`/risk-levels/configure`}>risk levels section </Link>. For example, if the
                risk score range for medium risk level is 60 - 80, medium risk level will have a
                corresponding score of 70 ((60 + 80) / 2).
              </P>
            </li>
            <li>
              <H4 bold>How the risk score is converted to risk level?</H4>
              <P variant="m">
                A risk score is converted to risk level using the{' '}
                <Link to={`/risk-levels/configure`}>risk levels </Link> configured. For example, if
                the risk score range for medium risk level is 60 - 80, a risk score of 65 would be
                considered as medium risk level.
              </P>
            </li>
            <li>
              <H4 bold>How do weights impact the risk score?</H4>
              <P variant="m">
                Weights range from 0 (no impact) to 1 (maximum impact) and determine the factor's
                influence on the overall risk score. It determines the impact of each risk factor on
                the overall risk score. Higher weights increase a factor's influence, raising the
                score for more significant risks, while lower weights reduce it for less critical
                risks.
              </P>
            </li>
          </ul>
          <h2>Score calculation</h2>
        </div>
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>Customer Risk Assessment (CRA)</span>
              <div className={styles.KRSsubheader}>
                Dynamic aggregate score of your customer based on their KRS and TRS.
              </div>
            </>
          }
          collapsible
          extra="CRA"
          hoverable
        >
          <ProCard bordered bodyStyle={{ border: 10 }}>
            <pre className={styles.pre}>
              <div className={styles.header}>Formula</div>
              <div> </div>
              <div className={styles.KRSformula}>CRA[i] = avg (CRA[i-1] + TRS[i] )</div>
              <div className={styles.KRSformula}>CRA[0] = KRS</div>
              <div className={styles.KRSformula}>CRA[1] = avg ( KRS + TRS[1] )</div>
              <div className={styles.KRSformula}>CRA[2] = avg ( CRA[1] + TRS[2] )</div>
            </pre>
          </ProCard>
        </ProCard>
        <Divider style={{ margin: '18px 0' }} />
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>KYC Risk Score (KRS)</span>
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
            <ProCard.TabPane key=" tab1 " tab="Consumer users">
              <RcResizeObserver
                key="resize-observer"
                onResize={(offset) => {
                  setResponsive(offset.width < 1100);
                }}
              >
                <ProCard direction={responsive ? 'column' : 'row'}>
                  <div className={styles.card}>
                    <ProCard style={{ display: 'flex' }}>
                      <pre className={styles.pre}>
                        <div className={styles.header}>Formula</div>
                        <div> </div>
                        <InlineMath math="\bold{KRS} = \dfrac{(cRes\times w_{cRes})+ (nat\times w_{nat}) + (age\times w_{age})}{w_{cRes} + w_{nat} + w_{age}}" />
                        <div> </div>
                        <div>where:</div>
                        <div>
                          <InlineMath math="cRes" /> : Country of residence risk
                        </div>
                        <div>
                          <InlineMath math="cNat" /> : Country of nationality risk
                        </div>
                        <div>
                          <InlineMath math="age" /> : Age group risk
                        </div>
                        <div>
                          <InlineMath math="w_{cRes}" /> : Country of residence weight
                        </div>
                        <div>
                          <InlineMath math="w_{nat}" /> : Country of nationality weight
                        </div>
                        <div>
                          <InlineMath math="w_{age}" /> : Age group weight
                        </div>
                      </pre>
                    </ProCard>
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
                        <div>
                          <InlineMath math="cRes" /> : Risk score of Indian national = 44
                        </div>
                        <div>
                          <InlineMath math="cNat" /> : Risk score of Dubai resident = 54
                        </div>
                        <div>
                          <InlineMath math="age" /> : Risk score of 30 - 40 age group = 76
                        </div>
                        <div>
                          <InlineMath math="w_{cRes}" /> : Weight of country of residence = 0.5
                        </div>
                        <div>
                          <InlineMath math="w_{nat}" /> : Weight of country of nationality = 0.3
                        </div>
                        <div>
                          <InlineMath math="w_{age}" /> : Weight of age group = 0.2
                        </div>
                        <div> </div>
                        <div>
                          <InlineMath math="\bold{KRS} = \dfrac{(44\times 0.5)+ (54\times 0.3) + (76\times 0.2)}{0.5 + 0.3 + 0.2} = 53.4" />
                        </div>
                      </pre>
                    </ProCard>
                    <ProCard style={{ display: 'flex' }}>
                      <pre className={styles.pre}>
                        <div className={styles.header}>Result</div>
                        <div> </div>
                        <div>
                          User has a{' '}
                          <strong>
                            KRS score of 53.4
                            <br />
                          </strong>{' '}
                          and is medium risk.
                        </div>
                      </pre>
                    </ProCard>
                  </div>
                </ProCard>
              </RcResizeObserver>
            </ProCard.TabPane>

            <ProCard.TabPane key=" tab2 " tab="Business users">
              <pre className={styles.pre}>
                <div className={styles.header}>Formula</div>
                <div> </div>
                <div className={styles.KRSformula}>
                  <InlineMath math="\bold{KRS}=  \dfrac{(cReg\times w_{cReg})+ (directorNAT\times w_{directorNAT}) + (uboNAT\times w_{ub0NAT}) + (rAGE\times w_{rAGE}) + (bizDomain\times w_{bizDomain})}{w_{cReg} + w_{dirctorNAT} + w_{directorNAT} + w_{ub0NAT} + w_{bizDomain}}" />
                </div>
                <div> </div>
                <div className="token-line ">where:</div>
                <div className="token-line ">
                  <InlineMath math="cReg" /> : Country of registration risk score
                </div>
                <div className="token-line ">
                  <InlineMath math="directorNAT" /> : Director nationality risk score
                </div>
                <div className="token-line ">
                  <InlineMath math="uboNAT" /> : Ultimate Beneficial Owner (UBO) nationality risk
                  score
                </div>
                <div className="token-line ">
                  <InlineMath math="rAGE" /> : Risk score associated with the age of the business
                </div>
                <div className="token-line ">
                  <InlineMath math="bizDomain" /> : Business domain risk score
                </div>
                <div className="token-line ">
                  <InlineMath math="w_{cReg}" /> : Country of registration weight
                </div>
                <div className="token-line ">
                  <InlineMath math="w_{directorNAT}" /> : Director nationality weight
                </div>
                <div className="token-line ">
                  <InlineMath math="w_{uboNAT}" /> : Ultimate Beneificial Owner (UBO) nationality
                  weight
                </div>
                <div className="token-line ">
                  <InlineMath math="w_{rAGE}" /> : Business age weight
                </div>

                <div className="token-line ">
                  <InlineMath math="w_{bizDomain}" /> : Business domain weight
                </div>
              </pre>
            </ProCard.TabPane>
          </ProCard>
        </ProCard>
        <Divider style={{ margin: '18px 0' }} />
        <ProCard
          title={
            <>
              <span className={styles.KRSheader}>Transaction Risk Score (TRS)</span>
              <div className={styles.KRSsubheader}>
                Risk score of your customer’s transaction activity. TRS changes corresponding to
                user activity.
              </div>
            </>
          }
          collapsible
          extra="TRS"
          hoverable
        >
          <ProCard bordered bodyStyle={{ border: 10 }}>
            <pre className={styles.pre}>
              <div className={styles.header}>Formula</div>
              <div> </div>
              <div className={styles.KRSformula}>
                <InlineMath math="\bold{TRS_{i}}=  \dfrac{(rORG[i]\times w_{rORG})+ (rDES[i]\times w_{rDES}) + (rMET[i]\times w_{rMET}) + (rMER[i]\times w_{rMER}) + (rPOMET[i]\times w_{rPOMET}) + (amount[i]\times w_{amount})}{w_{rORG} + w_{rDES} + w_{rMET} + w_{rMER} + w_{rPOMET} + w_{amount}}" />
              </div>
              <div> </div>
              <div className="token-line ">where:</div>
              <div className="token-line ">
                <InlineMath math="rORG" />: Payment origin country risk
              </div>
              <div className="token-line ">
                <InlineMath math="rDES" />: Payment destination country risk
              </div>
              <div className="token-line ">
                <InlineMath math="rMER" />: Receiver merchant risk
              </div>
              <div className="token-line ">
                <InlineMath math="rMET" />: Payment method risk
              </div>
              <div className="token-line ">
                <InlineMath math="rPOMET" />: Receiving payment method risk (payout method)
              </div>
              <div className="token-line ">
                <InlineMath math="Amount" />: Transaction amount risk
              </div>
              <div className="token-line ">
                <InlineMath math="w_{rORG}" />: Payment origin country weight
              </div>
              <div className="token-line ">
                <InlineMath math="w_{rDES}" />: Payment destination country weight
              </div>
              <div className="token-line ">
                <InlineMath math="w_{rMER}" />: Receiver merchant weight
              </div>
              <div className="token-line ">
                <InlineMath math="w_{rMET}" />: Payment method weight
              </div>
              <div className="token-line ">
                <InlineMath math="w_{rPOMET}" />: Receiving payment method weight (payout method)
              </div>
              <div className="token-line ">
                <InlineMath math="w_{Amount}" />: Transaction amount weight
              </div>
            </pre>
          </ProCard>
        </ProCard>
      </Card>
    </>
  );
};

export default RiskAlgorithmTable;

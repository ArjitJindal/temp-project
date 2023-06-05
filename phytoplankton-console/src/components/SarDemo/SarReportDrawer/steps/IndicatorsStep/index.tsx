import { useMemo, useState } from 'react';
import { Space } from 'antd';
import s from './style.module.less';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TextInput from '@/components/library/TextInput';

// Source: https://mlcu.org.eg/upload/uploadeditor/files/go_aml/Schema%20Documentation.pdf
const INDICATORS = [
  { code: 'AIF', indicator: 'AIF/Non-suspicious Transactions' },
  { code: 'CCH', indicator: 'CC/High' },
  { code: 'CCL', indicator: 'CC/Low' },
  { code: 'CCM', indicator: 'CC/Medium' },
  { code: 'CCN', indicator: 'CC/Not Classified Yet' },
  { code: 'CIUS', indicator: 'CIU/Never Updated (Relationship has not started yet)' },
  {
    code: 'CIUN',
    indicator:
      'CIU/Never updated during the last 5 years (Relationship started before a five years period)',
  },
  {
    code: 'CIUR',
    indicator:
      'CIU/Never updated during the last 5 years (Relationship started within a five years period)',
  },
  { code: 'CIUM', indicator: 'CIU/Updated during the last 12 months' },
  { code: 'CIUT', indicator: 'CIU/Updated during the last 3 years' },
  { code: 'CIUF', indicator: 'CIU/Updated during the last 5 years' },
  { code: 'CTC', indicator: 'CT/Company' },
  { code: 'CTE', indicator: 'CT/Employee' },
  { code: 'CTFI', indicator: 'CT/Financial Institution' },
  { code: 'CTGO', indicator: 'CT/Government Entity' },
  { code: 'CTIP', indicator: 'CT/International PEP' },
  { code: 'CTHC', indicator: 'CT/Is connected to a high risk country' },
  { code: 'CTHLA', indicator: 'CT/Is connected to a high-risk local area' },
  { code: 'CTLP', indicator: 'CT/Local PEP' },
  { code: 'CTM', indicator: 'CT/Minor' },
  { code: 'CTNR', indicator: 'CT/Nonresident' },
  { code: 'CTNE', indicator: 'CT/Not Employed' },
  { code: 'CTNP', indicator: 'CT/NPO' },
  { code: 'CTSE', indicator: 'CT/Self Employed' },
  { code: 'CTST', indicator: 'CT/Student' },
  { code: 'CTTL', indicator: 'CT/Trust or Other Form of Legal Arrangements' },
  { code: 'DMAR', indicator: 'DM/Automated reports' },
  { code: 'DMLA', indicator: 'DM/Legal Action Initiated in relation to suspect' },
  { code: 'DMCM', indicator: 'DM/Manual monitoring via compliance officer' },
  { code: 'DMER', indicator: 'DM/Manual reporting via other employee' },
  { code: 'DMNM', indicator: 'DM/News on media' },
  { code: 'PCC', indicator: 'PC/Counterfeiting and piracy of products' },
  { code: 'PCAN', indicator: 'PC/Crimes committed against antiquities.' },
  { code: 'PCBR', indicator: 'PC/Crimes of bribery' },
  { code: 'PCP', indicator: 'PC/Crimes of debauchery and prostitution.' },
  { code: 'PCD', indicator: 'PC/Crimes of deception and breach of faith' },
  { code: 'PCF', indicator: 'PC/Crimes of falsification' },
  { code: 'PCFR', indicator: 'PC/Crimes of forgery of banknotes and coins' },
  { code: 'PCFD', indicator: 'PC/Crimes of fraud and deceit.' },
  { code: 'PCFT', indicator: 'PC/Crimes of Funds theft and usurpation' },
  {
    code: 'PCHI',
    indicator: 'PC/Crimes of hijacking means of transport and detaining individuals.',
  },
  {
    code: 'PCNS',
    indicator:
      'PC/Crimes of narcotics and psychotropic substances (planting, manufacturing, smuggling, exporting and trafficking)',
  },
  {
    code: 'PCE',
    indicator: 'PC/Crimes of public Funds embezzlement, transgression and peculation',
  },
  { code: 'PCT', indicator: 'PC/Crimes of terrorism' },
  { code: 'PCTF', indicator: 'PC/Crimes of terrorism financing.' },
  {
    code: 'PCW',
    indicator:
      'PC/Crimes of weaponry, ammunition and explosives (unlicensed importation, trading and manufacturing)',
  },
  { code: 'PCRC', indicator: 'PC/Customs related crimes' },
  { code: 'PCCC', indicator: 'PC/Cyber Crimes' },
  { code: 'PCEN', indicator: 'PC/Environmental crimes related to dangerous wastes and materials.' },
  { code: 'PCIG', indicator: 'PC/Illicit gains' },
  { code: 'PCIN', indicator: 'PC/Insider trading' },
  { code: 'PCMM', indicator: 'PC/Market Manipulation' },
  { code: 'PCDC', indicator: 'PC/Not declaring or False declaration of Funds and bearer assets' },
  {
    code: 'PCSA',
    indicator: 'PC/Offences & misdemeanors to the security of the government (abroad)',
  },
  {
    code: 'PCSD',
    indicator: 'PC/Offences & misdemeanors to the security of the government (domestic)',
  },
  { code: 'PCTX', indicator: 'PC/Tax Crimes' },
  { code: 'PCTS', indicator: 'PC/Trafficking of human beings and migrant smuggling' },
  { code: 'PCTC', indicator: 'PC/Transnational organized crimes' },
  { code: 'PCU', indicator: 'PC/Unidentified' },
  {
    code: 'SPCCW',
    indicator: 'SPC/Cash deposits are directly followed by withdrawals without an apparent reason',
  },
  {
    code: 'SPCCO',
    indicator:
      'SPC/Customer uses cash frequently or in large amounts while his/her field of business usually uses other payment methods (e.g. checks, ..)',
  },
  {
    code: 'SPCEL',
    indicator: 'SPC/Depositing amounts in credit card account highly exceeding its credit limit',
  },
  { code: 'SPCLD', indicator: 'SPC/Exchange of currency into large denomination notes' },
  {
    code: 'SPCLM',
    indicator:
      "SPC/Exchanging large amounts of currency in a manner inconsistent with customer's business",
  },
  {
    code: 'SPCCT',
    indicator:
      "SPC/Large cash deposits followed by wire transfers not consistent with customer's business",
  },
  { code: 'SPCLC', indicator: 'SPC/Large cash deposits without an apparent reason' },
  {
    code: 'SPCAT',
    indicator:
      'SPC/Large cash deposits/withdrawals using ATMs in a way inconsistent with customer information',
  },
  {
    code: 'SPCSW',
    indicator: 'SPC/Large sudden withdrawal (often in cash) without an apparent reason',
  },
  { code: 'SPCMC', indicator: 'SPC/Multiple cash deposits without an apparent reason' },
  { code: 'SPCMW', indicator: 'SPC/Multiple cash withdrawals without an apparent reason' },
  {
    code: 'SPCRD',
    indicator: 'SPC/Repeated deposits or transfers to an account without an apparent reason',
  },
  {
    code: 'SPCCF',
    indicator:
      'SPC/Requesting credit against collaterals issued by foreign financial institutions without any apparent reason',
  },
  { code: 'SPCCA', indicator: 'SPC/Requesting credit against collaterals owned by others' },
  { code: 'SPCSD', indicator: 'SPC/Use of small denominations' },
  {
    code: 'SPFEX',
    indicator:
      'SPF/Credit card purchases involve stores selling chemicals known to be used in making explosives.',
  },
  { code: 'SPFVT', indicator: "SPF/Customer's behavior exhibiting violent tendencies" },
  {
    code: 'SPFEB',
    indicator: "SPF/Customer's behavior indicating adherence to extremist beliefs or ideas",
  },
  {
    code: 'SPFSC',
    indicator:
      'SPF/Purchase of expensive or sophisticated communication devices and information technology using credit card',
  },
  { code: 'SPFCE', indicator: 'SPF/Purchase of heavy camping equipment using credit card' },
  { code: 'SPFFT', indicator: 'SPF/Suspected to involve foreign terrorist fighters' },
  {
    code: 'SPFKT',
    indicator: 'SPF/The customer is known to be related to terrorist group or organization',
  },
  { code: 'SPFSM', indicator: 'SPF/Unusual financial use of social media (e.g. crowdfunding)' },
  {
    code: 'SPGLP',
    indicator:
      'SPG/Beneficiary of an LG requests paying its value after a short period of its issuance or without an apparent reason',
  },
  {
    code: 'SPGRI',
    indicator: 'SPG/Customer repeatedly issued LGs in a way inconsistent with his/her business',
  },
  {
    code: 'SPGCI',
    indicator: "SPG/Opening LGs using collaterals inconsistent with customer's business",
  },
  { code: 'SPISP', indicator: 'SPI/Single premium life insurance policy' },
  {
    code: 'SPLGI',
    indicator: "SPL/Imported/ exported goods are inconsistent with customer's business",
  },
  { code: 'SPLUT', indicator: 'SPL/LC includes unusual terms without any apparent reason' },
  {
    code: 'SPLCU',
    indicator: "SPL/Opening LCs using collaterals inconsistent with customer's business",
  },
  {
    code: 'SPLAL',
    indicator:
      'SPL/The transaction involves the use of repeatedly amended or extended letters of credit without an apparent reason',
  },
  {
    code: 'SPLLI',
    indicator:
      "SPL/The use of LCs or other trade finance instruments in a way inconsistent with customer's business",
  },
  {
    code: 'SPNDN',
    indicator:
      'SPN/Repeated large deposits or transfers to the accounts of a newly founded or an unknown NPO',
  },
  {
    code: 'SPNNP',
    indicator:
      'SPN/Transactions conducted on the account of an NPO which are inconsistent with the pattern and size of the organization’s purpose or business',
  },
  {
    code: 'SPNHR',
    indicator:
      'SPN/Transfers from/to an NPO connected with a terrorism or terrorism financing high risk country',
  },
  {
    code: 'SPOAA',
    indicator:
      'SPO/Accounts abandoned by the customer after being used to conduct several transactions or transactions in large sums of money.',
  },
  { code: 'SPOAS', indicator: 'SPO/Activity conducted over a short time frame' },
  { code: 'SPTAR', indicator: 'SPO/Alternative money remittance or underground banking' },
  {
    code: 'SPOCC',
    indicator:
      'SPO/Customer contact details changes frequently without an apparent reason, or are incorrect or continuously non-operational.',
  },
  {
    code: 'SPORH',
    indicator: 'SPO/Customer is a resident or connected to a high-risk jurisdiction.',
  },
  { code: 'SPOCS', indicator: 'SPO/Customer presenting obviously counterfeit documents' },
  {
    code: 'SPORU',
    indicator: 'SPO/Customer repeatedly refused to update his/her CDD information and documents',
  },
  {
    code: 'SPOCO',
    indicator: 'SPO/Customer requests not to receive correspondents from the financial institution',
  },
  {
    code: 'SPCTL',
    indicator:
      'SPO/Customer requests the transfer value of a loan/ credit facilities to other financial institutions without any apparent reason.',
  },
  {
    code: 'SPOCH',
    indicator:
      'SPO/Customer submitted cheques for collection inconsistent with his/her business or without apparent relation with the issuer.',
  },
  {
    code: 'SPOIT',
    indicator: 'SPO/Customer’s appearance does not match with his/her inflated transactions.',
  },
  {
    code: 'SPOIN',
    indicator: 'SPO/Customer’s income does not match with his/her inflated transactions',
  },
  {
    code: 'SPTSA',
    indicator:
      'SPO/Customers (natural person) acquire several accounts for the purpose of receiving and/or sending transfers in relatively small values',
  },
  {
    code: 'SPOCZ',
    indicator:
      'SPO/Customers accessing their e-banking facilities or sending orders from an IP address within a conflict zone or address not associated with CDD records.',
  },
  {
    code: 'SPTIA',
    indicator:
      "SPO/Customer's account was used as an intermediary account to transfer money between two parties",
  },
  {
    code: 'SPOAW',
    indicator:
      'SPO/Customers opening an account in regions away from their work address or place of residence without an apparent reason',
  },
  {
    code: 'SPOUI',
    indicator:
      'SPO/Customers shows unusual interest in the reporting requirements, transactions thresholds or record-keeping requirements',
  },
  {
    code: 'SPOAO',
    indicator:
      'SPO/Customers suspected to conduct transactions or act on behalf of another individual',
  },
  {
    code: 'SPOAC',
    indicator:
      'SPO/Customers who deliberately avoid the direct contact with the financial institution',
  },
  { code: 'SPODL', indicator: 'SPO/Daily using the maximum permitted limit of a payment card' },
  {
    code: 'SPOEQ',
    indicator: 'SPO/Debit and credit transactions are almost equal in a short period of time',
  },
  {
    code: 'SPOER',
    indicator: 'SPO/Early redemption of loan/ credit facilities by the customer or other parties',
  },
  {
    code: 'SPOFS',
    indicator: 'SPO/Frequent purchase / sale of specific securities with no economic reason',
  },
  { code: 'SPOHJ', indicator: 'SPO/Involved high risk jurisdiction' },
  { code: 'SPOSC', indicator: 'SPO/Issuance of several payment cards without an apparent reason' },
  { code: 'SPOTE', indicator: 'SPO/Manipulations for evading taxes' },
  { code: 'SPORI', indicator: 'SPO/New customers who are reluctant to provide needed information' },
  {
    code: 'SPFBT',
    indicator: 'SPO/Purchase of numerous airline or bus tickets without an apparent reason',
  },
  { code: 'SPOPS', indicator: 'SPO/Purchase of precious metals or stones' },
  {
    code: 'SPTLC',
    indicator: 'SPO/Receiving large transfers accompanied by instructions to be paid in cash',
  },
  { code: 'SPOPR', indicator: 'SPO/Related to a person that was previously reported to the FIU' },
  { code: 'SPTTC', indicator: 'SPO/Repeated or large transfers following cash deposits' },
  { code: 'SPTRH', indicator: 'SPO/Repeated or large transfers from high risk countries' },
  {
    code: 'SPOTC',
    indicator:
      "SPO/Repeated requests to issue traveller cheques or bearer negotiable instruments in a manner inconsistent with customer's business",
  },
  { code: 'SPOPC', indicator: 'SPO/Repeated transactions using payment cards' },
  { code: 'SPOS', indicator: 'SPO/Structuring' },
  { code: 'SPODO', indicator: 'SPO/Sudden use of dormant accounts' },
  {
    code: 'SPOSI',
    indicator: 'SPO/Suspicion is related to a person listed in sanction lists (international)',
  },
  {
    code: 'SPOSL',
    indicator: 'SPO/Suspicion is related to a person listed in sanction lists (local)',
  },
  { code: 'SPOPM', indicator: 'SPO/The customer is subject to provisional measures' },
  { code: 'SPOC', indicator: 'SPO/The customer shows no interest in the costs of the transaction' },
  { code: 'SPOR', indicator: 'SPO/The involved customer has a bad reputation all over the media' },
  { code: 'SPORE', indicator: 'SPO/The use of real estate finance / purchases' },
  { code: 'SPOBT', indicator: 'SPO/Transactions below reporting threshold' },
  { code: 'SPOHA', indicator: 'SPO/Transactions conducted in a high-risk local area' },
  { code: 'SPOEC', indicator: 'SPO/Transactions lacking an economic purpose' },
  { code: 'SPOUD', indicator: 'SPO/Ultimate disposition of funds is unknown' },
  {
    code: 'SPOUT',
    indicator: 'SPO/Unexplained termination of the business relationship or contract',
  },
  { code: 'SPOUS', indicator: 'SPO/Unknown source of funds' },
  {
    code: 'SPOUB',
    indicator: "SPO/Unusual financial behaviour by one of the financial institution's employees. ",
  },
  { code: 'SPOGA', indicator: 'SPO/Unusual gambling behavior' },
  { code: 'SPOSD', indicator: 'SPO/Unusual use of a safe deposit box' },
  { code: 'SPOMM', indicator: 'SPO/Unusual use of derivatives or money market instruments' },
  { code: 'SPOFM', indicator: 'SPO/Use of a family member account without an apparent reason' },
  { code: 'SPODN', indicator: 'SPO/Use of accountants/ lawyers' },
  { code: 'SPODC', indicator: 'SPO/Use of different currencies without an apparent reason' },
  { code: 'SPOOF', indicator: 'SPO/Use of offshore entities/ arrangements/ accounts' },
  { code: 'SPOPB', indicator: 'SPO/Use of personal account for business' },
  { code: 'SPOSH', indicator: 'SPO/Use of shell company' },
  { code: 'SPOVC', indicator: 'SPO/Use of virtual currencies' },
  {
    code: 'SPTTR',
    indicator: 'SPT/Transfers from/to customer without an apparent relation with the other party',
  },
  { code: 'STFP', indicator: 'ST/Financing the Polfiration of Weapons of Mass Destruction' },
  { code: 'STML', indicator: 'ST/Money Laundering' },
  { code: 'STPC', indicator: 'ST/Proceeds of crimes' },
  { code: 'STTF', indicator: 'ST/Terrorist Financing' },
];

export function IndicatorsStep() {
  const [searchIndicator, setSearchIndicator] = useState('');
  const helper = new ColumnHelper<any>();
  const filteredData = useMemo(() => {
    return INDICATORS.filter((d) => {
      return (
        d.code.toLowerCase().includes(searchIndicator?.toLowerCase()) ||
        d.indicator.toLowerCase().includes(searchIndicator?.toLowerCase())
      );
    });
  }, [searchIndicator]);
  return (
    <div className={s.root}>
      <Space direction="vertical">
        <TextInput
          value={searchIndicator}
          placeholder="Search for indicator code, description"
          onChange={(v) => setSearchIndicator(v || '')}
        />

        <Table<any>
          rowKey="code"
          toolsOptions={false}
          selection={true}
          columns={[
            helper.simple<'code'>({
              key: 'code',
              title: 'Code',
            }),
            helper.simple<'indicator'>({
              key: 'indicator',
              title: 'Indicator',
              defaultWidth: 1000,
            }),
          ]}
          data={{
            total: filteredData.length,
            items: filteredData,
          }}
        />
      </Space>
    </div>
  );
}

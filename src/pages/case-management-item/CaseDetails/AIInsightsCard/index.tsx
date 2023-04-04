import * as Card from '@/components/ui/Card';
interface Props {
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}
export default function AIInsightsCard(props: Props) {
  const { updateCollapseState, title, collapsableKey } = props;

  return (
    <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
      <Card.Section>
        <h3>Structured Summary</h3>
        <p>
          TORIELLI S.R.L is a foreign company registered in India under the Companies Act, 1956. It
          appears to be a subsidiary of an Italian company called TORIELLI & C. S.R.L, and is
          primarily engaged in the business of manufacturing and trading of textiles and clothing
          products. The company's registered office is located in the city of Mumbai, and its
          authorized share capital is INR 1,000,000, divided into 10,000 shares of INR 100 each. The
          last reported financial statements for the company are for the financial year ending on 31
          March 2019, where it reported a net loss of INR 2.9 million.
        </p>
        <p>
          Source: <a href="https://www.zaubacorp.com/company/TORIELLI-S-R-L/F01269">ZAUBACORP</a>
        </p>
      </Card.Section>
      <Card.Section>
        <h3>Structured Summary</h3>
        <p>
          TORIELLI & C. S.P.A is an Italian company that specializes in the manufacturing and sale
          of machinery and equipment for the textile and apparel industry. The company was founded
          in 1922 and is based in the town of Prato, in the Tuscany region of Italy. TORIELLI & C.
          S.P.A offers a range of products, including finishing machines, dyeing machines, and
          digital printing machines, among others. The company's products are marketed and sold
          globally through a network of agents and distributors. Additionally, the company offers
          technical support and after-sales service to its customers.
        </p>
        <p>
          Source: <a href="https://machinesitalia.org/company/torielli-c-spa">MACHINES ITALIA</a>
        </p>
      </Card.Section>
      <Card.Section>
        <h3>Structured Summary</h3>
        <p>
          TORIELLI S.R.L is a textile company based in Mauritius, and it is part of the TORIELLI
          group, which includes the Italian company TORIELLI & C. S.R.L. The company appears to be
          engaged in the manufacturing and export of high-end fabrics and textiles for the fashion
          and apparel industry. The LinkedIn page also suggests that the company has a vertically
          integrated supply chain, which allows it to control the entire production process, from
          sourcing raw materials to finished products. The company's products are exported to
          various countries around the world, including Europe, the United States, and Asia.
        </p>
        <p>
          Source: <a href="https://www.linkedin.com/company/torielli-s.r.l./about/">LINKEDIN</a>
        </p>
      </Card.Section>
    </Card.Root>
  );
}

import s from './index.module.less';

const Overview = () => {
  return (
    <div className={s.overview}>
      <div className={s.header}>
        <span>Overview</span>
        {/* <CompanyHeader /> */}
      </div>
      <p>
        Convey Health Solutions is a healthcare technology and services company that provides
        healthcare-specific member support solutions utilizing technology, engagement, and
        analytics. They are located in Sunrise, United States with 5001-10000 employees and a
        revenue of $500M-1B.
      </p>
      <span>Sentiment Score - 91</span>
    </div>
  );
};

export default Overview;


#!/bin/bash
set -eo pipefail
S3_BUCKET=$BUCKET_NAME
RESULT_HTML_REPORT_DIR=$(date +%Y%m%d%H%M%S)-html-report
RESULT_FILE=result-$(date +%Y%m%d%H%M%S).jtl
TEST_PLAN=plan.jmx
RESULT_S3_PATH=testing_results-$(date +%Y%m%d)/

echo "Running JMeter test..."
jmeter -n -t $TEST_PLAN \
  -JAPI_URL=$API_URL \
  -JX_API_KEY=$X_API_KEY \
  -JUSER_IDS=$USER_IDS \
  -JCONCURRENCY=$CONCURRENCY \
  -JDURATION=$DURATION \
  -l $RESULT_FILE -e -o $RESULT_HTML_REPORT_DIR
if [[ $? -ne 0 ]]; then  
  echo "JMeter test failed" >&2  
  exit 1  
fi  

echo "Uploading results to S3..."
aws s3 cp /opt/apache-jmeter-5.6.3/bin/$RESULT_FILE s3://$S3_BUCKET/$RESULT_S3_PATH
aws s3 cp /opt/apache-jmeter-5.6.3/bin/$RESULT_HTML_REPORT_DIR s3://$S3_BUCKET/$RESULT_S3_PATH$RESULT_HTML_REPORT_DIR/ --recursive

echo "Test execution completed."
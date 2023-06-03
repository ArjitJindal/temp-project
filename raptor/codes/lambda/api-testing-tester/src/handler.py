import os
import sys
import time
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)
log_handler = logging.StreamHandler(sys.stdout)
logger.addHandler(log_handler)

import http_request_tester as tester


def handle(event, context):
    logger.info('handler is triggered: start-test, event={}'.format(event))
    logger.info('Records count: {}'.format(len(event['Records'])))
    
    profile_name = os.environ.get('PROFILE_NAME', None)
    project_name = os.environ.get('PROJECT_NAME', 'project_name_empty')
    project_stage = os.environ.get('PROJECT_STAGE', 'project_stage_empty')
    api_endpoint = os.environ.get('API_ENDPOINT', 'api_endpoint_empty')
    
    logger.info('project_name: {}'.format(project_name))
    logger.info('project_stage: {}'.format(project_stage))
    logger.info('api_endpoint: {}'.format(api_endpoint))

    

    for record in event['Records']:
        message = json.loads(record['Sns']['Message'])
        interval_in_sec = int(message['Config']['IntervalInSec'])
        duration_in_sec = int(message['Config']['DurationInSec'])
        logger.info('handler start one-record, message={}'.format(message))

        api_gateway_tester = tester.HttpRequestTester(
            TestName='ApiGateway',
            ProfileName=profile_name,
            ProjectName=project_name,
            ProjectStage=project_stage,
            Endpoint=api_endpoint,
            ApiKey=None,
            Interval=interval_in_sec,
            Duration=duration_in_sec
            )
        api_gateway_tester.start_loop(message['TestData'])

        logger.info('handler finish one record: test-timeout duration_in_sec-{}'.format(duration_in_sec))

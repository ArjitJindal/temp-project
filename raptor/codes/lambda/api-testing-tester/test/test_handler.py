import os
import sys
import urllib.request
import urllib.parse

os.environ['PROFILE_NAME'] = 'AWSAdministratorAccess-911899431626'
os.environ['PROJECT_NAME'] = 'TransactionRisk'
os.environ['PROJECT_STAGE'] = 'Demo'
os.environ['API_ENDPOINT'] = 'upp8uv69fj.execute-api.us-east-1.amazonaws.com'
os.environ['DURATION_IN_SEC'] = '70'
os.environ['INTERVAL_IN_SEC'] = '30'

sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))+'/src')
import handler


def test_handler():
    handler.handle(None, None)


if __name__ == "__main__":
    test_handler()
import json
import boto3

profile = 'AWSAdministratorAccess-911899431626'
_endpoint_name = 'TransactionRiskDemo-TransactionRisk-Endpoint'

def set_profile(target):
    global profile
    profile = target


def get_client(service, profile):
    if profile is None:
        return boto3.client(service)
    else:
        return boto3.Session(profile_name=profile).client(service)


def get_resource(service, profile):
    if profile is None:
        return boto3.Session().resource(service)
    else:
        return boto3.Session(profile_name=profile).resource(service)


def invoke_endpoint(endpoint_name, data_dic):
    client = get_client('sagemaker-runtime', profile)

    payload = json.dumps(data_dic)

    response = client.invoke_endpoint(EndpointName=endpoint_name,
                                        ContentType='application/json',
                                        Body=payload)
    print('response', response)
    # print('response', response['Body'].read().decode('utf-8'))
    return response['Body'].read().decode('utf-8')


if __name__ == '__main__':
    with open('./input_data.json') as f:
        inputs = json.load(f)
    for input in inputs:
        print('-------------------------------------------------------------------')
        # PreProcessing input
        request = input['request']

        # Predict input
        response_str = invoke_endpoint(_endpoint_name, request)

        # validate result
        print('[{}]: result==>{}'.format(input['type'], response_str))
        assert(input['response']['success'] == json.loads(response_str)['success'])
        assert(input['response']['label'] == json.loads(response_str)['label'])
        print('[{}]: completed==>{}'.format(input['type'], input['request']['transaction']))

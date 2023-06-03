import os
import sys
import json
import logging

sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))+'/src')
import handler
handler.set_profile('AWSAdministratorAccess-911899431626')


def test_handle(event):
    return handler.handle(event, None)


if __name__ == '__main__':
    with open('./input_data.json') as f:
        inputs = json.load(f)

    for input in inputs:
        print('-------------------------------------------------------------------')
        # PreProcessing input
        request = input['request']

        # Predict input
        response = test_handle(request)

        # validate result
        print('[{}]: result==>{}'.format(input['type'], response))
        assert(input['response']['success'] == response['success'])
        assert(input['response']['label'] == response['label'])
        print('[{}]: completed==>{}'.format(input['type'], input['request']['transaction']))

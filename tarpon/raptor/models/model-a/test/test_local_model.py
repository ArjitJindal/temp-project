import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))+'/src/code')
import inference as sm

def test_simulation():
    # Prepare model
    model_path = './../src'
    model_dict = sm.model_fn(model_path)

    with open('./input_data.json') as f:
        inputs = json.load(f)
    for input in inputs:
        print('-------------------------------------------------------------------')
        # PreProcessing input
        request_str = json.dumps(input['request'])
        transaction = sm.input_fn(request_str, 'application/json')

        # Predict input
        prediction_output = sm.predict_fn(transaction, model_dict)

        # PostProcessing output
        response_str, _ = sm.output_fn(prediction_output, 'application/json')

        # validate result
        print('[{}]: result==>{}'.format(input['type'], response_str))
        assert(input['response']['success'] == json.loads(response_str)['success'])
        assert(input['response']['label'] == json.loads(response_str)['label'])
        print('[{}]: completed==>{}'.format(input['type'], input['request']['transaction']))


if __name__ == '__main__':
    test_simulation()

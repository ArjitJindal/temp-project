import os
import json
import logging
import pandas as pd

import threading
import utils

print('[INFO] load-thread id: {}'.format(threading.currentThread().getName()))
print('[INFO] load-process id: {}'.format(os.getpid()))
print('[INFO] load-SAGEMAKER_MODEL_SERVER_WORKERS: {}'.format(os.environ.get('SAGEMAKER_MODEL_SERVER_WORKERS', 'nonon')))

logger = logging.getLogger(__name__)

_model_file_name = 'model.pkl'

_content_type_json = 'application/json'

def model_fn(model_dir):
    print('[INFO] model_fn-thread id: {}'.format(threading.currentThread().getName()))
    print('[INFO] model_fn-process id: {}'.format(os.getpid()))
    logger.info('model_fn: Loading the model-{}'.format(model_dir))

    file_list = os.listdir(model_dir)
    logger.info("model_fn: model_dir list-{}".format(file_list))

    model = pd.read_pickle(os.path.join(model_dir, _model_file_name))
    #model = pickle.load(open(os.path.join(model_dir, _model_file_name), 'rb'))


    return {'model': model }


def input_fn(serialized_input_data, content_type=_content_type_json):
    logger.info('input_fn: Deserializing the input data.')

    if content_type == _content_type_json:
        input_data = json.loads(serialized_input_data)
        if 'transaction' not in input_data:
            raise Exception('Requested input data did not contain transaction')
        
        transaction = input_data['transaction']
        return transaction
    
    raise Exception('Requested unsupported ContentType in content_type: ' + content_type)


"""
These are the columns that the model takes for prediction:
num_columns = ["hour_sin", "hour_cos", "day_sin", "day_cos", "week_day_sin", "week_day_cos", "amount_usd"]
cat_columns_one_hot = ["destinationCountry", "originCountry", "originMethod"]
cat_columns_target_encode = ["transactionId", "originUserId", "destinationUserId"]
"""


def predict_fn(transaction, model_dict):
    logger.info('predict_fn: Predicting for {}.'.format(transaction))
    
    model = model_dict['model']
    
    extracted_transaction = utils.extract_transaction_data(transaction)
    predictions = model.predict(extracted_transaction) #get the prediction
    scores = model.decision_function(extracted_transaction) #and the anomaly score
    result = {}
    result["predictions"] = predictions.tolist()
    result["scores"] = scores.tolist()
    logger.info('predict_fn: Prediction result is {}.'.format(result))
    
    return result        

def output_fn(predicted_label, accept=_content_type_json):
    logger.info('output_fn: Serializing the generated output.')

    if accept == _content_type_json:
        response = {
            'success': 'true',
            'label': predicted_label
        }
        return json.dumps(response), accept
    
    raise Exception('output_fn: Requested unsupported ContentType in Accept: ' + accept)

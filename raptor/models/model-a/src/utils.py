import datetime
import numpy as np
import pandas as pd
import requests

date_types = ['hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'week_day_sin', 'week_day_cos']
columns_to_keep = ['transactionId', 'originUserId', 'destinationUserId',
       'destinationCountry', 'destinationCurrency',
       'originCountry', 'originCurrency', 'destinationMethod',
       'originMethod', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos',
       'week_day_sin', 'week_day_cos', 'amount_usd']

def get_exchange_rate(source_curr, target_curr):
    url = f'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/{source_curr}/{target_curr}.min.json'
    response = requests.get(url)
    print(response)
    data = response.json()
    return data

#this function handles the circular time data
def discretize_date(current_date, t):
    cdate = datetime.datetime.fromtimestamp(float(current_date) / 1000.0)
    if t == 'hour_sin':
        return np.sin(2 * np.pi * cdate.hour/24.0)
    if t == 'hour_cos':
        return np.cos(2 * np.pi * cdate.hour/24.0)
    if t == 'day_sin':
        return np.sin(2 * np.pi * cdate.timetuple().tm_yday/365.0)
    if t == 'day_cos':
        return np.cos(2 * np.pi * cdate.timetuple().tm_yday/365.0)
    if t == 'week_day_sin':
        return np.sin(2 * np.pi * cdate.weekday()/7.0)
    if t == 'week_day_cos':
        return np.cos(2 * np.pi * cdate.weekday()/7.0)

def extract_transaction_data(data): 
    features = pd.json_normalize(data)
    try:
        features = pd.concat([features, pd.Series({dt: discretize_date(features['timestamp.$numberLong'], dt) for dt in date_types}).to_frame().T], axis=1)
    except KeyError:
        features = pd.concat([features, pd.DataFrame({dt: [None] for dt in date_types})], axis=1)

        
    
    cols_to_rename = {'destinationAmountDetails.country': 'destinationCountry',
        'destinationAmountDetails.transactionCurrency': 'destinationCurrency',
        'destinationAmountDetails.transactionAmount': 'destinationAmount',
                     'destinationPaymentDetails.method': 'destinationMethod',
                     'originPaymentDetails.method': 'originMethod',
                     'originAmountDetails.country': 'originCountry',
                     'originAmountDetails.transactionCurrency': 'originCurrency',
                     'originAmountDetails.transactionAmount': 'originAmount'}
 
    # call rename () method
    features.rename(columns=cols_to_rename,
          inplace=True)
    
    features['amount_usd'] = features.apply(lambda row: row['destinationAmount'] * get_exchange_rate(row['destinationCurrency'].lower(), 'usd')['usd'], axis=1)
    existing_columns_to_keep = [col for col in columns_to_keep if col in features.columns]

    # keep only the existing columns
    features = features.loc[:, existing_columns_to_keep]
    features = features.reindex(columns=columns_to_keep, fill_value= 'NaN')
    return features
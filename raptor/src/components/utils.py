import os
import sys

import numpy as np
from pandas import Series

import dill  # type: ignore
import pickle
from sklearn.metrics import r2_score  # type: ignore
from sklearn.model_selection import GridSearchCV  # type: ignore


def save_object(file_path: str, obj):
    dir_path = os.path.dirname(file_path)

    os.makedirs(dir_path, exist_ok=True)

    with open(file_path, "wb") as file_obj:
        pickle.dump(obj, file_obj)


def evaluate_models(
    X_train: Series,
    y_train: Series,
    X_test: Series,
    y_test: Series,
    models: dict,
    param: dict,
):

    report = {}

    for i in range(len(list(models))):
        model = list(models.values())[i]
        para = param[list(models.keys())[i]]

        gs = GridSearchCV(model, para, cv=3, scoring="r2", error_score="raise")
        gs.fit(X_train, y_train)

        model.set_params(**gs.best_params_)
        model.fit(X_train, y_train)

        # model.fit(X_train, y_train)  # Train model

        y_train_pred = model.predict(X_train)
        y_test_pred = model.predict(X_test)

        train_model_score = r2_score(y_train, y_train_pred)
        test_model_score = r2_score(y_test, y_test_pred)

        report[list(models.keys())[i]] = test_model_score
    return report


def load_object(file_path: str):
    with open(file_path, "rb") as file_obj:
        return pickle.load(file_obj)

import os
import sys
from dataclasses import dataclass

import pandas as pd
from pandas import DataFrame
from sklearn.ensemble import IsolationForest  # type: ignore
from sklearn.neighbors import LocalOutlierFactor  # type: ignore
from sklearn.metrics import r2_score  # type: ignore

from src.components.utils import save_object, evaluate_models


@dataclass
class ModelTrainerConfig:
    trained_model_file_path = os.path.join("artifacts", "model.pkl")


class ModelTrainer:
    def __init__(self):
        self.model_trainer_config = ModelTrainerConfig()

    def initiate_model_trainer(self, train_array: DataFrame, test_array: DataFrame):
        print("Split training and test input data")
        X_train, y_train, X_test, y_test = (
            train_array[:, :-1],
            train_array[:, -1],
            test_array[:, :-1],
            test_array[:, -1],
        )

        # Hyperparameters
        n_samples = 300
        outliers_fraction = 0.15

        models = {
            "Local Outlier Factor": LocalOutlierFactor(),
            "Isolation Forest": IsolationForest(),
        }
        params = {
            "Local Outlier Factor": {
                "contamination": [outliers_fraction],
                "n_neighbors": [35],
                "novelty": [True],
            },
            "Isolation Forest": {"random_state": [42]},
        }

        model_report: dict = evaluate_models(
            X_train=X_train.toarray(),
            y_train=y_train.toarray(),
            X_test=X_test.toarray(),
            y_test=y_test.toarray(),
            models=models,
            param=params,
        )

        best_model_score = max(sorted(model_report.values()))

        best_model_name = list(model_report.keys())[
            list(model_report.values()).index(best_model_score)
        ]
        best_model = models[best_model_name]

        print(
            f"Best found model on both training and testing dataset with score: ${best_model_score}"
        )

        save_object(
            file_path=self.model_trainer_config.trained_model_file_path, obj=best_model
        )

        predicted = best_model.predict(X_test)

        r2_square = r2_score(y_test.toarray(), predicted)
        return r2_square

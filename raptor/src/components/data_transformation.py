import os
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer  # type: ignore
from sklearn.impute import SimpleImputer  # type: ignore
from sklearn.pipeline import Pipeline  # type: ignore
from sklearn.preprocessing import OneHotEncoder, StandardScaler  # type: ignore


@dataclass
class DataTransformationConfig:
    """DataTransformationConfig data class"""

    preprocessor_obj_file_path = os.path.join("artifact", "preprocessor.pkl")


class DataTransformation:
    def __init__(self):
        self.transformation_config = DataTransformationConfig()

    def get_data_transformer_object(self):
        """Data transformation pipeline for the model"""
        numeric_features = [
            "originPaymentDetails.merchantDetails.mcc",
            "datetime",
            "hour",
            "day_of_week",
            "log_origin_amount",
            "log_destination_amount",
            "user_avg_transaction",
        ]
        categorical_features = [
            "transactionId",
            "transactionState",
            "type",
            "originAmountDetails.transactionCurrency",
            "destinationAmountDetails.transactionCurrency",
            "originPaymentDetails.method",
            "originPaymentDetails.country",
            "originPaymentDetails.cardType",
            "originPaymentDetails.cardBrand",
            "originPaymentDetails.merchantDetails.category",
            "originPaymentDetails.merchantDetails.city",
            "originPaymentDetails.merchantDetails.country",
        ]

        numberical_pipeine = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )

        categorical_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ("scaler", StandardScaler()),
            ]
        )

        print("Categorical cols encoding completed ")
        print("Numerical cols scaling completed ")

        preprocessor = ColumnTransformer(
            transformers=[
                ("num", numberical_pipeine, numeric_features),
                ("cat", categorical_pipeline, categorical_features),
            ]
        )

        return preprocessor

    def initiate_date_transaformation(self, train_path, test_path):
        train_df = pd.read_csv(train_path)
        test_df = pd.read_csv(test_path)
        print("Read complete")

        preprocessor = self.get_data_transformer_object()
        print(
            f"Applying preprocessing object on training dataframe and testing dataframe."
        )

        input_feature_train_arr = preprocessor.fit_transform(train_df)
        input_feature_test_arr = preprocessor.transform(test_df)

        os.makedirs(
            os.path.dirname(self.transformation_config.preprocessor_obj_file_path),
            exist_ok=True,
        )
        with open(self.transformation_config.preprocessor_obj_file_path, "wb") as f:
            pickle.dump(preprocessor, f)
        print("Data transformation complete")
        return (
            input_feature_train_arr,
            input_feature_test_arr,
            self.transformation_config.preprocessor_obj_file_path,
        )

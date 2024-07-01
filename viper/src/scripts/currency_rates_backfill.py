import json
from datetime import datetime, timedelta

import requests


def fetch_currency_data(start_date, end_date, access_key, base="USD"):
    # Convert start and end date strings to datetime objects
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    # Open the file to write the JSON objects
    with open("data/currency_rates_backfill.json", "a") as file:
        # Loop over the date range
        current_date = start
        while current_date <= end:
            # Format the current date as a string
            date_str = current_date.strftime("%Y-%m-%d")

            # Build the API endpoint URL
            url = f"https://api.exchangeratesapi.io/v1/{date_str}"
            params = {
                "access_key": access_key,
                "base": base,
            }

            # Make the API request
            response = requests.get(url, params=params)

            # Check if the request was successful
            if response.status_code == 200:
                # Convert the response to JSON
                data = response.json()

                # Drop unnecessary keys
                data.pop("base", None)
                data.pop("timestamp", None)
                data.pop("historical", None)
                data.pop("success", None)

                # Write the cleaned JSON object as a string to the file, followed by a newline
                file.write(json.dumps(data) + "\n")

            # Move to the next day
            current_date += timedelta(days=1)


# Example usage
API_KEY = "79bc9fd5e5dda4dc155ac6e1096071c2"
fetch_currency_data("2024-04-20", "2024-06-05", API_KEY)

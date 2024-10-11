import os
import requests
import json
from models import Instrument
from extensions import db
from datetime import datetime

def download_and_store_json(app):
    tmp_folder = "/tmp"
    json_file_path = os.path.join(tmp_folder, "OpenAPIScripMaster.json")
    
    with app.app_context():
        try:
            # 1. Download JSON to the local tmp folder
            url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
            response = requests.get(url)

            # Save the JSON locally
            with open(json_file_path, 'w') as json_file:
                json.dump(response.json(), json_file)

            # Load data from the JSON file
            with open(json_file_path, 'r') as json_file:
                instruments_data = json.load(json_file)

            # 3. Clear existing data (drop and recreate the table)
            db.drop_all()  # Drop all tables
            db.create_all()  # Recreate the tables

            # 2. Prepare bulk insert with `strike` and `tick_size` divided by 100
            instrument_objects = [
                Instrument(
                    token=instrument['token'],
                    symbol=instrument['symbol'],
                    name=instrument['name'],
                    expiry=instrument['expiry'],
                    strike=float(instrument['strike']) / 100,
                    lotsize=int(instrument['lotsize']),
                    instrumenttype=instrument['instrumenttype'],
                    exch_seg=instrument['exch_seg'],
                    tick_size=float(instrument['tick_size']) / 100
                ) for instrument in instruments_data
            ]

            # Bulk insert all instruments at once
            db.session.bulk_save_objects(instrument_objects)
            db.session.commit()
            print(f"Bulk data successfully downloaded and stored at {datetime.now()}")

            # 4. Delete the JSON file after successful bulk upload
            if os.path.exists(json_file_path):
                os.remove(json_file_path)
                print(f"Temporary JSON file deleted: {json_file_path}")

        except Exception as e:
            print(f"Error occurred: {e}")
            # Clean up in case of error
            if os.path.exists(json_file_path):
                os.remove(json_file_path)

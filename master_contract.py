import os
import requests
import json
from models import Instrument
from extensions import db
from datetime import datetime
from sqlalchemy import Index, inspect

def index_exists(engine, index_name):
    """Check if an index exists in the database."""
    inspector = inspect(engine)
    for idx in inspector.get_indexes(Instrument.__tablename__):
        if idx['name'] == index_name:
            return True
    return False

def download_and_store_json(app):
    tmp_folder = "/tmp"
    json_file_path = os.path.join(tmp_folder, "OpenAPIScripMaster.json")
    
    with app.app_context():
        try:
            print("Master Contract Download Started")
            # 1. Download JSON to the local tmp folder
            url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
            response = requests.get(url)

            # Save the JSON locally
            with open(json_file_path, 'w') as json_file:
                json.dump(response.json(), json_file)

            # Load data from the JSON file
            with open(json_file_path, 'r') as json_file:
                instruments_data = json.load(json_file)

            # 3. Clear existing data (drop and recreate the Instrument table only)
            Instrument.__table__.drop(db.engine)
            Instrument.__table__.create(db.engine)

            # 2. Prepare bulk insert with `strike` and `tick_size` divided by 100
            filtered_instruments_data = [
                instrument for instrument in instruments_data 
                if (instrument['exch_seg'] != 'NSE' or  # Keep non-NSE instruments as they are
                   (('-EQ' in instrument['symbol'] or '-BE' in instrument['symbol']) or
                    instrument['instrumenttype'] == 'AMXIDX'))
            ]

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
                ) for instrument in filtered_instruments_data
            ]

            # Bulk insert all filtered instruments at once
            db.session.bulk_save_objects(instrument_objects)
            db.session.commit()

            # 4. Create indexes on `symbol`, `token`, `expiry`, and `exch_seg` if they don't exist
            index_mappings = [
                ('idx_symbol', Instrument.symbol),
                ('idx_token', Instrument.token),
                ('idx_expiry', Instrument.expiry),
                ('idx_exch_seg', Instrument.exch_seg)
            ]
            
            for index_name, column in index_mappings:
                if not index_exists(db.engine, index_name):
                    index = Index(index_name, column)
                    index.create(db.engine)

            print(f"Filtered bulk data successfully downloaded and stored with indexes at {datetime.now()}")

            # 5. Delete the JSON file after successful bulk upload
            if os.path.exists(json_file_path):
                os.remove(json_file_path)
                print(f"Temporary JSON file deleted: {json_file_path}")

        except Exception as e:
            print(f"Error occurred: {e}")
            # Clean up in case of error
            if os.path.exists(json_file_path):
                os.remove(json_file_path)

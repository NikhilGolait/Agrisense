
# no working code
from flask import Flask, request, jsonify
import pandas as pd
import joblib
import numpy as np

app = Flask(__name__)


crop_model = joblib.load("crop_model.pkl")
fertilizer_model = joblib.load("fertilizer_model.pkl")

city_data = pd.read_csv("city_farming_data.csv")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    city = data.get("city")
    temperature = data.get("temperature")
    humidity = data.get("humidity")
    rainfall = data.get("rainfall")

    city_info = city_data[city_data["city"].str.lower() == city.lower()]
    if city_info.empty or city_info.iloc[0]["farming_status"] == "No":
        return jsonify({"crop": "N/A", "fertilizers": [], "pesticides": []})


    features = np.array([[temperature, humidity, rainfall]])
    predicted_crop = crop_model.predict(features)[0]

    predicted_fertilizer = fertilizer_model.predict([[temperature, humidity, rainfall]])[0]


    pesticide_map = {
        "rice": ["Carbofuran", "Imidacloprid"],
        "maize": ["Atrazine", "Glyphosate"],
        "wheat": ["2,4-D", "Mancozeb"],
    }
    pesticides = pesticide_map.get(predicted_crop.lower(), ["General Insecticide"])

    return jsonify({
        "crop": predicted_crop,
        "fertilizers": [predicted_fertilizer],
        "pesticides": pesticides
    })


if __name__ == "__main__":
    app.run(debug=True)

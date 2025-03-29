from flask import Flask, render_template, jsonify, request, redirect, url_for, Response
import tensorflow as tf
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import json
import os
from datetime import datetime, timedelta
import requests
import threading
import time

app = Flask(__name__)

# ThingSpeak API Configuration
CHANNEL_ID = "2869932"
READ_API_KEY = "F3PQYXN46UYN3MKK"
WRITE_API_KEY = "IEBBZHE6PF383F96"
BASE_URL = f"https://api.thingspeak.com/channels/{CHANNEL_ID}"

# Field mapping
FIELD_MAPPING = {
    "force": 1,
    "torque": 2,
    "altitude": 3,
    "wind_speed": 4,
    "tilt_angle": 5,
    "temperature": 6,
    "vibrations": 7,
    "humidity": 8
}

# Global cache to store latest data and predictions
cache = {
    "latest_data": None,
    "latest_prediction": None,
    "last_updated": None,
    "historical_data": {},
    "prediction_history": []
}

# Model accuracy tracking
MODEL_ACCURACY = {
    "value": 0.92,  # Initial default accuracy
    "last_updated": datetime.now().isoformat(),
    "history": []
}

# Try to load accuracy from file if it exists
try:
    if os.path.exists('model_accuracy.json'):
        with open('model_accuracy.json', 'r') as f:
            MODEL_ACCURACY = json.load(f)
            print("Model accuracy loaded from file")
except Exception as e:
    print(f"Error loading model accuracy: {e}")

# Cache settings
REFRESH_INTERVAL = 10  # seconds
MAX_PREDICTION_HISTORY = 100

# Load ML model
try:
    model = tf.keras.models.load_model('crane_model.h5')
    print("ML model loaded successfully")
except Exception as e:
    print(f"Error loading ML model: {e}")
    model = None

# Load scaler parameters
try:
    with open('scaler.json', 'r') as f:
        scaler_params = json.load(f)
        
    scaler = MinMaxScaler()
    scaler.min_ = np.array(scaler_params['min_'])
    scaler.scale_ = np.array(scaler_params['scale_'])
    scaler.data_min_ = np.array(scaler_params['data_min_'])
    scaler.data_max_ = np.array(scaler_params['data_max_'])
    scaler.data_range_ = np.array(scaler_params['data_range_'])
    print("Scaler parameters loaded successfully")
except Exception as e:
    print(f"Error loading scaler parameters: {e}")
    scaler = None

# Function to fetch latest data from ThingSpeak
def fetch_latest_data():
    try:
        response = requests.get(f"{BASE_URL}/feeds/last.json?api_key={READ_API_KEY}")
        if response.status_code == 200:
            data = response.json()
            
            # Convert string values to float, handle missing values
            for i in range(1, 9):
                field_key = f"field{i}"
                if field_key in data and data[field_key] is not None:
                    try:
                        data[field_key] = float(data[field_key])
                    except (ValueError, TypeError):
                        data[field_key] = 0.0
                else:
                    data[field_key] = 0.0
            
            return data
        else:
            print(f"Error fetching data: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"Exception fetching data: {e}")
        return None

# Function to predict failure probability
def predict_failure(data):
    if model is None or scaler is None:
        return {"probability": 0.0, "warning_level": "unknown", "message": "Model not loaded"}
    
    try:
        # Prepare data for ML model
        model_input = np.array([[
            data.get("field1", 0.0),  # force
            data.get("field2", 0.0),  # torque
            data.get("field3", 0.0),  # altitude
            data.get("field4", 0.0),  # wind_speed
            data.get("field8", 0.0),  # humidity
            data.get("field6", 0.0),  # temperature
            data.get("field7", 0.0),  # vibrations
            3000  # operational_hours (placeholder)
        ]])
        
        # Scale the input data
        model_input_scaled = scaler.transform(model_input)
        
        # Make prediction
        failure_prob = float(model.predict(model_input_scaled)[0][0])
        
        # Determine warning level
        warning_level = "normal"
        warning_message = "All systems normal"
        
        if failure_prob > 0.7:
            warning_level = "critical"
            warning_message = "Critical failure risk detected! Immediate inspection required."
        elif failure_prob > 0.5:
            warning_level = "warning"
            warning_message = "Elevated failure risk. Schedule maintenance soon."
        elif failure_prob > 0.3:
            warning_level = "caution"
            warning_message = "Slight increase in failure probability. Monitor closely."
        
        return {
            "probability": failure_prob,
            "warning_level": warning_level,
            "message": warning_message
        }
    except Exception as e:
        print(f"Error making prediction: {e}")
        return {"probability": 0.0, "warning_level": "error", "message": f"Error making prediction: {str(e)}"}

# Function to update cache with latest data and predictions
def update_cache():
    global cache
    
    data = fetch_latest_data()
    if data:
        cache["latest_data"] = data
        prediction = predict_failure(data)
        cache["latest_prediction"] = prediction
        cache["last_updated"] = datetime.now()
        
        # Add to prediction history
        if len(cache["prediction_history"]) >= MAX_PREDICTION_HISTORY:
            cache["prediction_history"].pop(0)
        
        cache["prediction_history"].append({
            "timestamp": data["created_at"],
            "probability": prediction["probability"],
            "warning_level": prediction["warning_level"]
        })

# Background thread function to continuously update cache
def background_update():
    while True:
        update_cache()
        time.sleep(REFRESH_INTERVAL)

# Start background thread for data updates
update_thread = threading.Thread(target=background_update, daemon=True)
update_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/dashboard/<field>')
def field_dashboard(field):
    if field in FIELD_MAPPING:
        return render_template(
            'field_dashboard.html', 
            field=field, 
            field_number=FIELD_MAPPING[field],
            channel_id=CHANNEL_ID,
            read_api_key=READ_API_KEY
        )
    return redirect(url_for('index'))

@app.route('/api/live_data')
def get_live_data():
    """Endpoint to get the latest cached data and prediction"""
    if cache["latest_data"] is None:
        return jsonify({"success": False, "error": "No data available yet"})
    
    data = cache["latest_data"]
    prediction = cache["latest_prediction"]
    
    response = {
        "success": True,
        "timestamp": data["created_at"],
        "last_updated": cache["last_updated"].isoformat() if cache["last_updated"] else None,
        "sensors": {
            "force": data["field1"],
            "torque": data["field2"],
            "altitude": data["field3"],
            "wind_speed": data["field4"],
            "tilt_angle": data["field5"],
            "temperature": data["field6"],
            "vibrations": data["field7"],
            "humidity": data["field8"],
        },
        "failure_probability": prediction["probability"],
        "warning_level": prediction["warning_level"],
        "warning_message": prediction["message"]
    }
    
    return jsonify(response)

@app.route('/api/data')
def get_data():
    """Enhanced endpoint to get real-time data for all fields with improved error handling"""
    try:
        # Check if we have cached data
        if cache["latest_data"] is None:
            # Try to fetch fresh data if cache is empty
            data = fetch_latest_data()
            if data is None:
                return jsonify({
                    "success": False, 
                    "error": "Unable to fetch data from ThingSpeak",
                    "timestamp": datetime.now().isoformat()
                })
        else:
            data = cache["latest_data"]
        
        # Format response with all field data
        response = {
            "success": True,
            "timestamp": data["created_at"],
            "last_updated": datetime.now().isoformat(),
            "data": {
                # Include all 8 fields with their numeric values
                "force": float(data["field1"]),
                "torque": float(data["field2"]),
                "altitude": float(data["field3"]),
                "wind_speed": float(data["field4"]),
                "tilt_angle": float(data["field5"]),
                "temperature": float(data["field6"]),
                "vibrations": float(data["field7"]),
                "humidity": float(data["field8"])
            },
            # Include raw fields for direct access
            "raw_fields": {
                f"field{i}": float(data[f"field{i}"]) for i in range(1, 9)
            },
            "channel_id": CHANNEL_ID
        }
        
        # Include prediction data if available
        if cache["latest_prediction"]:
            response["prediction"] = {
                "failure_probability": cache["latest_prediction"]["probability"],
                "warning_level": cache["latest_prediction"]["warning_level"],
                "message": cache["latest_prediction"]["message"]
            }
        
        return jsonify(response)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error processing data: {str(e)}",
            "timestamp": datetime.now().isoformat()
        })

@app.route('/api/stream_data')
def stream_data():
    """Server-sent events endpoint for real-time data streaming"""
    def generate():
        while True:
            if cache["latest_data"] is not None:
                data = cache["latest_data"]
                prediction = cache["latest_prediction"]
                
                event_data = json.dumps({
                    "timestamp": data["created_at"],
                    "sensors": {
                        "force": data["field1"],
                        "torque": data["field2"],
                        "altitude": data["field3"],
                        "wind_speed": data["field4"],
                        "tilt_angle": data["field5"],
                        "temperature": data["field6"],
                        "vibrations": data["field7"],
                        "humidity": data["field8"],
                    },
                    "failure_probability": prediction["probability"],
                    "warning_level": prediction["warning_level"],
                    "warning_message": prediction["message"]
                })
                
                yield f"data: {event_data}\n\n"
            
            time.sleep(1)  # Send updates every second
    
    response = Response(generate(), mimetype="text/event-stream")
    response.headers.add('Cache-Control', 'no-cache')
    response.headers.add('Connection', 'keep-alive')
    return response

@app.route('/api/accuracy')
def get_model_accuracy():
    """New endpoint to return the current model accuracy"""
    try:
        # Get optional parameters
        format_type = request.args.get('format', 'percent')  # percent or decimal
        
        accuracy = MODEL_ACCURACY["value"]
        if format_type == 'percent':
            formatted_accuracy = f"{accuracy * 100:.2f}%"
        else:
            formatted_accuracy = accuracy
            
        response = {
            "success": True,
            "accuracy": formatted_accuracy,
            "raw_accuracy": accuracy,
            "last_updated": MODEL_ACCURACY["last_updated"],
            "model_info": {
                "name": "crane_model.h5",
                "type": "Neural Network" if model is not None else "Unknown",
                "status": "Loaded" if model is not None else "Not loaded"
            }
        }
        
        # Add history if it exists
        if "history" in MODEL_ACCURACY and MODEL_ACCURACY["history"]:
            response["history"] = MODEL_ACCURACY["history"]
        
        return jsonify(response)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error retrieving model accuracy: {str(e)}"
        })

@app.route('/api/accuracy/update', methods=['POST'])
def update_model_accuracy():
    """Endpoint to update the model accuracy (for admin use)"""
    try:
        data = request.get_json()
        if not data or 'accuracy' not in data:
            return jsonify({
                "success": False,
                "error": "Missing required field: accuracy"
            }), 400
            
        # Validate accuracy value
        accuracy = float(data['accuracy'])
        if accuracy < 0 or accuracy > 1:
            return jsonify({
                "success": False,
                "error": "Accuracy must be between 0 and 1"
            }), 400
            
        # Update the accuracy
        MODEL_ACCURACY["value"] = accuracy
        MODEL_ACCURACY["last_updated"] = datetime.now().isoformat()
        
        # Add to history if tracking is enabled
        if 'track_history' in data and data['track_history']:
            if "history" not in MODEL_ACCURACY:
                MODEL_ACCURACY["history"] = []
                
            MODEL_ACCURACY["history"].append({
                "timestamp": MODEL_ACCURACY["last_updated"],
                "accuracy": accuracy,
                "notes": data.get('notes', '')
            })
            
            # Limit history size
            if len(MODEL_ACCURACY["history"]) > 100:
                MODEL_ACCURACY["history"] = MODEL_ACCURACY["history"][-100:]
        
        # Save to file
        with open('model_accuracy.json', 'w') as f:
            json.dump(MODEL_ACCURACY, f)
            
        return jsonify({
            "success": True,
            "message": "Accuracy updated successfully",
            "accuracy": accuracy
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error updating model accuracy: {str(e)}"
        }), 500

@app.route('/api/prediction_history')
def get_prediction_history():
    """Endpoint to get historical prediction data"""
    days = int(request.args.get('days', 7))
    limit = int(request.args.get('limit', 100))
    
    # Filter prediction history by time if needed
    if days > 0 and cache["prediction_history"]:
        cutoff_date = datetime.now() - timedelta(days=days)
        filtered_history = [
            p for p in cache["prediction_history"] 
            if datetime.strptime(p["timestamp"], "%Y-%m-%dT%H:%M:%SZ") >= cutoff_date
        ]
    else:
        filtered_history = cache["prediction_history"]
    
    # Limit the number of records returned
    limited_history = filtered_history[-limit:] if limit > 0 else filtered_history
    
    return jsonify({
        "success": True,
        "history": limited_history
    })

@app.route('/api/historical_data/<field>')
def get_historical_data(field):
    """Endpoint to get historical sensor data from ThingSpeak"""
    field_number = FIELD_MAPPING.get(field)
    if not field_number:
        return jsonify({"success": False, "error": "Invalid field"})
    
    days = int(request.args.get('days', 7))
    results = int(request.args.get('results', 1000))
    average = request.args.get('average', None)  # Time average in minutes
    
    cache_key = f"{field}_{days}_{results}_{average}"
    
    # Check if we have this data cached and it's recent (less than 30 minutes old)
    if cache_key in cache["historical_data"]:
        cached_data, timestamp = cache["historical_data"][cache_key]
        if (datetime.now() - timestamp).total_seconds() < 1800:  # 30 minutes
            return jsonify(cached_data)
    
    try:
        # Calculate start date (days ago from now)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Format dates for ThingSpeak API
        start_str = start_date.strftime('%Y-%m-%dT%H:%M:%SZ')
        end_str = end_date.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Build API request
        url = f"{BASE_URL}/fields/{field_number}.json"
        params = {
            "api_key": READ_API_KEY,
            "start": start_str,
            "end": end_str,
            "results": results
        }
        
        # Add average parameter if provided
        if average:
            params["average"] = average
        
        # Make API request
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            feeds = data.get("feeds", [])
            
            # Extract timestamps and values
            timestamps = []
            values = []
            
            for feed in feeds:
                if feed["created_at"] and feed.get(f"field{field_number}") is not None:
                    timestamps.append(feed["created_at"])
                    try:
                        values.append(float(feed[f"field{field_number}"]))
                    except (ValueError, TypeError):
                        values.append(None)
            
            result = {
                "success": True,
                "field": field,
                "field_number": field_number,
                "start_date": start_str,
                "end_date": end_str,
                "timestamps": timestamps,
                "values": values,
                "count": len(timestamps)
            }
            
            # Cache the result
            cache["historical_data"][cache_key] = (result, datetime.now())
            
            return jsonify(result)
        else:
            return jsonify({"success": False, "error": f"ThingSpeak API returned status code {response.status_code}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/thingspeak/embed/<field>')
def get_thingspeak_embed(field):
    """Endpoint to get embed URLs for ThingSpeak charts"""
    field_number = FIELD_MAPPING.get(field)
    if not field_number:
        return jsonify({"success": False, "error": "Invalid field"})
    
    days = int(request.args.get('days', 7))
    width = request.args.get('width', '100%')
    height = request.args.get('height', '400')
    
    # Basic chart URL
    chart_url = f"https://thingspeak.com/channels/{CHANNEL_ID}/charts/{field_number}?api_key={READ_API_KEY}"
    
    # Chart with days parameter
    chart_days_url = f"{chart_url}&days={days}"
    
    # Dynamic chart URL (JavaScript embed)
    dynamic_chart_url = (
        f"https://thingspeak.com/channels/{CHANNEL_ID}/charts/{field_number}?"
        f"api_key={READ_API_KEY}&dynamic=true&results={days*24*6}"  # Approximate 6 readings per hour
    )
    
    # iFrame HTML for embedding
    iframe_html = (
        f'<iframe width="{width}" height="{height}" frameborder="0" src="{chart_days_url}"></iframe>'
    )
    
    return jsonify({
        "success": True,
        "field": field,
        "field_number": field_number,
        "chart_url": chart_url,
        "chart_days_url": chart_days_url,
        "dynamic_chart_url": dynamic_chart_url,
        "iframe_html": iframe_html
    })

@app.route('/api/thingspeak/dashboard')
def get_thingspeak_dashboard():
    """Endpoint to get ThingSpeak dashboard URL"""
    dashboard_url = f"https://thingspeak.com/channels/{CHANNEL_ID}"
    private_dashboard_url = f"{dashboard_url}?api_key={READ_API_KEY}"
    
    return jsonify({
        "success": True,
        "dashboard_url": dashboard_url,
        "private_dashboard_url": private_dashboard_url
    })

@app.route('/api/predict', methods=['POST'])
def custom_prediction():
    """Endpoint for making custom predictions based on user-provided data"""
    if model is None or scaler is None:
        return jsonify({"success": False, "error": "ML model or scaler not loaded"})
    
    try:
        # Get data from request
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"})
        
        # Prepare data for ML model with provided or default values
        model_input = np.array([[
            float(data.get("force", 0)),
            float(data.get("torque", 0)),
            float(data.get("altitude", 0)),
            float(data.get("wind_speed", 0)),
            float(data.get("humidity", 0)),
            float(data.get("temperature", 0)),
            float(data.get("vibrations", 0)),
            float(data.get("operational_hours", 3000))
        ]])
        
        # Scale the input data
        model_input_scaled = scaler.transform(model_input)
        
        # Make prediction
        failure_prob = float(model.predict(model_input_scaled)[0][0])
        
        # Determine warning level
        warning_level = "normal"
        warning_message = "All systems normal"
        
        if failure_prob > 0.7:
            warning_level = "critical"
            warning_message = "Critical failure risk detected! Immediate inspection required."
        elif failure_prob > 0.5:
            warning_level = "warning"
            warning_message = "Elevated failure risk. Schedule maintenance soon."
        elif failure_prob > 0.3:
            warning_level = "caution"
            warning_message = "Slight increase in failure probability. Monitor closely."
        
        return jsonify({
            "success": True,
            "input": data,
            "prediction": {
                "probability": failure_prob,
                "warning_level": warning_level,
                "message": warning_message
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    # Initial cache update before starting
    update_cache()
    app.run(debug=True, threaded=True)

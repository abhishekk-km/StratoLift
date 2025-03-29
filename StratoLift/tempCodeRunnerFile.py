from flask import Flask, render_template, jsonify, request
import requests
import pandas as pd
import numpy as np
import json
import time
from datetime import datetime
import tensorflow as tf
from config import THINGSPEAK_READ_API_KEY

app = Flask(__name__)

# ThingSpeak configuration
THINGSPEAK_BASE_URL = "https://api.thingspeak.com/channels/"
THINGSPEAK_CHANNEL_ID = "YOUR_CHANNEL_ID"  # Replace with your channel ID

# Load the trained model
model = tf.keras.models.load_model('models/crane_classification_model.h5')

# Load the scaler parameters
with open('models/scaler.json', 'r') as f:
    scaler_params = json.load(f)

# Create a scaler with the saved parameters
from sklearn.preprocessing import MinMaxScaler
scaler = MinMaxScaler()
scaler.min_ = np.array(scaler_params['min_'])
scaler.scale_ = np.array(scaler_params['scale_'])
scaler.data_min_ = np.array(scaler_params['data_min_'])
scaler.data_max_ = np.array(scaler_params['data_max_'])
scaler.data_range_ = np.array(scaler_params['data_range_'])
feature_names = scaler_params['feature_names']

@app.route('/')
def index():
    """Render the main dashboard page"""
    return render_template('index.html')

@app.route('/documentation')
def documentation():
    """Render the documentation page"""
    return render_template('documentation.html')

@app.route('/api/live-data')
def get_live_data():
    """Fetch the most recent data from ThingSpeak"""
    crane_id = request.args.get('crane_id', 'CRANE_1')
    
    # Adjust channel ID based on crane selection
    channel_id = THINGSPEAK_CHANNEL_ID
    if crane_id == 'CRANE_2':
        channel_id = "YOUR_CRANE2_CHANNEL_ID"  # Replace with your second crane channel ID
    
    # Fetch the latest data point from ThingSpeak
    url = f"{THINGSPEAK_BASE_URL}{channel_id}/feeds/last.json?api_key={THINGSPEAK_READ_API_KEY}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Extract parameters from ThingSpeak
        timestamp = data['created_at']
        load = float(data['field1']) if data['field1'] else 0
        torque = float(data['field2']) if data['field2'] else 0
        altitude = float(data['field3']) if data['field3'] else 0
        wind_speed = float(data['field4']) if data['field4'] else 0
        humidity = float(data['field5']) if data['field5'] else 0
        temperature = float(data['field6']) if data['field6'] else 0
        vibrations = float(data['field7']) if data['field7'] else 0
        
        # Calculate operational hours (example logic)
        operational_hours = calculate_operational_hours(crane_id)
        
        # Get prediction from ML model
        prediction = predict_failure_probability(load, torque, altitude, wind_speed, 
                                               humidity, temperature, vibrations, 
                                               operational_hours)
        
        return jsonify({
            'timestamp': timestamp,
            'load': load,
            'torque': torque,
            'altitude': altitude,
            'wind_speed': wind_speed,
            'humidity': humidity,
            'temperature': temperature,
            'vibrations': vibrations,
            'operational_hours': operational_hours,
            'failure_probability': prediction
        })
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f"Error fetching data: {str(e)}"}), 500

@app.route('/api/historical-data')
def get_historical_data():
    """Fetch historical data from ThingSpeak"""
    crane_id = request.args.get('crane_id', 'CRANE_1')
    days = int(request.args.get('days', 7))
    
    # Adjust channel ID based on crane selection
    channel_id = THINGSPEAK_CHANNEL_ID
    if crane_id == 'CRANE_2':
        channel_id = "YOUR_CRANE2_CHANNEL_ID"  # Replace with your second crane channel ID
    
    # Calculate the number of data points to retrieve (e.g., 24 points per day)
    results = days * 24
    
    # Fetch historical data from ThingSpeak
    url = f"{THINGSPEAK_BASE_URL}{channel_id}/feeds.json?api_key={THINGSPEAK_READ_API_KEY}&results={results}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Process the historical data
        historical_data = []
        for entry in data['feeds']:
            timestamp = entry['created_at']
            
            # Extract parameters, using 0 as default if field is empty
            load = float(entry['field1']) if entry['field1'] else 0
            torque = float(entry['field2']) if entry['field2'] else 0
            altitude = float(entry['field3']) if entry['field3'] else 0
            wind_speed = float(entry['field4']) if entry['field4'] else 0
            humidity = float(entry['field5']) if entry['field5'] else 0
            temperature = float(entry['field6']) if entry['field6'] else 0
            vibrations = float(entry['field7']) if entry['field7'] else 0
            
            historical_data.append({
                'timestamp': timestamp,
                'load': load,
                'torque': torque,
                'altitude': altitude,
                'wind_speed': wind_speed,
                'humidity': humidity,
                'temperature': temperature,
                'vibrations': vibrations
            })
        
        return jsonify(historical_data)
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f"Error fetching historical data: {str(e)}"}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    """Generate prediction based on input parameters"""
    data = request.json
    
    # Extract parameters from request
    load = data.get('load', 0)
    torque = data.get('torque', 0)
    altitude = data.get('altitude', 0)
    wind_speed = data.get('wind_speed', 0)
    humidity = data.get('humidity', 0)
    temperature = data.get('temperature', 0)
    vibrations = data.get('vibrations', 0)
    operational_hours = data.get('operational_hours', 0)
    
    # Get prediction
    prediction = predict_failure_probability(load, torque, altitude, wind_speed, 
                                           humidity, temperature, vibrations, 
                                           operational_hours)
    
    return jsonify({
        'failure_probability': prediction,
        'maintenance_recommendation': get_maintenance_recommendation(prediction)
    })

def calculate_operational_hours(crane_id):
    """Calculate operational hours for a given crane (placeholder function)"""
    # In a real implementation, this would fetch from a database or calculate based on historical data
    # For this example, we'll return a random value between 100 and 5000
    return np.random.randint(100, 5000)

def predict_failure_probability(load, torque, altitude, wind_speed, humidity, temperature, vibrations, operational_hours):
    """Use the ML model to predict failure probability"""
    # Create input data in the correct order matching the training features
    input_data = pd.DataFrame({
        'load': [load],
        'torque': [torque],
        'altitude': [altitude],
        'wind_speed': [wind_speed],
        'humidity': [humidity],
        'temperature': [temperature],
        'vibrations': [vibrations],
        'operational_hours': [operational_hours]
    })
    
    # Reorder columns to match training data
    input_data = input_data[feature_names]
    
    # Normalize input features using the loaded scaler
    input_scaled = scaler.transform(input_data)
    
    # Make prediction
    prediction = float(model.predict(input_scaled)[0][0])
    
    return prediction

def get_maintenance_recommendation(failure_probability):
    """Generate maintenance recommendations based on failure probability"""
    if failure_probability < 0.2:
        return "No maintenance required at this time."
    elif failure_probability < 0.4:
        return "Schedule routine maintenance within the next month."
    elif failure_probability < 0.6:
        return "Schedule maintenance within the next two weeks."
    elif failure_probability < 0.8:
        return "Schedule maintenance within the next week. Monitor closely."
    else:
        return "URGENT: Immediate maintenance required. Risk of failure is high."

if __name__ == '__main__':
    app.run(debug=True)

from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import json
import time
from datetime import datetime, timedelta
import tensorflow as tf

app = Flask(__name__)

# Load the trained model
model = tf.keras.models.load_model('models/crane_model.h5')

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
    """Generate simulated live data"""
    crane_id = request.args.get('crane_id', 'CRANE_1')
    
    # Generate simulated data
    timestamp = datetime.now().isoformat()
    load = np.random.uniform(30, 70)
    torque = np.random.uniform(15, 35)
    altitude = np.random.uniform(5, 25)
    wind_speed = np.random.uniform(3, 12)
    humidity = np.random.uniform(20, 60)
    temperature = np.random.uniform(15, 30)
    vibrations = np.random.uniform(1, 8)
    
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

@app.route('/api/historical-data')
def get_historical_data():
    """Generate simulated historical data"""
    crane_id = request.args.get('crane_id', 'CRANE_1')
    days = int(request.args.get('days', 7))
    
    # Generate historical data points (e.g., 24 points per day)
    num_points = days * 24
    
    # Initialize lists for historical data
    historical_data = []
    
    # Generate data points with some realistic trends
    base_load = np.random.uniform(30, 50)
    base_torque = np.random.uniform(15, 25)
    base_altitude = np.random.uniform(10, 20)
    base_wind_speed = np.random.uniform(5, 10)
    base_humidity = np.random.uniform(30, 50)
    base_temperature = np.random.uniform(18, 25)
    base_vibrations = np.random.uniform(2, 5)
    
    for i in range(num_points):
        # Add some random variation and trends to base values
        time_factor = i / num_points  # Creates a trend over time
        
        # Current timestamp (going backwards from now)
        current_time = datetime.now() - timedelta(hours=num_points-i)
        timestamp = current_time.isoformat()
        
        # Generate values with some randomness and trend
        load = base_load + np.sin(time_factor * np.pi) * 10 + np.random.normal(0, 3)
        torque = base_torque + np.cos(time_factor * np.pi) * 5 + np.random.normal(0, 2)
        altitude = base_altitude + np.sin(time_factor * np.pi * 2) * 3 + np.random.normal(0, 1)
        wind_speed = base_wind_speed + np.sin(time_factor * np.pi * 3) * 3 + np.random.normal(0, 1)
        humidity = base_humidity + np.cos(time_factor * np.pi * 2) * 10 + np.random.normal(0, 3)
        temperature = base_temperature + np.sin(time_factor * np.pi) * 5 + np.random.normal(0, 1)
        vibrations = base_vibrations + np.cos(time_factor * np.pi * 4) * 2 + np.random.normal(0, 0.5)
        
        historical_data.append({
            'timestamp': timestamp,
            'load': max(0, load),  # Ensure no negative values
            'torque': max(0, torque),
            'altitude': max(0, altitude),
            'wind_speed': max(0, wind_speed),
            'humidity': max(0, humidity),
            'temperature': max(0, temperature),
            'vibrations': max(0, vibrations)
        })
    
    return jsonify(historical_data)

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
    """Calculate operational hours for a given crane (simplified function)"""
    # In a real implementation, this would fetch from a database
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

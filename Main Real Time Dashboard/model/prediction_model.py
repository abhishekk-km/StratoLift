import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib
import os
from datetime import datetime

# Path to save the model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'crane_model.joblib')

def train_model(data):
    """
    Train a predictive maintenance model using historical data
    
    Args:
        data: List of dictionaries containing sensor readings
        
    Returns:
        Trained model
    """
    # Convert data to numpy arrays
    X = []
    for entry in data:
        X.append([
            entry['force'],
            entry['torque'],
            entry['altitude'],
            entry['wind_speed'],
            entry['tilt_angle'],
            entry['temperature'],
            entry['vibrations'],
            entry['humidity']
        ])
    X = np.array(X)
    
    # For demonstration, we'll create a simple target based on vibration and load
    # In a real scenario, this would be based on actual failure data
    y = 100 - (0.5 * X[:, 6] + 0.3 * X[:, 0] + 0.2 * np.random.rand(X.shape[0]) * 10)
    y = np.clip(y, 0, 100)  # Ensure values are between 0-100%
    
    # Train model
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)
    
    # Save the model
    joblib.dump(model, MODEL_PATH)
    
    return model

def predict_maintenance(recent_data):
    """
    Predict operational health for the next 7 days
    
    Args:
        recent_data: Recent sensor readings
        
    Returns:
        List of predicted health percentages for next 7 days
    """
    # Load or train model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    else:
        model = train_model(recent_data)
    
    # Prepare the most recent data point
    latest_data = recent_data[-1]
    X_latest = np.array([
        latest_data['force'],
        latest_data['torque'],
        latest_data['altitude'],
        latest_data['wind_speed'],
        latest_data['tilt_angle'],
        latest_data['temperature'],
        latest_data['vibrations'],
        latest_data['humidity']
    ]).reshape(1, -1)
    
    # For demonstration, we'll simulate degradation over time
    predictions = []
    current_prediction = float(model.predict(X_latest)[0])
    predictions.append(current_prediction)
    
    # Simulate degradation for next 6 days
    for i in range(6):
        # Add some random degradation
        degradation = np.random.uniform(1, 3)
        next_prediction = max(0, current_prediction - degradation)
        predictions.append(next_prediction)
        current_prediction = next_prediction
    
    return predictions

import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Dense, Dropout
import numpy as np
import pandas as pd
import os
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler

def create_model():
    """Create and return a TensorFlow model for failure prediction"""
    model = Sequential([
        Dense(64, activation='relu', input_shape=(8,)),
        Dropout(0.2),
        Dense(32, activation='relu'),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1, activation='sigmoid')  # Output is probability of failure
    ])
    
    model.compile(
        optimizer='adam',
        loss='mse',  # Using MSE for regression
        metrics=['mae']  # Mean Absolute Error
    )
    
    return model

def preprocess_data(data):
    """Preprocess data for model training"""
    # Separate features and target
    X = data.drop('failure_probability', axis=1)
    y = data['failure_probability']
    
    # Normalize features
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Save feature names for reference
    feature_names = X.columns.tolist()
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    # Save scaler parameters
    scaler_params = {
        'min_': scaler.min_.tolist(),
        'scale_': scaler.scale_.tolist(),
        'data_min_': scaler.data_min_.tolist(),
        'data_max_': scaler.data_max_.tolist(),
        'data_range_': scaler.data_range_.tolist(),
        'feature_names': feature_names
    }
    
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    # Save scaler parameters to JSON
    with open('models/scaler.json', 'w') as f:
        json.dump(scaler_params, f)
    
    return X_train, X_test, y_train, y_test, scaler, feature_names

def predict_failure_probability(model, data, scaler):
    """Predict failure probability for input data"""
    # Normalize input data
    data_scaled = scaler.transform(data)
    
    # Make prediction
    prediction = model.predict(data_scaled)
    
    # Return the scalar probability value
    return float(prediction[0][0])

def evaluate_model(model, X_test, y_test):
    """Evaluate model performance"""
    loss, mae = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Loss (MSE): {loss:.4f}")
    print(f"Test MAE: {mae:.4f}")
    
    # Make predictions
    y_pred = model.predict(X_test).flatten()
    
    # Calculate additional metrics
    from sklearn.metrics import mean_squared_error, r2_score
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"Root Mean Squared Error: {rmse:.4f}")
    print(f"R² Score: {r2:.4f}")
    
    return loss, mae, rmse, r2

if __name__ == "__main__":
    # Create directory for models
    os.makedirs('models', exist_ok=True)
    
    # Create synthetic data for demonstration
    np.random.seed(42)
    n_samples = 10000
    
    synthetic_data = pd.DataFrame({
        'load': np.random.uniform(0, 100, n_samples),
        'torque': np.random.uniform(0, 50, n_samples),
        'altitude': np.random.uniform(0, 30, n_samples),
        'wind_speed': np.random.uniform(0, 20, n_samples),
        'humidity': np.random.uniform(0, 100, n_samples),
        'temperature': np.random.uniform(-10, 40, n_samples),
        'vibrations': np.random.uniform(0, 10, n_samples),
        'operational_hours': np.random.uniform(0, 5000, n_samples)
    })
    
    # Generate synthetic failure probabilities (continuous values between 0 and 1)
    failure_prob = (
        synthetic_data['load'] / 100 * 0.3 +
        synthetic_data['torque'] / 50 * 0.15 +
        synthetic_data['wind_speed'] / 20 * 0.2 +
        synthetic_data['vibrations'] / 10 * 0.25 +
        synthetic_data['operational_hours'] / 5000 * 0.1 +
        np.random.normal(0, 0.05, n_samples)  # Add some noise
    )
    
    # Clip probabilities to be between 0 and 1
    synthetic_data['failure_probability'] = np.clip(failure_prob, 0, 1)
    
    # Preprocess data
    X_train, X_test, y_train, y_test, scaler, feature_names = preprocess_data(synthetic_data)
    
    # Create and train model
    model = create_model()
    history = model.fit(
        X_train, y_train, 
        epochs=100,  # Increased epochs for better training
        batch_size=64, 
        validation_data=(X_test, y_test),
        verbose=1
    )
    
    # Evaluate model
    evaluate_model(model, X_test, y_test)
    
    # Save model
    model.save('models/crane_model.h5')
    print("Model saved successfully to models/crane_model.h5")
    
    # Test prediction with a sample input
    test_data = pd.DataFrame({
        'load': [80],
        'torque': [40],
        'altitude': [20],
        'wind_speed': [15],
        'humidity': [60],
        'temperature': [30],
        'vibrations': [7],
        'operational_hours': [4000]
    })
    
    # Ensure columns are in the correct order
    test_data = test_data[feature_names]
    
    prediction = predict_failure_probability(model, test_data, scaler)
    print(f"Sample prediction - Failure probability: {prediction:.2%}")
    
    # Provide maintenance recommendation based on failure probability
    if prediction < 0.2:
        recommendation = "No maintenance required at this time."
    elif prediction < 0.4:
        recommendation = "Schedule routine maintenance within the next month."
    elif prediction < 0.6:
        recommendation = "Schedule maintenance within the next two weeks."
    elif prediction < 0.8:
        recommendation = "Schedule maintenance within the next week. Monitor closely."
    else:
        recommendation = "URGENT: Immediate maintenance required. Risk of failure is high."
    
    print(f"Maintenance recommendation: {recommendation}")

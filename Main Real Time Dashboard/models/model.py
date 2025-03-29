import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
import numpy as np
import pandas as pd
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
        Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def preprocess_data(data):
    """Preprocess data for model training"""
    # Normalize features
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(data.drop('failure', axis=1))
    y = data['failure']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    return X_train, X_test, y_train, y_test, scaler

def predict_failure_probability(model, data, scaler):
    """Predict failure probability for input data"""
    # Normalize input data
    data_scaled = scaler.transform(data)
    
    # Make prediction
    prediction = model.predict(data_scaled)
    
    return prediction[0][0]

if __name__ == "__main__":
    # This is just for testing the model functionality
    # In a real implementation, you would load actual data
    
    # Create synthetic data for demonstration
    np.random.seed(42)
    n_samples = 1000
    
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
    
    # Generate synthetic failure labels (higher values of features increase failure probability)
    failure_prob = (
        synthetic_data['load'] / 100 * 0.3 +
        synthetic_data['torque'] / 50 * 0.15 +
        synthetic_data['wind_speed'] / 20 * 0.2 +
        synthetic_data['vibrations'] / 10 * 0.25 +
        synthetic_data['operational_hours'] / 5000 * 0.1
    )
    
    synthetic_data['failure'] = (failure_prob > 0.5).astype(int)
    
    # Preprocess data
    X_train, X_test, y_train, y_test, scaler = preprocess_data(synthetic_data)
    
    # Create and train model
    model = create_model()
    model.fit(X_train, y_train, epochs=10, batch_size=32, validation_data=(X_test, y_test))
    
    # Save model
    model.save('crane_model.h5')
    
    # Test prediction
    test_data = np.array([[
        80,  # load
        40,  # torque
        20,  # altitude
        15,  # wind_speed
        60,  # humidity
        30,  # temperature
        7,   # vibrations
        4000 # operational_hours
    ]])
    
    prediction = predict_failure_probability(model, test_data, scaler)
    print(f"Failure probability: {prediction:.2%}")

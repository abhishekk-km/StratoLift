import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt
import os
import json

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

def generate_synthetic_data(n_samples=5000):
    """Generate synthetic data for model training"""
    # Create features
    data = pd.DataFrame({
        'load': np.random.uniform(0, 100, n_samples),
        'torque': np.random.uniform(0, 50, n_samples),
        'altitude': np.random.uniform(0, 30, n_samples),
        'wind_speed': np.random.uniform(0, 20, n_samples),
        'humidity': np.random.uniform(0, 100, n_samples),
        'temperature': np.random.uniform(-10, 40, n_samples),
        'vibrations': np.random.uniform(0, 10, n_samples),
        'operational_hours': np.random.uniform(0, 5000, n_samples)
    })
    
    # Generate synthetic failure labels with some domain knowledge
    # Higher values of certain features increase failure probability
    failure_prob = (
        data['load'] / 100 * 0.3 +                  # Load has 30% impact
        data['torque'] / 50 * 0.15 +                # Torque has 15% impact
        data['wind_speed'] / 20 * 0.2 +             # Wind speed has 20% impact
        data['vibrations'] / 10 * 0.25 +            # Vibrations have 25% impact
        data['operational_hours'] / 5000 * 0.1 +    # Operational hours have 10% impact
        np.random.normal(0, 0.1, n_samples)         # Add some noise
    )
    
    # Normalize probability between 0 and 1
    failure_prob = (failure_prob - failure_prob.min()) / (failure_prob.max() - failure_prob.min())
    
    # Create binary labels for training (1 = failure, 0 = no failure)
    data['failure_binary'] = (failure_prob > 0.5).astype(int)
    
    # Also store the continuous probability for regression training
    data['failure_prob'] = failure_prob
    
    return data

def preprocess_data(data, target='failure_binary'):
    """Preprocess data for model training"""
    # Separate features and target
    X = data.drop(['failure_binary', 'failure_prob'], axis=1)
    if target == 'failure_binary':
        y = data['failure_binary']
    else:
        y = data['failure_prob']
    
    # Normalize features
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    # Save scaler for later use
    scaler_filename = 'models/scaler.json'
    os.makedirs(os.path.dirname(scaler_filename), exist_ok=True)
    
    # Save scaler parameters
    scaler_params = {
        'data_min_': scaler.data_min_.tolist(),
        'data_max_': scaler.data_max_.tolist(),
        'data_range_': scaler.data_range_.tolist(),
        'scale_': scaler.scale_.tolist(),
        'min_': scaler.min_.tolist(),
        'feature_names': X.columns.tolist()
    }
    
    with open(scaler_filename, 'w') as f:
        json.dump(scaler_params, f)
    
    return X_train, X_test, y_train, y_test, X.columns.tolist()

def create_classification_model(input_shape):
    """Create a binary classification model for failure prediction"""
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', tf.keras.metrics.AUC()]
    )
    
    return model

def create_regression_model(input_shape):
    """Create a regression model for failure probability prediction"""
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='mean_squared_error',
        metrics=['mean_absolute_error']
    )
    
    return model

def train_and_evaluate_model(model_type='classification'):
    """Train and evaluate the model"""
    # Generate synthetic data
    print("Generating synthetic data...")
    data = generate_synthetic_data()
    
    # Preprocess data
    print("Preprocessing data...")
    if model_type == 'classification':
        X_train, X_test, y_train, y_test, feature_names = preprocess_data(data, 'failure_binary')
    else:
        X_train, X_test, y_train, y_test, feature_names = preprocess_data(data, 'failure_prob')
    
    # Create model
    print(f"Creating {model_type} model...")
    if model_type == 'classification':
        model = create_classification_model(X_train.shape[1])
    else:
        model = create_regression_model(X_train.shape[1])
    
    # Define callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=0.0001
        )
    ]
    
    # Train model
    print("Training model...")
    history = model.fit(
        X_train, y_train,
        epochs=100,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate model
    print("Evaluating model...")
    evaluation = model.evaluate(X_test, y_test)
    
    # Print evaluation metrics
    if model_type == 'classification':
        print(f"Test Loss: {evaluation[0]:.4f}")
        print(f"Test Accuracy: {evaluation[1]:.4f}")
        print(f"Test AUC: {evaluation[2]:.4f}")
    else:
        print(f"Test Loss (MSE): {evaluation[0]:.4f}")
        print(f"Test MAE: {evaluation[1]:.4f}")
    
    # Plot training history
    plt.figure(figsize=(12, 5))
    
    # Plot loss
    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    # Plot metrics
    plt.subplot(1, 2, 2)
    if model_type == 'classification':
        plt.plot(history.history['accuracy'], label='Training Accuracy')
        plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
        plt.title('Model Accuracy')
        plt.ylabel('Accuracy')
    else:
        plt.plot(history.history['mean_absolute_error'], label='Training MAE')
        plt.plot(history.history['val_mean_absolute_error'], label='Validation MAE')
        plt.title('Model MAE')
        plt.ylabel('MAE')
    
    plt.xlabel('Epoch')
    plt.legend()
    
    # Save plot
    plt.tight_layout()
    plt.savefig(f'models/{model_type}_training_history.png')
    plt.close()
    
    # Save model
    model_path = f'models/crane_{model_type}_model.h5'
    model.save(model_path)
    print(f"Model saved to {model_path}")
    
    # Save model summary
    with open(f'models/{model_type}_model_summary.txt', 'w') as f:
        model.summary(print_fn=lambda x: f.write(x + '\n'))
    
    return model, history, feature_names

if __name__ == "__main__":
    # Train classification model
    print("=== Training Classification Model ===")
    classification_model, classification_history, feature_names = train_and_evaluate_model('classification')
    
    # Train regression model
    print("\n=== Training Regression Model ===")
    regression_model, regression_history, _ = train_and_evaluate_model('regression')
    
    print("\nTraining complete. Models saved to 'models/' directory.")

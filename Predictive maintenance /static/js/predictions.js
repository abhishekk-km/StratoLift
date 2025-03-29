// This file contains functions specific to the prediction functionality

// Initialize prediction sliders with current values
function initializePredictionSliders(data) {
    if (!data) return;
    
    // Set initial values for sliders based on current data
    document.getElementById('load-slider').value = data.load;
    document.getElementById('load-value').textContent = data.load + ' kN';
    
    document.getElementById('torque-slider').value = data.torque;
    document.getElementById('torque-value').textContent = data.torque + ' Nm';
    
    document.getElementById('altitude-slider').value = data.altitude;
    document.getElementById('altitude-value').textContent = data.altitude + ' m';
    
    document.getElementById('wind-slider').value = data.wind_speed;
    document.getElementById('wind-value').textContent = data.wind_speed + ' m/s';
    
    document.getElementById('humidity-slider').value = data.humidity;
    document.getElementById('humidity-value').textContent = data.humidity + ' %';
    
    document.getElementById('temperature-slider').value = data.temperature;
    document.getElementById('temperature-value').textContent = data.temperature + ' °C';
    
    document.getElementById('vibrations-slider').value = data.vibrations;
    document.getElementById('vibrations-value').textContent = data.vibrations + ' Hz';
    
    document.getElementById('hours-slider').value = data.operational_hours;
    document.getElementById('hours-value').textContent = data.operational_hours + ' hrs';
}

// Reset prediction sliders to default values
function resetPredictionSliders() {
    document.getElementById('load-slider').value = 50;
    document.getElementById('load-value').textContent = '50 kN';
    
    document.getElementById('torque-slider').value = 25;
    document.getElementById('torque-value').textContent = '25 Nm';
    
    document.getElementById('altitude-slider').value = 15;
    document.getElementById('altitude-value').textContent = '15 m';
    
    document.getElementById('wind-slider').value = 5;
    document.getElementById('wind-value').textContent = '5 m/s';
    
    document.getElementById('humidity-slider').value = 50;
    document.getElementById('humidity-value').textContent = '50 %';
    
    document.getElementById('temperature-slider').value = 25;
    document.getElementById('temperature-value').textContent = '25 °C';
    
    document.getElementById('vibrations-slider').value = 2;
    document.getElementById('vibrations-value').textContent = '2 Hz';
    
    document.getElementById('hours-slider').value = 1000;
    document.getElementById('hours-value').textContent = '1000 hrs';
}

// Generate prediction based on current slider values
function generateManualPrediction() {
    const loadValue = parseFloat(document.getElementById('load-slider').value);
    const torqueValue = parseFloat(document.getElementById('torque-slider').value);
    const altitudeValue = parseFloat(document.getElementById('altitude-slider').value);
    const windSpeedValue = parseFloat(document.getElementById('wind-slider').value);
    const humidityValue = parseFloat(document.getElementById('humidity-slider').value);
    const temperatureValue = parseFloat(document.getElementById('temperature-slider').value);
    const vibrationsValue = parseFloat(document.getElementById('vibrations-slider').value);
    const operationalHoursValue = parseFloat(document.getElementById('hours-slider').value);
    
    const predictionData = {
        load: loadValue,
        torque: torqueValue,
        altitude: altitudeValue,
        wind_speed: windSpeedValue,
        humidity: humidityValue,
        temperature: temperatureValue,
        vibrations: vibrationsValue,
        operational_hours: operationalHoursValue
    };
    
    fetch('/api/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictionData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        updatePredictionDisplay(data);
    })
    .catch(error => {
        console.error('Error generating prediction:', error);
        showAlert('Error generating prediction. Please try again.', 'danger');
    });
}

// Update the prediction display with new prediction data
function updatePredictionDisplay(data) {
    // Update prediction value
    const predictionValue = document.getElementById('prediction-value');
    predictionValue.textContent = (data.failure_probability * 100).toFixed(1) + '%';
    
    // Apply status color
    if (data.failure_probability > 0.7) {
        predictionValue.className = 'prediction-value status-danger';
    } else if (data.failure_probability > 0.3) {
        predictionValue.className = 'prediction-value status-warning';
    } else {
        predictionValue.className = 'prediction-value status-normal';
    }
    
    // Update recommendation
    document.getElementById('recommendation-text').textContent = data.maintenance_recommendation;
    
    // Update gauge chart if it exists
    if (window.charts && window.charts.failurePrediction) {
        window.charts.failurePrediction.data.datasets[0].needleValue = data.failure_probability;
        window.charts.failurePrediction.update();
    }
}

// Add event listeners for prediction sliders
function setupPredictionSliders() {
    const sliders = document.querySelectorAll('.parameter-slider input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', function() {
            const valueDisplay = this.parentElement.querySelector('.slider-value');
            const unit = getUnitForParameter(this.id);
            valueDisplay.textContent = this.value + unit;
        });
    });
    
    // Add event listener for reset button
    const resetButton = document.getElementById('reset-prediction');
    if (resetButton) {
        resetButton.addEventListener('click', resetPredictionSliders);
    }
    
    // Add event listener for predict button
    const predictButton = document.getElementById('generate-prediction');
    if (predictButton) {
        predictButton.addEventListener('click', generateManualPrediction);
    }
}

// Initialize prediction functionality
document.addEventListener('DOMContentLoaded', function() {
    setupPredictionSliders();
    
    // Initialize with default values
    resetPredictionSliders();
    
    // Fetch live data to initialize sliders with current values
    fetch(`/api/live-data?crane_id=${currentCrane || 'CRANE_1'}`)
        .then(response => response.json())
        .then(data => {
            initializePredictionSliders(data);
        })
        .catch(error => {
            console.error('Error fetching data for prediction initialization:', error);
        });
});

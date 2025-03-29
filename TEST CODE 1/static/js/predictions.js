// predictions.js - Handles real-time prediction data visualization

// Configuration
const PREDICTION_CONFIG = {
    refreshInterval: 10000, // Refresh every 10 seconds if not using SSE
    thresholds: {
        caution: 0.3,  // 30% failure probability
        warning: 0.5,  // 50% failure probability
        critical: 0.7   // 70% failure probability
    },
    gaugeColors: {
        normal: '#4CAF50',  // Green
        caution: '#FFC107', // Yellow
        warning: '#FF9800', // Orange
        critical: '#F44336' // Red
    },
    animationDuration: 800, // Duration of animations in ms
    maxHistoryPoints: 50    // Max number of data points to keep for trend
};

// Store prediction history
let predictionHistory = [];
let gaugeChart = null;
let predictionTrendChart = null;

// Initialize prediction visualization
document.addEventListener('DOMContentLoaded', function() {
    initializePredictionGauge();
    initializePredictionTrendChart();
    setupEventListeners();
    
    // Initial data fetch
    fetchPredictionData();
    
    // Set up real-time updates using Server-Sent Events
    initializeSSE();
    
    // Fallback: Set up a timed refresh if SSE is not supported
    if (!window.EventSource) {
        console.log('SSE not supported, using polling');
        setInterval(fetchPredictionData, PREDICTION_CONFIG.refreshInterval);
    }
});

// Fetch prediction data from API
async function fetchPredictionData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch prediction data');
        }
        
        // Extract prediction data - handle different response formats
        const prediction = {
            probability: data.failure_probability || 
                         (data.prediction ? data.prediction.failure_probability : 0),
            warning_level: data.warning_level || 
                           (data.prediction ? data.prediction.warning_level : 'normal'),
            message: data.warning_message || 
                     (data.prediction ? data.prediction.message : '')
        };
        
        // Update visualization
        updatePredictionGauge(prediction.probability);
        updatePredictionTrend(prediction.probability);
        updateWarningStatus(prediction.warning_level, prediction.message);
        
        return prediction;
    } catch (error) {
        console.error('Error fetching prediction data:', error);
        showPredictionError(error.message);
        return null;
    }
}

// Initialize the prediction gauge
function initializePredictionGauge() {
    const gaugeElement = document.getElementById('prediction-gauge');
    if (!gaugeElement) return;
    
    const ctx = gaugeElement.getContext('2d');
    
    gaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: [
                    PREDICTION_CONFIG.gaugeColors.normal,
                    'rgba(200, 200, 200, 0.2)'
                ],
                borderWidth: 0,
                needleValue: 0 // For custom gauge renderer
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: 270,
            cutout: '75%',
            animation: {
                duration: PREDICTION_CONFIG.animationDuration,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                },
                valueLabel: {
                    display: true,
                    formatter: value => `${(value * 100).toFixed(1)}%`,
                    color: '#fff',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: {
                        top: 5,
                        bottom: 5,
                        left: 10,
                        right: 10
                    },
                    borderRadius: 4
                }
            }
        }
    });
}

// Initialize prediction trend chart
function initializePredictionTrendChart() {
    const trendElement = document.getElementById('prediction-trend');
    if (!trendElement) return;
    
    const ctx = trendElement.getContext('2d');
    
    predictionTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Failure Probability',
                data: [],
                borderColor: PREDICTION_CONFIG.gaugeColors.warning,
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        callback: function(value) {
                            return (value * 100).toFixed(0) + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Probability: ${(context.parsed.y * 100).toFixed(1)}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}

// Update prediction gauge with new value
function updatePredictionGauge(probability) {
    if (!gaugeChart) return;
    
    // Convert to percentage for display
    const percentage = probability * 100;
    
    // Update gauge data with smooth animation
    gaugeChart.data.datasets[0].data = [percentage, 100 - percentage];
    gaugeChart.data.datasets[0].needleValue = probability;
    
    // Update color based on threshold
    if (probability >= PREDICTION_CONFIG.thresholds.critical) {
        gaugeChart.data.datasets[0].backgroundColor[0] = PREDICTION_CONFIG.gaugeColors.critical;
    } else if (probability >= PREDICTION_CONFIG.thresholds.warning) {
        gaugeChart.data.datasets[0].backgroundColor[0] = PREDICTION_CONFIG.gaugeColors.warning;
    } else if (probability >= PREDICTION_CONFIG.thresholds.caution) {
        gaugeChart.data.datasets[0].backgroundColor[0] = PREDICTION_CONFIG.gaugeColors.caution;
    } else {
        gaugeChart.data.datasets[0].backgroundColor[0] = PREDICTION_CONFIG.gaugeColors.normal;
    }
    
    gaugeChart.update();
    
    // Update text display if it exists
    const valueDisplay = document.getElementById('prediction-value');
    if (valueDisplay) {
        // Add CSS transition for smooth text update
        valueDisplay.style.transition = 'color 0.5s ease';
        valueDisplay.textContent = `${percentage.toFixed(1)}%`;
        
        // Apply color based on threshold
        if (probability >= PREDICTION_CONFIG.thresholds.critical) {
            valueDisplay.style.color = PREDICTION_CONFIG.gaugeColors.critical;
        } else if (probability >= PREDICTION_CONFIG.thresholds.warning) {
            valueDisplay.style.color = PREDICTION_CONFIG.gaugeColors.warning;
        } else if (probability >= PREDICTION_CONFIG.thresholds.caution) {
            valueDisplay.style.color = PREDICTION_CONFIG.gaugeColors.caution;
        } else {
            valueDisplay.style.color = PREDICTION_CONFIG.gaugeColors.normal;
        }
    }
}

// Update prediction trend chart
function updatePredictionTrend(probability) {
    if (!predictionTrendChart) return;
    
    // Add timestamp
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Add to history array
    predictionHistory.push({
        time: now,
        value: probability
    });
    
    // Limit history length
    if (predictionHistory.length > PREDICTION_CONFIG.maxHistoryPoints) {
        predictionHistory.shift();
    }
    
    // Update chart
    predictionTrendChart.data.labels = predictionHistory.map(item => 
        item.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    );
    predictionTrendChart.data.datasets[0].data = predictionHistory.map(item => item.value);
    
    // Update color based on current probability
    if (probability >= PREDICTION_CONFIG.thresholds.critical) {
        predictionTrendChart.data.datasets[0].borderColor = PREDICTION_CONFIG.gaugeColors.critical;
        predictionTrendChart.data.datasets[0].backgroundColor = 'rgba(244, 67, 54, 0.1)';
    } else if (probability >= PREDICTION_CONFIG.thresholds.warning) {
        predictionTrendChart.data.datasets[0].borderColor = PREDICTION_CONFIG.gaugeColors.warning;
        predictionTrendChart.data.datasets[0].backgroundColor = 'rgba(255, 152, 0, 0.1)';
    } else if (probability >= PREDICTION_CONFIG.thresholds.caution) {
        predictionTrendChart.data.datasets[0].borderColor = PREDICTION_CONFIG.gaugeColors.caution;
        predictionTrendChart.data.datasets[0].backgroundColor = 'rgba(255, 193, 7, 0.1)';
    } else {
        predictionTrendChart.data.datasets[0].borderColor = PREDICTION_CONFIG.gaugeColors.normal;
        predictionTrendChart.data.datasets[0].backgroundColor = 'rgba(76, 175, 80, 0.1)';
    }
    
    predictionTrendChart.update();
}

// Update warning status display
function updateWarningStatus(warningLevel, message) {
    const statusContainer = document.getElementById('prediction-status');
    const messageContainer = document.getElementById('prediction-message');
    
    if (statusContainer) {
        // Remove all status classes
        statusContainer.classList.remove('status-normal', 'status-caution', 'status-warning', 'status-critical');
        
        // Add appropriate status class
        statusContainer.classList.add(`status-${warningLevel}`);
        
        // Update text content
        const statusText = warningLevel.charAt(0).toUpperCase() + warningLevel.slice(1);
        statusContainer.textContent = statusText;
    }
    
    if (messageContainer && message) {
        messageContainer.textContent = message;
        
        // Animate message update with fade effect
        messageContainer.classList.add('fade-in');
        setTimeout(() => {
            messageContainer.classList.remove('fade-in');
        }, 500);
    }
    
    // Show alert for critical warnings
    if (warningLevel === 'critical') {
        showPredictionAlert(message || 'Critical failure risk detected!');
    }
}

// Show prediction error message
function showPredictionError(errorMessage) {
    console.error(`Prediction error: ${errorMessage}`);
    
    const errorContainer = document.getElementById('prediction-error');
    if (errorContainer) {
        errorContainer.textContent = `Error: ${errorMessage}`;
        errorContainer.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    }
}

// Show prediction alert
function showPredictionAlert(message) {
    const alertPanel = document.getElementById('alertPanel');
    const alertTitle = document.getElementById('alertTitle');
    const alertDescription = document.getElementById('alertDescription');
    
    if (alertPanel && alertTitle && alertDescription) {
        alertTitle.textContent = 'Failure Prediction Alert';
        alertDescription.textContent = message;
        
        // Show with animation
        alertPanel.style.display = 'flex';
        alertPanel.classList.add('alert-shown');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            alertPanel.classList.remove('alert-shown');
        }, 500);
    }
}

// Initialize Server-Sent Events for real-time updates
function initializeSSE() {
    if (!window.EventSource) {
        console.log('SSE not supported by browser');
        return;
    }
    
    const eventSource = new EventSource('/api/stream_data');
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Extract prediction data
            const prediction = {
                probability: data.failure_probability,
                warning_level: data.warning_level,
                message: data.warning_message
            };
            
            // Update visualization
            updatePredictionGauge(prediction.probability);
            updatePredictionTrend(prediction.probability);
            updateWarningStatus(prediction.warning_level, prediction.message);
            
        } catch (error) {
            console.error('Error processing SSE data:', error);
        }
    };
    
    eventSource.onerror = function() {
        console.error('SSE connection error');
        
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            eventSource.close();
            initializeSSE();
        }, 5000);
    };
}

// Set up event listeners
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-prediction');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            this.classList.add('spinning');
            fetchPredictionData().finally(() => {
                setTimeout(() => this.classList.remove('spinning'), 1000);
            });
        });
    }
    
    // Acknowledge button for alerts
    const acknowledgeBtn = document.getElementById('acknowledgeButton');
    if (acknowledgeBtn) {
        acknowledgeBtn.addEventListener('click', function() {
            const alertPanel = document.getElementById('alertPanel');
            if (alertPanel) {
                // Add hiding animation
                alertPanel.classList.add('alert-hiding');
                
                // Hide after animation completes
                setTimeout(() => {
                    alertPanel.style.display = 'none';
                    alertPanel.classList.remove('alert-hiding');
                }, 500);
            }
        });
    }
}

// ThingSpeak Configuration
const CHANNEL_ID = "2869932";
const READ_API_KEY = "F3PQYXN46UYN3MKK";
const BASE_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}`;

// Field mapping
const FIELD_MAPPING = {
  "force": 1,
  "torque": 2,
  "altitude": 3,
  "wind_speed": 4,
  "tilt_angle": 5,
  "temperature": 6,
  "vibrations": 7,
  "humidity": 8
};

// Field units mapping for proper display
const FIELD_UNITS = {
  "force": "kN",
  "torque": "Nm",
  "altitude": "m",
  "wind_speed": "m/s",
  "tilt_angle": "°",
  "temperature": "°C",
  "vibrations": "Hz",
  "humidity": "%"
};

// Thresholds for status indicators
const THRESHOLDS = {
  force: { warning: 350, critical: 400 },
  torque: { warning: 700, critical: 900 },
  wind_speed: { warning: 15, critical: 20 },
  tilt_angle: { warning: 3, critical: 5 },
  vibrations: { warning: 60, critical: 80 },
  temperature: { warning: 75, critical: 85 }
};

// Global chart references
const charts = {
  force: null,
  torque: null,
  tilt: null,
  vibration: null,
  prediction: null,
  historical: null,
  accuracy: null
};

// Current parameter and time range
let currentParam = 'force';
let currentTimeRange = 7;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  initializeCharts();
  setupEventListeners();
  loadInitialData();
  initSSEHandlers();
  
  // Fetch model accuracy on load and every 5 minutes
  fetchModelAccuracy();
  setInterval(fetchModelAccuracy, 300000);
  
  // Set up periodic data refresh
  setInterval(fetchRealTimeData, 30000);
});

// Chart initialization
function initializeCharts() {
  // Force Gauge
  charts.force = new Chart(document.getElementById('forceGauge'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#4CAF50', '#F5F5F5'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '85%',
      rotation: -90,
      circumference: 180,
      plugins: { legend: { display: false } },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });

  // Prediction Gauge
  charts.prediction = new Chart(document.getElementById('predictionGauge'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ['#FF5722', '#F5F5F5'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '85%',
      rotation: -90,
      circumference: 180,
      plugins: { legend: { display: false } },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });

  // Historical Data Chart
  charts.historical = new Chart(document.getElementById('historicalChart'), {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      scales: {
        x: { type: 'time', time: { unit: 'hour' } },
        y: { beginAtZero: true }
      },
      animation: {
        duration: 800
      }
    }
  });
}

// Event listeners
function setupEventListeners() {
  // Parameter selection
  document.querySelectorAll('.param-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.param-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const param = btn.dataset.param;
      currentParam = param;
      updateThingSpeakEmbed(param, currentTimeRange);
      updateHistoricalChart(param, currentTimeRange);
    });
  });

  // Time range selection
  const timeRangeSelect = document.getElementById('timeRange');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', (e) => {
      currentTimeRange = parseInt(e.target.value);
      updateThingSpeakEmbed(currentParam, currentTimeRange);
      updateHistoricalChart(currentParam, currentTimeRange);
    });
  }
  
  // Refresh button
  const refreshBtn = document.getElementById('refresh-button');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning');
      fetchRealTimeData().finally(() => {
        setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
      });
    });
  }
  
  // Acknowledge alert button
  const acknowledgeBtn = document.getElementById('acknowledgeButton');
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', () => {
      const alertPanel = document.getElementById('alertPanel');
      if (alertPanel) {
        // Fade out with animation
        alertPanel.classList.add('alert-hidden');
        setTimeout(() => {
          alertPanel.style.display = 'none';
          alertPanel.classList.remove('alert-hidden');
        }, 500);
      }
    });
  }
}

// SSE handlers
function initSSEHandlers() {
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateUI(data);
    } catch (error) {
      console.error('SSE data parsing error:', error);
      showErrorMessage('Error processing real-time data');
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    showErrorMessage('Real-time connection lost. Reconnecting...');
    setTimeout(() => {
      const newEventSource = new EventSource('/api/stream_data');
      eventSource.close();
      eventSource = newEventSource;
      initSSEHandlers();
    }, 5000);
  };
}

// Load initial data
async function loadInitialData() {
  showLoading(true);
  
  try {
    // Fetch real-time data using the new endpoint
    const dataRes = await fetch('/api/data');
    if (!dataRes.ok) throw new Error(`API returned status ${dataRes.status}`);
    
    const data = await dataRes.json();
    if (!data.success) throw new Error(data.error || 'Failed to load data');
    
    // Update UI with initial data
    updateUI(data);
    
    // Load prediction history
    const historyRes = await fetch('/api/prediction_history');
    if (historyRes.ok) {
      const historyData = await historyRes.json();
      if (historyData.success && historyData.history) {
        initializePredictionHistory(historyData.history);
      }
    }
    
    // Load initial ThingSpeak embed
    updateThingSpeakEmbed(currentParam, currentTimeRange);
  } catch (error) {
    console.error('Initial data load failed:', error);
    showErrorMessage('Failed to load initial data');
  } finally {
    showLoading(false);
  }
}

// Fetch real-time data from API
async function fetchRealTimeData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch data');
    
    updateUI(data);
    
    // Update last updated time
    const lastUpdatedElement = document.getElementById('lastUpdatedTime');
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = new Date().toLocaleTimeString();
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch real-time data:', error);
    showErrorMessage('Failed to update sensor data');
    return null;
  }
}

// Fetch model accuracy from new endpoint
async function fetchModelAccuracy() {
  try {
    const response = await fetch('/api/accuracy');
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch accuracy data');
    
    updateModelAccuracy(data);
    return data;
  } catch (error) {
    console.error('Failed to fetch model accuracy:', error);
    showErrorMessage('Failed to update model accuracy');
    return null;
  }
}

// Update UI with new data
function updateUI(data) {
  // Extract data based on different possible API formats
  const sensors = data.sensors || data.data || {};
  const prediction = {
    probability: data.failure_probability || (data.prediction ? data.prediction.failure_probability : 0),
    warning_level: data.warning_level || (data.prediction ? data.prediction.warning_level : 'normal'),
    message: data.warning_message || (data.prediction ? data.prediction.message : '')
  };
  
  // Update all UI components with smooth transitions
  updateSensorDisplays(sensors);
  updatePredictionDisplay(prediction);
  updateStatusIndicators(sensors, prediction.warning_level);
  updateCharts(sensors, prediction);
  checkForAlerts(sensors, prediction);
}

// Update sensor displays with fade transition
function updateSensorDisplays(data) {
  Object.entries(FIELD_MAPPING).forEach(([field, _]) => {
    const element = document.getElementById(`${field}Value`);
    if (element) {
      const value = parseFloat(data[field] || 0).toFixed(1);
      const unit = FIELD_UNITS[field] || '';
      
      // Apply fade transition
      element.classList.add('updating');
      setTimeout(() => {
        element.textContent = `${value}${unit}`;
        element.classList.remove('updating');
      }, 200);
    }
  });
}

// Update prediction display
function updatePredictionDisplay(prediction) {
  const prob = (prediction.probability || 0) * 100;
  
  // Update gauge chart with animation
  if (charts.prediction) {
    charts.prediction.data.datasets[0].data = [prob, 100 - prob];
    
    // Update color based on probability
    if (prob > 70) {
      charts.prediction.data.datasets[0].backgroundColor[0] = '#F44336'; // Red
    } else if (prob > 50) {
      charts.prediction.data.datasets[0].backgroundColor[0] = '#FF9800'; // Orange
    } else if (prob > 30) {
      charts.prediction.data.datasets[0].backgroundColor[0] = '#FFC107'; // Yellow
    } else {
      charts.prediction.data.datasets[0].backgroundColor[0] = '#4CAF50'; // Green
    }
    
    charts.prediction.update();
  }
  
  // Update text value with transition
  const valueElement = document.getElementById('predictionValue');
  if (valueElement) {
    valueElement.classList.add('updating');
    setTimeout(() => {
      valueElement.textContent = `${prob.toFixed(1)}%`;
      valueElement.classList.remove('updating');
    }, 200);
  }
  
  // Update warning message
  const messageElement = document.getElementById('warningMessage');
  if (messageElement && prediction.message) {
    messageElement.classList.add('updating');
    setTimeout(() => {
      messageElement.textContent = prediction.message;
      messageElement.classList.remove('updating');
    }, 200);
  }
}

// Update model accuracy display
function updateModelAccuracy(data) {
  // Get accuracy value from data
  const accuracy = data.raw_accuracy || parseFloat(data.accuracy) / 100;
  const accuracyPercent = accuracy * 100;
  
  // Update accuracy display if it exists
  const accuracyElement = document.getElementById('modelAccuracy');
  if (accuracyElement) {
    accuracyElement.classList.add('updating');
    setTimeout(() => {
      accuracyElement.textContent = `${accuracyPercent.toFixed(1)}%`;
      accuracyElement.classList.remove('updating');
    }, 200);
  }
  
  // Update accuracy chart if it exists
  if (charts.accuracy) {
    charts.accuracy.data.datasets[0].data = [accuracyPercent, 100 - accuracyPercent];
    charts.accuracy.update();
  }
  
  // Update last validated date
  const updatedElement = document.getElementById('accuracyUpdated');
  if (updatedElement && data.last_updated) {
    const date = new Date(data.last_updated);
    updatedElement.textContent = `Last validated: ${date.toLocaleDateString()}`;
  }
}

// Update status indicators
function updateStatusIndicators(sensors, warningLevel) {
  // Update system status indicator
  const systemStatusElement = document.getElementById('systemStatus');
  if (systemStatusElement) {
    // Remove all status classes
    systemStatusElement.classList.remove('status-normal', 'status-caution', 'status-warning', 'status-critical');
    // Add new class
    systemStatusElement.classList.add(`status-${warningLevel || 'normal'}`);
  }
  
  // Update status text if it exists
  const systemStatusTextElement = document.getElementById('systemStatusText');
  if (systemStatusTextElement) {
    const statusMap = {
      normal: 'Normal',
      caution: 'Caution',
      warning: 'Warning',
      critical: 'Critical'
    };
    systemStatusTextElement.textContent = statusMap[warningLevel] || 'Normal';
  }
  
  // Update individual sensor status indicators
  Object.entries(FIELD_MAPPING).forEach(([field, _]) => {
    const statusDot = document.getElementById(`${field}Status`);
    const statusText = document.getElementById(`${field}StatusText`);
    
    if (statusDot && THRESHOLDS[field]) {
      const value = parseFloat(sensors[field] || 0);
      const threshold = THRESHOLDS[field];
      
      // Remove existing classes
      statusDot.classList.remove('status-normal', 'status-warning', 'status-danger');
      
      // Add appropriate class
      if (value >= threshold.critical) {
        statusDot.classList.add('status-danger');
        if (statusText) statusText.textContent = 'Critical';
      } else if (value >= threshold.warning) {
        statusDot.classList.add('status-warning');
        if (statusText) statusText.textContent = 'Warning';
      } else {
        statusDot.classList.add('status-normal');
        if (statusText) statusText.textContent = 'Normal';
      }
    }
  });
}

// Update charts
function updateCharts(sensors, prediction) {
  // Update force gauge
  if (charts.force && sensors.force) {
    const force = parseFloat(sensors.force);
    const forcePercent = Math.min((force / 500) * 100, 100);
    
    charts.force.data.datasets[0].data = [forcePercent, 100 - forcePercent];
    
    // Update color based on value
    if (force >= THRESHOLDS.force.critical) {
      charts.force.data.datasets[0].backgroundColor[0] = '#F44336';
    } else if (force >= THRESHOLDS.force.warning) {
      charts.force.data.datasets[0].backgroundColor[0] = '#FF9800';
    } else {
      charts.force.data.datasets[0].backgroundColor[0] = '#4CAF50';
    }
    
    charts.force.update();
  }
  
  // Update historical chart with prediction data
  if (charts.historical && prediction.probability !== undefined) {
    const timestamp = new Date();
    const probValue = prediction.probability * 100;
    
    // Add new data point
    if (charts.historical.data.datasets.length === 0) {
      charts.historical.data.datasets.push({
        label: 'Failure Probability (%)',
        data: [{ x: timestamp, y: probValue }],
        borderColor: '#FF5722',
        backgroundColor: 'rgba(255, 87, 34, 0.1)',
        fill: true
      });
    } else {
      // Add new point and limit to 100 points
      const dataset = charts.historical.data.datasets[0];
      dataset.data.push({ x: timestamp, y: probValue });
      if (dataset.data.length > 100) {
        dataset.data.shift();
      }
    }
    
    charts.historical.update();
  }
}

// Check for alerts and show if necessary
function checkForAlerts(sensors, prediction) {
  const alertPanel = document.getElementById('alertPanel');
  if (!alertPanel) return;
  
  const alertTitle = document.getElementById('alertTitle');
  const alertDesc = document.getElementById('alertDescription');
  
  // Default: hide alert
  alertPanel.style.display = 'none';
  
  // Check prediction warning level
  if (prediction.warning_level === 'critical') {
    if (alertTitle) alertTitle.textContent = 'Critical Alert: Failure Risk Detected';
    if (alertDesc) alertDesc.textContent = prediction.message || 'ML model predicts high failure probability';
    alertPanel.style.display = 'flex';
    return;
  }
  
  // Check sensor thresholds
  const criticalSensors = [
    { name: 'force', title: 'Load Limit Exceeded', message: 'Current load exceeds safe operating limits' },
    { name: 'vibrations', title: 'Excessive Vibration', message: 'Abnormal vibration detected. Check bearings and structural integrity' },
    { name: 'wind_speed', title: 'High Wind Speed', message: 'Wind speed exceeds safe operating conditions' },
    { name: 'tilt_angle', title: 'Excessive Tilt Angle', message: 'Crane tilt exceeds safe parameters. Check ground conditions' }
  ];
  
  for (const sensor of criticalSensors) {
    if (parseFloat(sensors[sensor.name] || 0) >= THRESHOLDS[sensor.name]?.critical) {
      if (alertTitle) alertTitle.textContent = `Critical Alert: ${sensor.title}`;
      if (alertDesc) alertDesc.textContent = sensor.message;
      alertPanel.style.display = 'flex';
      return;
    }
  }
}

// Initialize prediction history
function initializePredictionHistory(history) {
  if (!charts.historical || !history.length) return;
  
  const data = history.map(item => ({
    x: new Date(item.timestamp),
    y: item.probability * 100
  }));
  
  charts.historical.data.datasets = [{
    label: 'Failure Probability (%)',
    data: data,
    borderColor: '#FF5722',
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    fill: true
  }];
  
  charts.historical.update();
}

// ThingSpeak embed management
async function updateThingSpeakEmbed(param, days = 7) {
  try {
    // Get the container (either specific to parameter or general)
    const container = document.getElementById(`${param}Thingspeak`) || 
                     document.getElementById('thingspeakContainer');
    if (!container) return;
    
    // Show loading indicator
    container.innerHTML = '<div class="loading">Loading ThingSpeak data...</div>';
    
    // Fetch embed URL
    const response = await fetch(`/api/thingspeak/embed/${param}?days=${days}`);
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to load ThingSpeak embed');
    
    // Create iframe with fade-in effect
    const iframe = document.createElement('iframe');
    iframe.src = data.dynamic_chart_url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.5s ease';
    
    // Add load event to fade in
    iframe.onload = () => {
      iframe.style.opacity = '1';
    };
    
    // Replace content
    container.innerHTML = '';
    container.appendChild(iframe);
  } catch (error) {
    console.error('Failed to load ThingSpeak embed:', error);
    const container = document.getElementById(`${param}Thingspeak`) || 
                    document.getElementById('thingspeakContainer');
    if (container) {
      container.innerHTML = `<div class="error">Failed to load chart: ${error.message}</div>`;
    }
  }
}

// Historical chart updates
async function updateHistoricalChart(param, days = 7) {
  try {
    const response = await fetch(`/api/historical_data/${param}?days=${days}`);
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to load historical data');
    
    if (charts.historical) {
      charts.historical.data.datasets = [{
        label: `${param.charAt(0).toUpperCase() + param.slice(1).replace('_', ' ')} (${FIELD_UNITS[param] || ''})`,
        data: data.values.map((val, idx) => ({
          x: new Date(data.timestamps[idx]),
          y: val
        })),
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        fill: true
      }];
      
      charts.historical.update();
    }
  } catch (error) {
    console.error('Historical data update failed:', error);
    showErrorMessage(`Failed to load ${param} history: ${error.message}`);
  }
}

// Show error message with animation
function showErrorMessage(message) {
  // Create error toast container if it doesn't exist
  let errorToast = document.getElementById('errorToast');
  if (!errorToast) {
    errorToast = document.createElement('div');
    errorToast.id = 'errorToast';
    errorToast.className = 'error-toast';
    document.body.appendChild(errorToast);
  }
  
  // Create message element
  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-message';
  errorMsg.innerHTML = `
    <span>${message}</span>
    <button class="error-close">&times;</button>
  `;
  
  // Add close handler
  errorMsg.querySelector('.error-close').addEventListener('click', () => {
    errorMsg.classList.add('fade-out');
    setTimeout(() => errorMsg.remove(), 300);
  });
  
  // Add to container with animation
  errorToast.appendChild(errorMsg);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    errorMsg.classList.add('fade-out');
    setTimeout(() => errorMsg.remove(), 300);
  }, 5000);
}

// Show/hide loading indicator
function showLoading(show) {
  let loader = document.getElementById('globalLoader');
  
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.className = 'global-loader';
    loader.innerHTML = '<div class="loader-spinner"></div><div>Loading data...</div>';
    document.body.appendChild(loader);
  }
  
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

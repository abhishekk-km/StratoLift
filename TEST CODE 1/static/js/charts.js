// Futuristic color palette
const COLORS = {
    primary: '#3a7bd5',
    secondary: '#00d2ff',
    accent: '#6a11cb',
    success: '#4CAF50',
    warning: '#FFC107',
    danger: '#F44336',
    chartColors: [
        'rgba(58, 123, 213, 0.8)',
        'rgba(0, 210, 255, 0.8)',
        'rgba(106, 17, 203, 0.8)',
        'rgba(255, 64, 129, 0.8)',
        'rgba(0, 230, 118, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(244, 67, 54, 0.8)'
    ],
    chartBackgrounds: [
        'rgba(58, 123, 213, 0.2)',
        'rgba(0, 210, 255, 0.2)',
        'rgba(106, 17, 203, 0.2)',
        'rgba(255, 64, 129, 0.2)',
        'rgba(0, 230, 118, 0.2)',
        'rgba(255, 193, 7, 0.2)',
        'rgba(244, 67, 54, 0.2)'
    ]
};

// Parameter configuration with units and display settings
const PARAMETERS = {
    force: { 
        label: 'Load Force', 
        unit: 'kN', 
        color: COLORS.chartColors[0],
        background: COLORS.chartBackgrounds[0],
        max: 500,
        min: 0,
        threshold: { warning: 350, critical: 400 }
    },
    torque: { 
        label: 'Torque', 
        unit: 'Nm', 
        color: COLORS.chartColors[1], 
        background: COLORS.chartBackgrounds[1],
        max: 1000,
        min: 0,
        threshold: { warning: 700, critical: 900 }
    },
    altitude: { 
        label: 'Altitude', 
        unit: 'm', 
        color: COLORS.chartColors[2], 
        background: COLORS.chartBackgrounds[2],
        max: 200,
        min: 0
    },
    wind_speed: { 
        label: 'Wind Speed', 
        unit: 'm/s', 
        color: COLORS.chartColors[3], 
        background: COLORS.chartBackgrounds[3],
        max: 30,
        min: 0,
        threshold: { warning: 15, critical: 20 }
    },
    tilt_angle: { 
        label: 'Tilt Angle', 
        unit: '°', 
        color: COLORS.chartColors[4], 
        background: COLORS.chartBackgrounds[4],
        max: 10,
        min: 0,
        threshold: { warning: 3, critical: 5 }
    },
    temperature: { 
        label: 'Temperature', 
        unit: '°C', 
        color: COLORS.chartColors[5], 
        background: COLORS.chartBackgrounds[5],
        max: 100,
        min: 0,
        threshold: { warning: 75, critical: 85 }
    },
    vibrations: { 
        label: 'Vibrations', 
        unit: 'Hz', 
        color: COLORS.chartColors[6], 
        background: COLORS.chartBackgrounds[6],
        max: 100,
        min: 0,
        threshold: { warning: 60, critical: 80 }
    },
    humidity: { 
        label: 'Humidity', 
        unit: '%', 
        color: COLORS.chartColors[0], 
        background: COLORS.chartBackgrounds[0],
        max: 100,
        min: 0
    }
};

// Store chart instances and data history
const charts = {};
const chartData = {};

// Initialize parameter data history
Object.keys(PARAMETERS).forEach(param => {
    chartData[param] = {
        timestamps: [],
        values: [],
        maxPoints: 50 // Store up to 50 data points
    };
});

// Register custom gauge chart type (keep your existing code)
Chart.register({
    id: 'gauge',
    beforeInit: function(chart) {
        chart.legend.options.display = false;
    },
    // ... rest of your gauge chart code
});

// Initialize all parameter charts
function initializeCharts() {
    // Create line charts for each parameter
    Object.keys(PARAMETERS).forEach(param => {
        const paramConfig = PARAMETERS[param];
        const chartElement = document.getElementById(`${param}Chart`);
        
        if (!chartElement) {
            console.warn(`Chart element for ${param} not found`);
            return;
        }
        
        charts[param] = createLineChart(chartElement, paramConfig);
    });
    
    // Initial data fetch
    fetchParameterData();
    
    // Set up automatic data refresh every 10 seconds
    setInterval(fetchParameterData, 10000);
}

// Create a line chart with appropriate configuration
function createLineChart(canvas, paramConfig) {
    const ctx = canvas.getContext('2d');
    
    // Create gradient for the line
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, paramConfig.color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: `${paramConfig.label} (${paramConfig.unit})`,
                data: [],
                borderColor: paramConfig.color,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#fff',
                pointHoverBackgroundColor: paramConfig.color,
                pointBorderWidth: 2,
                pointHoverBorderWidth: 2,
                pointBorderColor: paramConfig.color,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Segoe UI', Arial, sans-serif",
                            size: 12
                        },
                        color: '#f5f5f7',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 30, 47, 0.9)',
                    titleFont: {
                        weight: 'bold',
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    borderColor: paramConfig.color,
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return `${value.toFixed(1)} ${paramConfig.unit}`;
                        },
                        labelPointStyle: function() {
                            return {
                                pointStyle: 'rectRounded',
                                rotation: 0
                            };
                        },
                        afterLabel: function(context) {
                            // Add threshold information if available
                            if (paramConfig.threshold) {
                                const value = context.parsed.y;
                                if (value >= paramConfig.threshold.critical) {
                                    return `Critical threshold: ${paramConfig.threshold.critical} ${paramConfig.unit}`;
                                } else if (value >= paramConfig.threshold.warning) {
                                    return `Warning threshold: ${paramConfig.threshold.warning} ${paramConfig.unit}`;
                                }
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        tickLength: 0
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 10
                        },
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    suggestedMin: paramConfig.min,
                    suggestedMax: paramConfig.max,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return `${value} ${paramConfig.unit}`;
                        }
                    }
                }
            }
        }
    });
}

// Fetch data from the API endpoint
async function fetchParameterData() {
    try {
        // Display loading indicator (if needed)
        showLoadingIndicator(true);
        
        // Fetch data from the API
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to load data');
        
        // Hide loading indicator
        showLoadingIndicator(false);
        
        // Update charts with new data
        updateChartsWithData(data);
        
        // Update last updated timestamp
        updateLastUpdatedTime();
        
        return data;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        showLoadingIndicator(false);
        showErrorMessage('Failed to update sensor data');
        return null;
    }
}

// Update charts with new data
function updateChartsWithData(data) {
    // Extract data (handling different API response formats)
    const sensors = data.sensors || data.data || {};
    const timestamp = new Date(data.timestamp || data.last_updated || new Date());
    const formattedTime = timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Update each chart
    Object.keys(PARAMETERS).forEach(param => {
        if (!charts[param]) return;
        
        // Get the value for this parameter
        const value = parseFloat(sensors[param] || 0);
        
        // Add to data history
        addDataPoint(param, formattedTime, value);
        
        // Update chart with new data
        updateChart(param);
        
        // Update parameter value displays if they exist
        updateParameterValueDisplay(param, value);
        
        // Update status indicators based on thresholds
        updateStatusIndicator(param, value);
    });
    
    // Check for alerts based on new data
    checkForAlerts(sensors);
}

// Add a data point to the history
function addDataPoint(param, timestamp, value) {
    const data = chartData[param];
    
    // Add new data point
    data.timestamps.push(timestamp);
    data.values.push(value);
    
    // Limit the number of points
    if (data.timestamps.length > data.maxPoints) {
        data.timestamps.shift();
        data.values.shift();
    }
}

// Update a chart with its current data
function updateChart(param) {
    const chart = charts[param];
    const data = chartData[param];
    
    // Update chart data
    chart.data.labels = data.timestamps;
    chart.data.datasets[0].data = data.values;
    
    // Color changes based on threshold if applicable
    if (PARAMETERS[param].threshold) {
        const latestValue = data.values[data.values.length - 1];
        const threshold = PARAMETERS[param].threshold;
        
        // Change line color based on current value
        if (latestValue >= threshold.critical) {
            chart.data.datasets[0].borderColor = COLORS.danger;
        } else if (latestValue >= threshold.warning) {
            chart.data.datasets[0].borderColor = COLORS.warning;
        } else {
            chart.data.datasets[0].borderColor = PARAMETERS[param].color;
        }
    }
    
    // Update the chart with animation
    chart.update();
}

// Update parameter value displays if they exist
function updateParameterValueDisplay(param, value) {
    const valueElement = document.getElementById(`${param}Value`);
    if (valueElement) {
        // Add fade transition
        valueElement.classList.add('updating');
        setTimeout(() => {
            valueElement.textContent = `${value.toFixed(1)} ${PARAMETERS[param].unit}`;
            valueElement.classList.remove('updating');
        }, 200);
    }
}

// Update status indicators based on thresholds
function updateStatusIndicator(param, value) {
    const statusDot = document.getElementById(`${param}Status`);
    const statusText = document.getElementById(`${param}StatusText`);
    
    if (!statusDot || !PARAMETERS[param].threshold) return;
    
    const threshold = PARAMETERS[param].threshold;
    
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

// Check for alerts based on sensor values
function checkForAlerts(sensors) {
    const alertPanel = document.getElementById('alertPanel');
    if (!alertPanel) return;
    
    const alertTitle = document.getElementById('alertTitle');
    const alertDesc = document.getElementById('alertDescription');
    
    // Default: hide alert
    alertPanel.style.display = 'none';
    
    // Check each parameter with thresholds
    for (const [param, config] of Object.entries(PARAMETERS)) {
        if (!config.threshold) continue;
        
        const value = parseFloat(sensors[param] || 0);
        if (value >= config.threshold.critical) {
            if (alertTitle) alertTitle.textContent = `Critical Alert: ${config.label}`;
            if (alertDesc) alertDesc.textContent = `${config.label} value has exceeded critical threshold: ${value.toFixed(1)} ${config.unit}`;
            alertPanel.style.display = 'flex';
            return;
        }
    }
}

// Show loading indicator
function showLoadingIndicator(show) {
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        if (show) {
            refreshButton.classList.add('spinning');
        } else {
            setTimeout(() => refreshButton.classList.remove('spinning'), 500);
        }
    }
}

// Show error message
function showErrorMessage(message) {
    // Create error toast if it doesn't exist
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
    errorMsg.innerHTML = `<span>${message}</span><button class="error-close">&times;</button>`;
    
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

// Update last updated time
function updateLastUpdatedTime() {
    const element = document.getElementById('lastUpdatedTime');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

// Initialize Server-Sent Events for real-time updates
function initSSE() {
    const eventSource = new EventSource('/api/stream_data');
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            updateChartsWithData(data);
            updateLastUpdatedTime();
        } catch (error) {
            console.error('Error processing SSE data:', error);
        }
    };
    
    eventSource.onerror = function() {
        console.error('SSE connection error');
        showErrorMessage('Real-time connection lost. Reconnecting...');
        
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            eventSource.close();
            initSSE();
        }, 5000);
    };
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    initializeCharts();
    
    // Set up SSE for real-time updates
    initSSE();
    
    // Set up event listeners for UI controls
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-button');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            fetchParameterData().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
            });
        });
    }
    
    // Time range select (if exists)
    const timeRangeSelect = document.getElementById('time-range-select');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            // Update max points for all charts
            const days = parseInt(this.value);
            const pointsPerDay = 24 * 6; // Approximate 6 readings per hour
            const maxPoints = Math.min(days * pointsPerDay, 200); // Cap at 200 points
            
            Object.keys(chartData).forEach(param => {
                chartData[param].maxPoints = maxPoints;
            });
            
            // Reload historical data
            fetchHistoricalData(days);
        });
    }
    
    // Acknowledge alert button
    const acknowledgeBtn = document.getElementById('acknowledgeButton');
    if (acknowledgeBtn) {
        acknowledgeBtn.addEventListener('click', function() {
            const alertPanel = document.getElementById('alertPanel');
            if (alertPanel) {
                alertPanel.style.display = 'none';
            }
        });
    }
}

// Fetch historical data for all parameters
async function fetchHistoricalData(days = 1) {
    showLoadingIndicator(true);
    
    try {
        // Fetch historical data for each parameter in parallel
        const promises = Object.keys(PARAMETERS).map(param => 
            fetch(`/api/historical_data/${param}?days=${days}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.timestamps && data.values) {
                        // Process historical data
                        processHistoricalData(param, data);
                    }
                    return data;
                })
                .catch(error => {
                    console.error(`Error fetching historical data for ${param}:`, error);
                    return null;
                })
        );
        
        await Promise.all(promises);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        showErrorMessage('Failed to load historical data');
    } finally {
        showLoadingIndicator(false);
    }
}

// Process historical data for a parameter
function processHistoricalData(param, data) {
    // Clear existing data
    chartData[param].timestamps = [];
    chartData[param].values = [];
    
    // Process timestamps and values
    data.timestamps.forEach((timestamp, index) => {
        const value = data.values[index];
        if (value !== null && value !== undefined) {
            const date = new Date(timestamp);
            const formattedTime = date.toLocaleString([], {
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit'
            });
            
            chartData[param].timestamps.push(formattedTime);
            chartData[param].values.push(parseFloat(value));
        }
    });
    
    // Update chart
    updateChart(param);
}

// Global variables
let liveData = {};
let historicalData = [];
let charts = {};

// Initialize the dashboard
function initDashboard() {
    updateCraneSelector();
    setupEventListeners();
    initCharts();
    fetchLiveData();
    setInterval(fetchLiveData, 5000); // Fetch data every 5 seconds
}

// Update crane selector options
function updateCraneSelector() {
    const craneSelect = document.getElementById('crane-select');
    craneSelect.innerHTML = '<option value="CRANE_1">Crane 1</option><option value="CRANE_2">Crane 2</option>';
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('crane-select').addEventListener('change', fetchLiveData);
    document.getElementById('refresh-btn').addEventListener('click', fetchLiveData);
    document.getElementById('auto-refresh').addEventListener('change', toggleAutoRefresh);
    document.querySelector('.sidebar-menu').addEventListener('click', handleNavigation);
    document.getElementById('prediction-form').addEventListener('submit', handlePrediction);
    document.getElementById('historical-range').addEventListener('change', fetchHistoricalData);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
}

// Initialize charts
function initCharts() {
    charts.loadTorque = new Chart(document.getElementById('load-torque-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Load', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
                { label: 'Torque', data: [], borderColor: 'rgb(54, 162, 235)', tension: 0.1 }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    charts.environmental = new Chart(document.getElementById('environmental-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Wind Speed', data: [], borderColor: 'rgb(255, 206, 86)', tension: 0.1 },
                { label: 'Temperature', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 },
                { label: 'Humidity', data: [], borderColor: 'rgb(153, 102, 255)', tension: 0.1 }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    charts.historical = new Chart(document.getElementById('historical-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Load', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
                { label: 'Wind Speed', data: [], borderColor: 'rgb(255, 206, 86)', tension: 0.1 }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    charts.loadDistribution = new Chart(document.getElementById('load-distribution-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['0-20', '21-40', '41-60', '61-80', '81-100'],
            datasets: [{ label: 'Load Distribution', data: [], backgroundColor: 'rgba(75, 192, 192, 0.6)' }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    charts.failureTrend = new Chart(document.getElementById('failure-trend-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{ label: 'Failure Probability', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

// Fetch live data from the server
function fetchLiveData() {
    const craneId = document.getElementById('crane-select').value;
    fetch(`/api/live-data?crane_id=${craneId}`)
        .then(response => response.json())
        .then(data => {
            liveData = data;
            updateDashboard();
        })
        .catch(error => console.error('Error fetching live data:', error));
}

// Update dashboard with live data
function updateDashboard() {
    document.getElementById('last-update-time').textContent = new Date(liveData.timestamp).toLocaleString();
    document.getElementById('load-value').textContent = `${liveData.load.toFixed(2)} kN`;
    document.getElementById('wind-value').textContent = `${liveData.wind_speed.toFixed(2)} m/s`;
    document.getElementById('temp-value').textContent = `${liveData.temperature.toFixed(2)} °C`;
    document.getElementById('failure-value').textContent = `${(liveData.failure_probability * 100).toFixed(2)}%`;
    document.getElementById('torque-value').textContent = `${liveData.torque.toFixed(2)} Nm`;
    document.getElementById('altitude-value').textContent = `${liveData.altitude.toFixed(2)} m`;
    document.getElementById('humidity-value').textContent = `${liveData.humidity.toFixed(2)}%`;
    document.getElementById('vibrations-value').textContent = `${liveData.vibrations.toFixed(2)} Hz`;
    document.getElementById('hours-value').textContent = `${liveData.operational_hours.toFixed(2)} hrs`;

    updateCharts();
}

// Update charts with live data
function updateCharts() {
    const timestamp = new Date(liveData.timestamp).toLocaleTimeString();

    charts.loadTorque.data.labels.push(timestamp);
    charts.loadTorque.data.datasets[0].data.push(liveData.load);
    charts.loadTorque.data.datasets[1].data.push(liveData.torque);

    charts.environmental.data.labels.push(timestamp);
    charts.environmental.data.datasets[0].data.push(liveData.wind_speed);
    charts.environmental.data.datasets[1].data.push(liveData.temperature);
    charts.environmental.data.datasets[2].data.push(liveData.humidity);

    // Limit the number of data points shown
    const maxDataPoints = 20;
    if (charts.loadTorque.data.labels.length > maxDataPoints) {
        charts.loadTorque.data.labels.shift();
        charts.loadTorque.data.datasets.forEach(dataset => dataset.data.shift());
        charts.environmental.data.labels.shift();
        charts.environmental.data.datasets.forEach(dataset => dataset.data.shift());
    }

    charts.loadTorque.update();
    charts.environmental.update();
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const autoRefresh = document.getElementById('auto-refresh').checked;
    if (autoRefresh) {
        fetchLiveData();
        setInterval(fetchLiveData, 5000);
    } else {
        clearInterval(fetchLiveData);
    }
}

// Handle navigation between sections
function handleNavigation(event) {
    if (event.target.tagName === 'A') {
        event.preventDefault();
        const targetSection = event.target.getAttribute('href').substring(1);
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = section.id === targetSection ? 'block' : 'none';
        });
        document.querySelectorAll('.sidebar-menu li').forEach(item => {
            item.classList.remove('active');
        });
        event.target.parentElement.classList.add('active');
    }
}

// Handle prediction form submission
function handlePrediction(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const predictionData = Object.fromEntries(formData.entries());

    fetch('/api/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(predictionData),
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('prediction-value').textContent = `${(data.failure_probability * 100).toFixed(2)}%`;
        document.getElementById('prediction-recommendation').textContent = data.maintenance_recommendation;
        updatePredictionGauge(data.failure_probability);
    })
    .catch(error => console.error('Error making prediction:', error));
}

// Update prediction gauge
function updatePredictionGauge(failureProbability) {
    const canvas = document.getElementById('prediction-gauge');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gauge background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();

    // Draw gauge value
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + failureProbability * Math.PI);
    ctx.fillStyle = getColorForProbability(failureProbability);
    ctx.fill();

    // Draw gauge text
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${(failureProbability * 100).toFixed(2)}%`, centerX, centerY + 40);
}

// Get color for failure probability
function getColorForProbability(probability) {
    const hue = (1 - probability) * 120;
    return `hsl(${hue}, 100%, 50%)`;
}

// Fetch historical data
function fetchHistoricalData() {
    const craneId = document.getElementById('crane-select').value;
    const days = document.getElementById('historical-range').value;

    fetch(`/api/historical-data?crane_id=${craneId}&days=${days}`)
        .then(response => response.json())
        .then(data => {
            historicalData = data;
            updateHistoricalCharts();
        })
        .catch(error => console.error('Error fetching historical data:', error));
}

// Update historical charts
function updateHistoricalCharts() {
    const labels = historicalData.map(d => new Date(d.timestamp).toLocaleDateString());
    const loadData = historicalData.map(d => d.load);
    const windData = historicalData.map(d => d.wind_speed);

    charts.historical.data.labels = labels;
    charts.historical.data.datasets[0].data = loadData;
    charts.historical.data.datasets[1].data = windData;
    charts.historical.update();

    updateLoadDistribution();
    updateFailureTrend();
}

// Update load distribution chart
function updateLoadDistribution() {
    const loadRanges = [0, 20, 40, 60, 80, 100];
    const distribution = new Array(loadRanges.length - 1).fill(0);

    historicalData.forEach(d => {
        const load = d.load;
        for (let i = 0; i < loadRanges.length - 1; i++) {
            if (load >= loadRanges[i] && load < loadRanges[i + 1]) {
                distribution[i]++;
                break;
            }
        }
    });

    charts.loadDistribution.data.datasets[0].data = distribution;
    charts.loadDistribution.update();
}

// Update failure trend chart
function updateFailureTrend() {
    const labels = historicalData.map(d => new Date(d.timestamp).toLocaleDateString());
    const failureProbabilities = historicalData.map(d => d.failure_probability * 100);

    charts.failureTrend.data.labels = labels;
    charts.failureTrend.data.datasets[0].data = failureProbabilities;
    charts.failureTrend.update();
}

// Save settings
function saveSettings() {
    const settings = {
        darkMode: document.getElementById('dark-mode-toggle').checked,
        refreshInterval: document.getElementById('refresh-interval').value,
        showAlerts: document.getElementById('show-alerts').checked,
        emailNotifications: document.getElementById('email-notifications').checked,
        notificationEmail: document.getElementById('notification-email').value,
        alertThreshold: document.getElementById('alert-threshold').value
    };

    localStorage.setItem('craneMonitoringSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
}

// Reset settings to defaults
function resetSettings() {
    const defaultSettings = {
        darkMode: true,
        refreshInterval: 5,
        showAlerts: true,
        emailNotifications: true,
        notificationEmail: 'admin@example.com',
        alertThreshold: 70
    };

    localStorage.setItem('craneMonitoringSettings', JSON.stringify(defaultSettings));
    loadSettings();
    alert('Settings reset to defaults!');
}

// Load settings from local storage
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('craneMonitoringSettings')) || {};

    document.getElementById('dark-mode-toggle').checked = settings.darkMode ?? true;
    document.getElementById('refresh-interval').value = settings.refreshInterval ?? 5;
    document.getElementById('show-alerts').checked = settings.showAlerts ?? true;
    document.getElementById('email-notifications').checked = settings.emailNotifications ?? true;
    document.getElementById('notification-email').value = settings.notificationEmail ?? 'admin@example.com';
    document.getElementById('alert-threshold').value = settings.alertThreshold ?? 70;

    applyDarkMode(settings.darkMode);
}

// Apply dark mode
function applyDarkMode(isDarkMode) {
    document.body.classList.toggle('dark-mode', isDarkMode);
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    loadSettings();
});

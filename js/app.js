import { MapManager } from './map.js';
import { Game } from './game.js';

class App {
    constructor() {
        this.mapManager = new MapManager();
        this.game = new Game(this.mapManager);

        this.state = {
            lat: 0,
            lng: 0,
            speed: 0, // m/s
            timestamp: 0
        };

        this.watchId = null;
        this.isSimulating = false;

        // Simulation variables
        this.simLat = 40.7128;
        this.simLng = -74.0060;
        this.simSpeed = 0;
        this.keys = {}

        // Try to get a quick fix to center map (optional)
        this.preLocate();
        this.initUI();

        // Listen for map drag to show recenter button
        window.addEventListener('map-interaction', () => {
            document.getElementById('btn-recenter').classList.remove('hidden');
        });
    }

    preLocate() {
        if (!navigator.geolocation) return;
        // One-off low accuracy check just to center the map for UX
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.mapManager.updatePlayerPosition(pos.coords.latitude, pos.coords.longitude);
                document.getElementById('status-bar').innerText = "Location Found. Ready.";
            }, 
            (err) => console.log("Pre-location skipped", err),
            { enableHighAccuracy: false, timeout: 5000 }
        );
    }

    initUI() {
        // Recenter
        document.getElementById('btn-recenter').addEventListener('click', () => {
            this.mapManager.recenter();
            document.getElementById('btn-recenter').classList.add('hidden');
        });

        // Menu
        document.getElementById('btn-mode-gps').addEventListener('click', () => this.setMode('RECORDING'));
        document.getElementById('btn-mode-draw').addEventListener('click', () => this.setMode('DRAWING'));
        document.getElementById('btn-mode-sim').addEventListener('click', () => {
            this.isSimulating = true;
            this.setMode('RECORDING');
            this.startSimulation();
        });

        // Recording
        document.getElementById('btn-stop-record').addEventListener('click', () => this.setMode('READY'));

        // Drawing
        document.getElementById('btn-undo-draw').addEventListener('click', () => this.mapManager.resetPath());
        document.getElementById('btn-finish-draw').addEventListener('click', () => this.setMode('READY'));

        // Race
        document.getElementById('btn-start-race').addEventListener('click', () => this.setMode('RACING'));
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.game.stop();
            this.mapManager.resetPath();
            this.setMode('MENU');
        });
        
        // Start GPS initially for map context
        this.startGPS();
    }

    setMode(mode) {
        this.state.mode = mode;
        
        // Hide all panels
        document.querySelectorAll('.controls-panel').forEach(el => el.classList.add('hidden'));

        // Logic switch
        if (mode === 'MENU') {
            document.getElementById('main-menu').classList.remove('hidden');
            this.mapManager.disableDrawing();
        } 
        else if (mode === 'RECORDING') {
            document.getElementById('recording-controls').classList.remove('hidden');
            this.mapManager.resetPath();
        }
        else if (mode === 'DRAWING') {
            document.getElementById('drawing-controls').classList.remove('hidden');
            this.mapManager.resetPath();
            // Center map on last known pos
            if (this.state.lat) this.mapManager.map.setView([this.state.lat, this.state.lng], 16);
            
            this.mapManager.enableDrawing(() => {
                // Optional callback
            });
        }
        else if (mode === 'READY') {
            document.getElementById('race-controls').classList.remove('hidden');
            this.mapManager.disableDrawing();
        }
        else if (mode === 'RACING') {
            document.getElementById('status-bar').style.display = 'block';
            
            const trail = this.mapManager.getPath();
            this.game.start(trail);
        }
    }

    startGPS() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by this browser.");
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePosition(pos),
            (err) => this.handleError(err),
            options
        );
    }

    handlePosition(position) {
        // Update State
        this.state.lat = position.coords.latitude;
        this.state.lng = position.coords.longitude;
        // GPS speed can be null if stationary or depending on device. 
        // We use it directly if available, otherwise calculate delta? 
        // For this demo, trust device speed or default to 0.
        this.state.speed = position.coords.speed !== null ? position.coords.speed : 0;
        this.state.timestamp = position.timestamp;

        this.updateSystem();
    }

    handleError(err) {
        console.warn('GPS Error:', err.code, err.message);
        let msg = "GPS Signal Lost...";
        if (err.code === 1) msg = "Location Permission Denied";
        if (err.code === 2) msg = "Location Unavailable";
        if (err.code === 3) msg = "GPS Timeout - Searching...";
        
        document.getElementById('status-bar').innerText = msg;
    }

    updateSystem() {
        // Update Map
        this.mapManager.updatePlayerPosition(this.state.lat, this.state.lng);

        // Update UI
        const kmh = (this.state.speed * 3.6).toFixed(1);
        document.getElementById('speed-val').innerText = kmh;

        // Logic based on Mode
        if (this.state.mode === 'RECORDING') {
            // Add point if we moved
            const path = this.mapManager.getPath();
            const lastPoint = path.length > 0 ? path[path.length-1] : null;
            
            let dist = 999;
            if (lastPoint) {
                dist = this.mapManager.getDistance(lastPoint.lat, lastPoint.lng, this.state.lat, this.state.lng);
            }

            if (dist > 5) { // Record every 5 meters to smooth path
                this.mapManager.pathLayer.addLatLng([this.state.lat, this.state.lng]);
            }
        } else if (this.state.mode === 'RACING') {
             this.game.update(this.state);
        }
    }

    // --- SIMULATION MODE ---
    startSimulation() {
        this.isSimulating = true;
        this.state.lat = this.simLat;
        this.state.lng = this.simLng;

        document.getElementById('status-bar').innerText = "SIMULATION: Use WASD to run";

        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

        // Simulation Loop
        setInterval(() => {
            this.updateSimulation();
        }, 100);
    }

    updateSimulation() {
        // Simple physics for simulation
        const speedInc = 0.5; // Acceleration
        const friction = 0.9; // Deceleration
        const maxSpeed = 10; // m/s (~36km/h)

        let moveX = 0;
        let moveY = 0;

        if (this.keys['w']) moveY = 1;
        if (this.keys['s']) moveY = -1;
        if (this.keys['a']) moveX = -1;
        if (this.keys['d']) moveX = 1;

        if (moveX !== 0 || moveY !== 0) {
            this.simSpeed += speedInc;
            if (this.simSpeed > maxSpeed) this.simSpeed = maxSpeed;
        } else {
            this.simSpeed *= friction;
            if (this.simSpeed < 0.1) this.simSpeed = 0;
        }

        // Move coord based on speed and direction
        // 1 degree lat is approx 111km -> 111,000 meters
        // 0.00001 deg is approx 1 meter
        const meterDeg = 0.00001; 

        // If moving
        if (this.simSpeed > 0) {
            // If pressing keys, update direction, else keep momentum? 
            // For simplicity, just move North if W, etc.
            // If no keys but speed > 0 (coasting), just stop for simplicity in this logic
             if (moveX !== 0 || moveY !== 0) {
                 this.state.lat += moveY * this.simSpeed * meterDeg * 0.1; // 0.1s interval
                 this.state.lng += moveX * this.simSpeed * meterDeg * 0.1;
             }
        }

        this.state.speed = this.simSpeed;
        this.updateSystem();
    }
}

new App();
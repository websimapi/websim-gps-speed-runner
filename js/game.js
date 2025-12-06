import { AudioManager } from './audio.js';

export class Game {
    constructor(mapManager) {
        this.map = mapManager;
        this.audio = new AudioManager();
        this.isRunning = false;

        // Game State
        this.rivals = [];
        this.score = 0;
        this.lastSpawnTime = 0;
        this.spawnInterval = 20000; // Spawn rival every 20s
        this.activeRival = null; // The one currently challenging you
        this.defeatTimer = 0;

        this.elements = {
            rivalVal: document.getElementById('rival-val'),
            rivalBox: document.getElementById('rival-box'),
            status: document.getElementById('status-bar')
        };
    }

    start() {
        this.isRunning = true;
        this.elements.status.innerText = "RUN! Waiting for GPS movement...";
        this.audio.play('success'); // Confirm start
    }

    update(playerData) {
        if (!this.isRunning) return;

        const now = Date.now();
        const playerSpeedKmh = (playerData.speed || 0) * 3.6; // Convert m/s to km/h

        // 1. Manage Rivals (Spawning)
        // Only spawn if moving slightly to avoid cluttering while standing still
        if (now - this.lastSpawnTime > this.spawnInterval && playerSpeedKmh > 1) {
            this.spawnRival(playerData);
            this.lastSpawnTime = now;
        }

        // 2. Challenge Logic
        if (this.activeRival) {
            const dist = this.map.getDistance(playerData.lat, playerData.lng, this.activeRival.lat, this.activeRival.lng);

            // If too far, rival disappears
            if (dist > 200) { 
                this.removeActiveRival("Rival lost.");
            } else {
                // If close, verify speed
                this.checkSpeedBattle(playerSpeedKmh);
            }
        } else {
            // Check if we are near any existing rivals in the list (if we had persistent ones)
            // For simplicity, this game creates a fresh "Challenger" periodically
        }
    }

    spawnRival(playerData) {
        if (this.activeRival) return; // One at a time for focus

        // Spawn slightly ahead or nearby
        // Simple random offset approx 20-30 meters
        const offsetLat = (Math.random() - 0.5) * 0.0005; 
        const offsetLng = (Math.random() - 0.5) * 0.0005;

        // Rival speed is player speed + 10% or at least 5km/h
        let targetSpeed = (playerData.speed || 0) * 3.6 * 1.1;
        if (targetSpeed < 5) targetSpeed = 5; 
        if (targetSpeed > 25) targetSpeed = 25; // Cap at human limit

        this.activeRival = {
            id: Date.now(),
            lat: playerData.lat + offsetLat,
            lng: playerData.lng + offsetLng,
            speedToBeat: targetSpeed,
            beatenTime: 0
        };

        this.map.addRivalMarker(this.activeRival);

        // UI Update
        this.elements.rivalBox.classList.add('active');
        this.elements.rivalVal.innerText = targetSpeed.toFixed(1);
        this.elements.status.innerText = `RIVAL DETECTED! Run faster than ${targetSpeed.toFixed(1)} km/h!`;

        this.audio.play('alert');
        this.audio.play('voice_faster');
    }

    checkSpeedBattle(playerSpeed) {
        if (!this.activeRival) return;

        if (playerSpeed > this.activeRival.speedToBeat) {
            this.activeRival.beatenTime += 1; // Accumulate "winning" frames (assuming ~1s updates)
            this.elements.status.innerText = "WINNING! Keep it up!";
            this.elements.status.style.color = "#00ff00";

            if (this.activeRival.beatenTime >= 5) { // Hold speed for ~5 updates/seconds
                this.winBattle();
            }
        } else {
            this.activeRival.beatenTime = Math.max(0, this.activeRival.beatenTime - 0.5);
            this.elements.status.innerText = `TOO SLOW! Need ${this.activeRival.speedToBeat.toFixed(1)} km/h`;
            this.elements.status.style.color = "#ff0055";
        }
    }

    winBattle() {
        this.audio.play('success');
        this.elements.status.innerText = "RIVAL DEFEATED!";
        this.elements.status.style.color = "#fff";
        this.removeActiveRival();
        this.score++;
    }

    removeActiveRival(reason) {
        if (reason) this.elements.status.innerText = reason;

        this.elements.rivalBox.classList.remove('active');
        this.elements.rivalVal.innerText = "--";

        if (this.activeRival) {
            this.map.removeRivalMarker();
            this.activeRival = null;
        }
    }
}
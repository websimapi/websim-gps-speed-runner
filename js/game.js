import { AudioManager } from './audio.js';

export class Game {
    constructor(mapManager) {
        this.map = mapManager;
        this.audio = new AudioManager();
        this.isRunning = false;
        this.trail = null;
        this.startTime = 0;

        // Rival Config
        this.activeRival = null;
        this.rivalSpeedMps = 3; // Default 3 m/s (~11 km/h) if not calculated

        this.elements = {
            rivalVal: document.getElementById('rival-val'),
            rivalBox: document.getElementById('rival-box'),
            status: document.getElementById('status-bar')
        };
    }

    start(trail) {
        if (!trail || trail.length < 2) {
            alert("Trail is too short!");
            return;
        }
        this.trail = trail;
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Competitive pace: 4 m/s (approx 14.4 km/h)
        this.rivalSpeedMps = 4.0; 

        this.activeRival = {
            distanceTraveled: 0,
            lat: trail[0].lat,
            lng: trail[0].lng
        };

        this.elements.status.innerText = "RACE STARTED! BEAT THE MARKER!";
        this.elements.status.style.color = "#fff";
        this.elements.rivalBox.classList.add('active');
        this.elements.rivalVal.innerText = (this.rivalSpeedMps * 3.6).toFixed(1);
        
        this.map.addRivalMarker(this.activeRival);
        this.audio.play('voice_faster');
    }

    update(playerData) {
        if (!this.isRunning || !this.trail) return;

        const now = Date.now();
        const elapsedSec = (now - this.startTime) / 1000;

        // 1. Update Rival Position along path
        this.activeRival.distanceTraveled = elapsedSec * this.rivalSpeedMps;
        const rivalPos = this.getPositionAtDistance(this.trail, this.activeRival.distanceTraveled);
        
        if (rivalPos) {
            this.activeRival.lat = rivalPos.lat;
            this.activeRival.lng = rivalPos.lng;
            this.map.addRivalMarker(this.activeRival);
        } else {
            // Rival finished
            this.elements.status.innerText = "RIVAL FINISHED! TOO SLOW!";
            this.elements.status.style.color = "#ff0055";
            this.isRunning = false;
            this.audio.play('alert');
        }

        // 2. Check Player Status
        const end = this.trail[this.trail.length - 1];
        
        // Distance to finish
        const playerDistToEnd = this.map.getDistance(playerData.lat, playerData.lng, end.lat, end.lng);
        const rivalDistToEnd = this.map.getDistance(this.activeRival.lat, this.activeRival.lng, end.lat, end.lng);
        
        // Win condition: Player near end
        if (playerDistToEnd < 15) { // Within 15m of end
            if (this.isRunning) { // If rival hasn't finished yet
                this.winBattle();
            }
        }

        // Feedback
        if (this.isRunning) {
            if (playerDistToEnd < rivalDistToEnd) {
                this.elements.status.innerText = "YOU ARE LEADING!";
                this.elements.status.style.color = "#00ff00";
            } else {
                const diff = (rivalDistToEnd - playerDistToEnd).toFixed(0);
                this.elements.status.innerText = `BEHIND BY ${diff}m! RUN!`;
                this.elements.status.style.color = "#ff0055";
            }
        }
    }

    winBattle() {
        this.isRunning = false;
        this.audio.play('success');
        this.elements.status.innerText = "VICTORY! TRAIL CONQUERED!";
        this.elements.status.style.color = "#fff";
        this.elements.rivalBox.classList.remove('active');
        this.map.removeRivalMarker();
    }

    stop() {
        this.isRunning = false;
        this.elements.rivalBox.classList.remove('active');
        this.elements.rivalVal.innerText = "--";
        this.map.removeRivalMarker();
    }

    // Helper: Interpolate position along polyline
    getPositionAtDistance(path, distance) {
        let distAccum = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            const segmentDist = this.map.getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
            
            if (distAccum + segmentDist > distance) {
                // Determine ratio
                const remaining = distance - distAccum;
                const ratio = remaining / segmentDist;
                const lat = p1.lat + (p2.lat - p1.lat) * ratio;
                const lng = p1.lng + (p2.lng - p1.lng) * ratio;
                return { lat, lng };
            }
            distAccum += segmentDist;
        }
        return null; // End of path
    }
}
import L from 'leaflet';

export class MapManager {
    constructor() {
        // Initialize Map centered on null island first, update later
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([0, 0], 16);

        this.shouldFollow = true;
        
        // Disable follow mode on user interaction
        this.map.on('dragstart zoomstart', () => {
            this.shouldFollow = false;
            window.dispatchEvent(new CustomEvent('map-interaction'));
        });

        // OpenStreetMap Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        // Layers
        this.pathLayer = L.polyline([], { color: '#00f2ff', weight: 4 }).addTo(this.map);
        // Ghost/Rival Path Layer (distinct style)
        this.rivalPathLayer = L.polyline([], { color: '#ff0055', weight: 2, dashArray: '5, 10', opacity: 0.5 }).addTo(this.map);

        // Player Marker Icon
        const playerIcon = L.icon({
            iconUrl: 'player_marker.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        this.playerMarker = L.marker([0, 0], { icon: playerIcon }).addTo(this.map);
        this.rivalMarker = null;

        // Custom Icon for Rival
        this.rivalIcon = L.icon({
            iconUrl: 'npc_marker.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            className: 'active-rival'
        });
    }

    updatePlayerPosition(lat, lng) {
        const newLatLng = [lat, lng];
        this.playerMarker.setLatLng(newLatLng);
        
        // Only pan if follow mode is active
        if (this.shouldFollow && this.map.dragging.enabled()) {
             this.map.panTo(newLatLng); 
        }
    }

    recenter() {
        const latlng = this.playerMarker.getLatLng();
        if (latlng.lat !== 0 || latlng.lng !== 0) {
            this.shouldFollow = true;
            this.map.panTo(latlng);
        }
    }

    resetPath() {
        this.pathLayer.setLatLngs([]);
        this.rivalPathLayer.setLatLngs([]);
    }

    getPath() {
        return this.pathLayer.getLatLngs();
    }

    enableDrawing(onDrawCallback) {
        // Disable navigation interactions to allow drawing on map surface
        this.map.dragging.disable();
        this.map.touchZoom.disable();
        this.map.doubleClickZoom.disable();
        this.map.scrollWheelZoom.disable();
        this.map.boxZoom.disable();
        this.map.keyboard.disable();
        if (this.map.tap) this.map.tap.disable();
        
        const container = this.map.getContainer();
        container.style.cursor = 'crosshair';

        this.isDrawing = false;
        this._activePointerId = null;

        const getLatLngFromClient = (clientX, clientY) => {
            const rect = container.getBoundingClientRect();
            const point = this.map.containerPointToLatLng([
                clientX - rect.left,
                clientY - rect.top
            ]);
            return point;
        };

        this._onPointerDown = (e) => {
            // Only primary pointer (finger or main mouse button)
            if (e.button !== undefined && e.button !== 0) return;
            this.isDrawing = true;
            this._activePointerId = e.pointerId !== undefined ? e.pointerId : null;

            // Prevent map from also handling this as a gesture
            e.preventDefault();
            e.stopPropagation();

            if (container.setPointerCapture && e.pointerId !== undefined) {
                container.setPointerCapture(e.pointerId);
            }

            const latlng = getLatLngFromClient(e.clientX, e.clientY);
            if (latlng) {
                this.pathLayer.addLatLng(latlng);
                if (onDrawCallback) onDrawCallback();
            }
        };

        this._onPointerMove = (e) => {
            if (!this.isDrawing) return;
            if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;

            e.preventDefault();
            e.stopPropagation();

            const latlng = getLatLngFromClient(e.clientX, e.clientY);
            if (latlng) {
                this.pathLayer.addLatLng(latlng);
                if (onDrawCallback) onDrawCallback();
            }
        };

        this._onPointerUp = (e) => {
            if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;
            this.isDrawing = false;
            this._activePointerId = null;

            e.preventDefault();
            e.stopPropagation();

            if (container.releasePointerCapture && e.pointerId !== undefined) {
                try {
                    container.releasePointerCapture(e.pointerId);
                } catch (_) {
                    // ignore if not captured
                }
            }
        };

        this._onPointerLeave = (e) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            this._activePointerId = null;
        };

        container.addEventListener('pointerdown', this._onPointerDown);
        container.addEventListener('pointermove', this._onPointerMove);
        container.addEventListener('pointerup', this._onPointerUp);
        container.addEventListener('pointercancel', this._onPointerUp);
        container.addEventListener('pointerleave', this._onPointerLeave);
    }

    disableDrawing() {
        this.map.dragging.enable();
        this.map.touchZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.scrollWheelZoom.enable();
        this.map.boxZoom.enable();
        this.map.keyboard.enable();
        if (this.map.tap) this.map.tap.enable();

        const container = this.map.getContainer();
        container.style.cursor = '';
        
        if (this._onPointerDown) {
            container.removeEventListener('pointerdown', this._onPointerDown);
            container.removeEventListener('pointermove', this._onPointerMove);
            container.removeEventListener('pointerup', this._onPointerUp);
            container.removeEventListener('pointercancel', this._onPointerUp);
            container.removeEventListener('pointerleave', this._onPointerLeave);
            this._onPointerDown = null;
            this._onPointerMove = null;
            this._onPointerUp = null;
            this._onPointerLeave = null;
            this._activePointerId = null;
        }
    }

    addRivalMarker(rivalData) {
        if (this.rivalMarker) this.map.removeLayer(this.rivalMarker);
        
        this.rivalMarker = L.marker([rivalData.lat, rivalData.lng], { 
            icon: this.rivalIcon 
        }).addTo(this.map);
    }

    removeRivalMarker() {
        if (this.rivalMarker) {
            this.map.removeLayer(this.rivalMarker);
            this.rivalMarker = null;
        }
    }

    // Helper: Haversine distance in meters
    getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}
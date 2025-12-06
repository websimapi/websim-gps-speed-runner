import L from 'leaflet';

export class MapManager {
    constructor() {
        // Initialize Map centered on null island first, update later
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([0, 0], 16);

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
        
        // Only pan if we are not drawing (dragging enabled implies not drawing mode)
        if (this.map.dragging.enabled()) {
             this.map.panTo(newLatLng); 
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
        this.map.dragging.disable();
        this.map.touchZoom.disable();
        this.map.doubleClickZoom.disable();
        this.map.scrollWheelZoom.disable();
        this.map.boxZoom.disable();
        this.map.keyboard.disable();
        if (this.map.tap) this.map.tap.disable();
        
        const container = this.map.getContainer();
        container.style.cursor = 'crosshair';

        this._onDrawDrag = (e) => {
            // Get position
            let latlng = e.latlng;
            // Fallback for raw touch events if needed, though Leaflet usually provides latlng on map events
            if (!latlng) {
                latlng = this.map.mouseEventToLatLng(e.originalEvent);
            }
            
            if (latlng) {
                this.pathLayer.addLatLng(latlng);
                if (onDrawCallback) onDrawCallback();
            }
        };

        // Listen to map events
        this.map.on('mousedown touchstart', () => {
             this.map.on('mousemove touchmove', this._onDrawDrag);
        });

        this.map.on('mouseup touchend', () => {
            this.map.off('mousemove touchmove', this._onDrawDrag);
        });
    }

    disableDrawing() {
        this.map.dragging.enable();
        this.map.touchZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.scrollWheelZoom.enable();
        this.map.boxZoom.enable();
        this.map.keyboard.enable();
        if (this.map.tap) this.map.tap.enable();

        this.map.getContainer().style.cursor = '';
        this.map.off('mousedown touchstart');
        this.map.off('mousemove touchmove', this._onDrawDrag);
        this.map.off('mouseup touchend');
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
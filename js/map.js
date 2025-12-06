import L from 'leaflet';

export class MapManager {
    constructor() {
        // Initialize Map centered on null island first, update later
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([0, 0], 16);

        // Dark Mode Map Tiles (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        // Layers
        this.pathLayer = L.polyline([], { color: '#00f2ff', weight: 4 }).addTo(this.map);
        
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
        this.pathLayer.addLatLng(newLatLng);
        this.map.panTo(newLatLng); // Keep camera on player
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
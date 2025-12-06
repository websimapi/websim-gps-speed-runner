export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.loadSound('alert', 'sfx_alert.mp3');
        this.loadSound('success', 'sfx_success.mp3');
        this.loadSound('voice_faster', 'voice_faster.mp3');
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound ${name}`, e);
        }
    }

    play(name) {
        if (!this.sounds[name]) return;
        
        // Resume context if suspended (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.sounds[name];
        source.connect(this.ctx.destination);
        source.start(0);
    }
}


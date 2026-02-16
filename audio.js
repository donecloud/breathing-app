/**
 * BREATHING APP — Audio Logic
 * Generates procedural sounds using Web Audio API
 */

const SoundManager = {
    audioContext: null,
    isMuted: false, // Default to unmuted
    masterGain: null,
    compressor: null,

    // Initialize Audio Context (lazy load on user interaction)
    init() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create Master Gain Node for global volume control
            this.masterGain = this.audioContext.createGain();
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
            this.compressor.knee.setValueAtTime(20, this.audioContext.currentTime);
            this.compressor.ratio.setValueAtTime(3, this.audioContext.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.audioContext.destination);
            this.updateMuteState();
        } else if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    toggleSound() {
        this.isMuted = !this.isMuted;
        this.updateMuteState();
        return this.isMuted;
    },

    updateMuteState() {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.32, this.audioContext.currentTime);
        }
    },

    playPianoTone(freq, startTime, duration = 0.9, velocity = 0.22) {
        if (this.isMuted || !this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const when = Math.max(startTime, now);

        const bodyOsc = this.audioContext.createOscillator();
        const attackOsc = this.audioContext.createOscillator();
        const toneGain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(freq, when);

        attackOsc.type = 'sine';
        attackOsc.frequency.setValueAtTime(freq * 2, when);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, when);
        filter.Q.setValueAtTime(0.8, when);

        toneGain.gain.setValueAtTime(0.0001, when);
        toneGain.gain.exponentialRampToValueAtTime(Math.max(velocity, 0.0001), when + 0.012);
        toneGain.gain.exponentialRampToValueAtTime(Math.max(velocity * 0.35, 0.0001), when + 0.1);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

        bodyOsc.connect(filter);
        attackOsc.connect(filter);
        filter.connect(toneGain);
        toneGain.connect(this.masterGain);

        bodyOsc.start(when);
        attackOsc.start(when);
        bodyOsc.stop(when + duration + 0.05);
        attackOsc.stop(when + Math.min(duration * 0.35, 0.25));
    },

    // Play a tone based on phase type
    playPhase(type) {
        if (this.isMuted || !this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Notes tuned for a soft piano-like feel
        let freq = 523.25; // C5
        let duration = 0.85;
        let velocity = 0.2;

        switch (type) {
            case 'inhale':
                freq = 523.25; // C5
                break;
            case 'exhale':
                freq = 392.0; // G4
                break;
            case 'hold':
                freq = 659.25; // E5
                duration = 0.55;
                velocity = 0.16;
                break;
        }

        this.playPianoTone(freq, now, duration, velocity);
    },

    // Play completion chord
    playComplete() {
        if (this.isMuted || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C major arpeggio
        notes.forEach((freq, index) => {
            this.playPianoTone(freq, now + index * 0.14, 1.4, 0.18);
        });
    }
};

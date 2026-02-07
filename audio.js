/**
 * BREATHING APP — Audio Logic
 * Generates procedural sounds using Web Audio API
 */

const SoundManager = {
    audioContext: null,
    isMuted: false, // Default to unmuted
    masterGain: null,

    // Initialize Audio Context (lazy load on user interaction)
    init() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create Master Gain Node for global volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.updateMuteState();
        } else if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    // Ambient Sound Logic
    ambientNodes: [],
    ambientStarted: false,

    startAmbient() {
        if (this.ambientStarted || !this.audioContext) return;

        // Resume context if suspended (browser policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.createAmbientDrone();
            });
        } else {
            this.createAmbientDrone();
        }

        this.ambientStarted = true;
    },

    createAmbientDrone() {
        if (this.isMuted) return; // Don't create if muted (will create on unmute)

        const now = this.audioContext.currentTime;
        this.stopAmbientNodes(); // Clear existing if any

        // Configuration for "Magical Atmosphere"
        // Root: F#3 (approx 185Hz) - associated with heart/earth
        const frequencies = [185.00, 186.50, 277.18]; // Root, Detuned Root (Binaural), Perfect Fifth (C#4)

        frequencies.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            // Oscillator
            osc.frequency.value = freq;
            osc.type = i === 2 ? 'triangle' : 'sine'; // Fifth is triangle for warmth

            // Filter (Lowpass to smooth sound)
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            // Gain (Volume)
            // Lower volume for background
            const volume = i === 2 ? 0.05 : 0.1;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 5); // 5s fade in

            // Connections
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);

            // LFO for movement (subtle volume oscillation)
            const lfo = this.audioContext.createOscillator();
            const lfoGain = this.audioContext.createGain();
            lfo.frequency.value = 0.1 + (i * 0.05); // Different slow speeds
            lfoGain.gain.value = volume * 0.3; // Modulation depth
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            lfo.start(now);

            this.ambientNodes.push({ osc, gain, lfo, lfoGain, filter });
        });
    },

    stopAmbientNodes() {
        if (this.ambientNodes.length > 0) {
            const now = this.audioContext.currentTime;
            this.ambientNodes.forEach(node => {
                try {
                    // Fade out
                    node.gain.gain.cancelScheduledValues(now);
                    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
                    node.gain.gain.linearRampToValueAtTime(0, now + 2);

                    node.osc.stop(now + 2.1);
                    node.lfo.stop(now + 2.1);
                } catch (e) { /* ignore */ }
            });
            this.ambientNodes = [];
        }
    },

    toggleSound() {
        this.isMuted = !this.isMuted;
        this.updateMuteState();

        // Handle ambient immediately
        if (this.isMuted) {
            this.stopAmbientNodes();
        } else {
            if (this.ambientStarted) {
                this.createAmbientDrone();
            }
        }

        return this.isMuted;
    },

    updateMuteState() {
        if (this.masterGain) {
            // Master gain affects everything, but we also manually handle ambient nodes
            // to save CPU when muted
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.5, this.audioContext.currentTime, 0.1);
        }
    },

    // Play a tone based on phase type
    playPhase(type) {
        if (this.isMuted || !this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Oscillator configuration
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        // Sound Design "Singing Bowl"
        // Soft attack, long release, rich harmonics

        let freq = 432; // Default (Inhale)
        let duration = 2.5;

        switch (type) {
            case 'inhale':
                freq = 432; // A4 (ish) - Uplifting
                break;
            case 'exhale':
                freq = 324; // Lower harmonic - Grounding
                break;
            case 'hold':
                freq = 540; // Higher harmonic - Suspended
                duration = 1.0; // Shorter
                break;
        }

        osc.frequency.setValueAtTime(freq, now);
        osc.type = 'sine';

        // Envelope (Attack - Decay - Sustain - Release)
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.1); // Attack
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration); // Long Release

        osc.start(now);
        osc.stop(now + duration);

        // Optional: Add a second oscillator for richness (overtone)
        if (type !== 'hold') {
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(this.masterGain);

            osc2.frequency.setValueAtTime(freq * 1.5, now); // Fifth
            osc2.type = 'sine';

            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.2, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + duration - 0.5);

            osc2.start(now);
            osc2.stop(now + duration);
        }
    },

    // Play completion chord
    playComplete() {
        if (this.isMuted || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [432, 540, 648]; // Major triad logic

        notes.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.frequency.setValueAtTime(freq, now);

            // Staggered entry
            const offset = index * 0.1;

            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 4.0);

            osc.start(now + offset);
            osc.stop(now + offset + 4.0);
        });
    }
};

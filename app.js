/**
 * ============================================================================
 * CYBERDYNE SYSTEMS // T-800 EXCALIBUR HUD ENGINE
 * Core Computer Vision & Augmented Reality Heuristic Subsystem
 * ============================================================================
 */

// --- 1. CONFIGURATION & CONSTANTS ---
const CONFIG = {
    model: {
        base: 'mobilenet_v2',       // Requirement 3: Retain MobileNetV2 base model
        minScore: 0.60,             // Requirement 3: Strict 0.60 minScore threshold
        maxNumBoxes: 5
    },
    context: {
        indoorMode: true            // Target indoor environment context
    },
    // Requirement 1: Indoor-invalid exclusion classes remapped to structural fixtures
    indoorExclusionClasses: ['airplane', 'boat', 'train'],
    remappedExclusionClass: 'CEILING FIXTURE / STRUCTURAL OBJECT',

    // Requirement 2: Smart heuristics for false persons (table lamps, chairs, etc.)
    personHeuristics: {
        targetClass: 'person',
        maxHeightRatio: 0.35,       // Height < 35% of frame viewport
        bottomHalfMinYRatio: 0.50,   // Sits in bottom half of frame
        staticMovementTolerance: 35, // Pixel movement delta threshold for stationary detection
        reclassifiedLabel: 'INANIMATE DECOY / DECOR'
    },
    audio: {
        chimeStartFreq: 300,
        chimeEndFreq: 1400,
        chimeDuration: 0.6,
        speechRate: 0.9,            // Deliberate robotic pace
        speechPitch: 0.6            // Low-pitched cyber voice
    }
};

// --- 2. CYBERDYNE PHYSICAL KNOWLEDGE MATRIX ---
const CYBERDYNE_DATABASE = {
    car: {
        color: "METALLIC / COATED PAINT",
        weight: "2,800 - 3,600 LBS",
        dim: "15.5 FT L x 5.8 FT W",
        threat: "HIGH MASS VEHICLE / IMPACT RISK"
    },
    bus: {
        color: "COMMUNITY / TRANSIT LIVERY",
        weight: "28,000 - 33,000 LBS",
        dim: "40 FT L x 10 FT H",
        threat: "HEAVY TRANSIT MACHINERY"
    },
    truck: {
        color: "INDUSTRIAL / INDUSTRIAL PAINT",
        weight: "6,000 - 12,000 LBS",
        dim: "20 FT L x 7.5 FT H",
        threat: "HEAVY TRANSPORT VEHICLE"
    },
    person: {
        color: "ORGANIC / TEXTILE",
        weight: "150 - 210 LBS",
        dim: "5'8\" - 6'2\" / 1.8M",
        threat: "PRIMARY TARGET (HUMAN)"
    },
    cup: {
        color: "STAINLESS / INSULATED POLYMER",
        weight: "0.8 - 1.2 LBS",
        dim: "9.5 INCH H x 3.8 INCH DIA",
        threat: "SAFE (HYDRATION CONTAINER)"
    },
    bottle: {
        color: "POLYMER / GLASS / METAL",
        weight: "1.0 - 2.2 LBS",
        dim: "10.5 INCH H x 3.0 INCH DIA",
        threat: "SAFE (LIQUID CONTAINER)"
    },
    laptop: {
        color: "ANODIZED ALUMINUM / SILICON",
        weight: "3.2 - 4.5 LBS",
        dim: "14.0 INCH DISPLAY / CHASSIS",
        threat: "DATA TERMINAL / COMPUTER"
    },
    "cell phone": {
        color: "GLASS / ALUMINUM FRAME",
        weight: "0.4 - 0.6 LBS",
        dim: "6.2 INCH x 3.0 INCH",
        threat: "COMMUNICATION DEVICE"
    },
    backpack: {
        color: "SYNTHETIC NYLON / FABRIC",
        weight: "5.0 - 15.0 LBS",
        dim: "18 INCH H x 12 INCH W",
        threat: "CONTAINMENT VESSEL"
    },
    chair: {
        color: "WOOD / METAL / MESH",
        weight: "12 - 25 LBS",
        dim: "36 INCH H x 20 INCH W",
        threat: "NOMINAL / SEATING FURNITURE"
    },
    banana: {
        color: "ORGANIC YELLOW / GREEN",
        weight: "0.25 LBS",
        dim: "7.5 INCH LENGTH",
        threat: "ORGANIC POTASSIUM REFUEL"
    },
    apple: {
        color: "ORGANIC RED / GREEN",
        weight: "0.33 LBS",
        dim: "3.0 INCH DIAMETER",
        threat: "ORGANIC NUTRIENT UNIT"
    },
    // Requirement 1 Spec: Remapped Ceiling Fixture / Structural Object
    "ceiling fixture / structural object": {
        color: "POLYMER / BRUSHED METAL / COMPOSITE",
        weight: "12 - 35 LBS",
        dim: "36 - 52 INCH DIA / OVERHEAD",
        threat: "OVERHEAD INFRASTRUCTURE (NON-COMBATANT)"
    },
    // Requirement 2 Spec: Remapped Inanimate Decoy / Decor
    "inanimate decoy / decor": {
        color: "CERAMIC / DIE-CAST / FABRIC SHADE",
        weight: "2.5 - 14.0 LBS",
        dim: "14 - 28 INCH H (TABLETOP/DECOR)",
        threat: "INANIMATE FIXTURE (ZERO BIOMETRIC THREAT)"
    }
};

// --- 3. SPATIAL & MOTION STABILITY TRACKER ---
class SpatialStabilityTracker {
    constructor() {
        this.lastObservation = null;
    }

    /**
     * Checks if a detection target is stationary.
     * Evaluates spatial persistence and motion delta between scans.
     * @param {Array<number>} bbox - [x, y, width, height]
     * @param {number} tolerance - Max pixel displacement to be considered static
     * @returns {boolean} True if object is stationary or new stationary candidate
     */
    isStatic(bbox, tolerance = CONFIG.personHeuristics.staticMovementTolerance) {
        if (!this.lastObservation) {
            return true;
        }

        const [x, y, width, height] = bbox;
        const currentCenterX = x + width / 2;
        const currentCenterY = y + height / 2;

        const dx = currentCenterX - this.lastObservation.centerX;
        const dy = currentCenterY - this.lastObservation.centerY;
        const distance = Math.hypot(dx, dy);

        // If target shifted significantly across the screen (> 160px), treat as new target focus
        if (distance > 160) {
            return true;
        }

        // If in same region, verify displacement delta is within static tolerance (e.g. table lamp)
        return distance <= tolerance;
    }

    record(bbox) {
        const [x, y, width, height] = bbox;
        this.lastObservation = {
            centerX: x + width / 2,
            centerY: y + height / 2,
            width,
            height,
            timestamp: performance.now()
        };
    }

    reset() {
        this.lastObservation = null;
    }
}

// --- 4. COMPUTER VISION HEURISTICS ENGINE ---
class VisionHeuristicsEngine {
    constructor(tracker) {
        this.tracker = tracker;
    }

    /**
     * Filters geometric hallucinations and applies domain-specific rules.
     * @param {Object} detection - Raw prediction from coco-ssd { class, score, bbox }
     * @param {Object} viewport - Viewport dimensions { width, height }
     * @returns {Object} Enriched detection with reclassified labels and telemetry
     */
    evaluate(detection, viewport) {
        const rawClass = detection.class.toLowerCase().trim();
        const score = detection.score;
        const [x, y, width, height] = detection.bbox;
        const viewportHeight = viewport.height || 1;
        const viewportWidth = viewport.width || 1;

        let finalClass = detection.class.toUpperCase();
        let lookupKey = rawClass;
        let isReclassified = false;
        let diagnosticCode = "PASS // NOMINAL";

        // Heuristic 1: Indoor Exclusion Filter
        // Remap indoor-invalid classes ['airplane', 'boat', 'train'] to 'CEILING FIXTURE / STRUCTURAL OBJECT'
        if (CONFIG.context.indoorMode && CONFIG.indoorExclusionClasses.includes(rawClass)) {
            finalClass = CONFIG.remappedExclusionClass;
            lookupKey = CONFIG.remappedExclusionClass.toLowerCase();
            isReclassified = true;
            diagnosticCode = "RECLASSIFIED // INDOOR CLASS EXCLUSION OVERRIDE";
        }
        // Heuristic 2: Smart False Person Suppressor
        // Detects 'person' hallucination on table lamps, chairs, dressers:
        // Height < 35% viewport and sits static in the bottom half of the frame
        else if (rawClass === CONFIG.personHeuristics.targetClass) {
            const heightRatio = height / viewportHeight;
            const centerY = y + height / 2;
            const sitsInBottomHalf = (centerY >= (viewportHeight * CONFIG.personHeuristics.bottomHalfMinYRatio)) || 
                                     ((y + height) >= (viewportHeight * 0.60));
            const isSmallHeight = heightRatio < CONFIG.personHeuristics.maxHeightRatio;
            const isStationary = this.tracker.isStatic(detection.bbox);

            if (isSmallHeight && sitsInBottomHalf && isStationary) {
                finalClass = CONFIG.personHeuristics.reclassifiedLabel;
                lookupKey = CONFIG.personHeuristics.reclassifiedLabel.toLowerCase();
                isReclassified = true;
                diagnosticCode = `RECLASSIFIED // FALSE PERSON HEURISTIC (H:${Math.round(heightRatio * 100)}% < 35%, BOTTOM-FOV)`;
            }
        }

        // Update spatial movement tracking history
        this.tracker.record(detection.bbox);

        const confidence = Math.round(score * 100);

        // Fetch Cyberdyne Knowledge Specs
        const specs = CYBERDYNE_DATABASE[lookupKey] || {
            color: "COMPOSITE / STRUCTURAL",
            weight: `${Math.round((width * height) / 1000)} - ${Math.round((width * height) / 500)} LBS`,
            dim: `${Math.round(width / 10)} x ${Math.round(height / 10)} INCHES`,
            threat: isReclassified ? "INANIMATE / ZERO BIOMETRIC THREAT" : "ANALYZING TACTICAL RISK..."
        };

        return {
            rawClass,
            finalClass,
            confidence,
            rawScore: score,
            bbox: [x, y, width, height],
            specs,
            isReclassified,
            diagnosticCode
        };
    }
}

// --- 5. AUDIO FEEDBACK CONTROLLER ---
class AudioController {
    constructor() {
        this.audioCtx = null;
    }

    _getAudioContext() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    /**
     * Authentic T-800 frequency sweep scanning sound
     */
    playScanningSound() {
        try {
            const ctx = this._getAudioContext();
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(CONFIG.audio.chimeStartFreq, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(CONFIG.audio.chimeEndFreq, ctx.currentTime + 0.5);

            gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + CONFIG.audio.chimeDuration);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start();
            oscillator.stop(ctx.currentTime + CONFIG.audio.chimeDuration);
        } catch (e) {
            console.warn("[Cyberdyne Audio] Web Audio awaiting user activation.", e);
        }
    }

    /**
     * Robotic Speech Synthesis Utterance
     * @param {string} text - Spoken statement
     */
    speakTargetData(text) {
        if (!('speechSynthesis' in window)) return;

        try {
            window.speechSynthesis.cancel(); // Clear prior queue to prevent audio lag
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = CONFIG.audio.speechRate;
            utterance.pitch = CONFIG.audio.speechPitch;

            // Pick an English robotic/male voice if available on system
            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
                const cyberVoice = voices.find(v => 
                    /en[-_](us|gb|uk)/i.test(v.lang) && /male|david|daniel|alex|natural|robotic/i.test(v.name)
                ) || voices.find(v => /en[-_]/i.test(v.lang));

                if (cyberVoice) utterance.voice = cyberVoice;
            }

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("[Cyberdyne Audio] Speech synthesis unavailable.", e);
        }
    }
}

// --- 6. AR HUD CANVAS RENDERER ---
class HUDCanvasRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
    }

    syncDimensions(video) {
        if (!video || !this.canvas) return;
        const width = video.videoWidth || window.innerWidth;
        const height = video.videoHeight || window.innerHeight;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Renders Cyberdyne tactical bounding box and telemetry callout
     * @param {Object} target - Evaluated target object
     */
    drawTarget(target) {
        const [x, y, width, height] = target.bbox;
        const ctx = this.ctx;

        ctx.save();

        // 1. Glowing Cyberdyne Outer Box
        ctx.strokeStyle = '#ff003c';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = 10;
        ctx.strokeRect(x, y, width, height);

        // 2. Corner Bracket Accents
        const bracketLen = Math.min(22, width / 4, height / 4);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff1a53';

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + width - bracketLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + bracketLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + height - bracketLen); ctx.lineTo(x, y + height); ctx.lineTo(x + bracketLen, y + height);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + width - bracketLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - bracketLen);
        ctx.stroke();

        // 3. Center Crosshair within Bounding Box
        const cx = x + width / 2;
        const cy = y + height / 2;
        const crosshairSize = 8;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 0, 60, 0.7)';
        ctx.beginPath();
        ctx.moveTo(cx - crosshairSize, cy); ctx.lineTo(cx + crosshairSize, cy);
        ctx.moveTo(cx, cy - crosshairSize); ctx.lineTo(cx, cy + crosshairSize);
        ctx.stroke();

        // 4. Tactical Callout Tag (Requirement 3: Confidence display in HUD)
        const tagText = `${target.finalClass} [${target.confidence}%]`;
        ctx.font = 'bold 12px "Courier New", Courier, monospace';
        const textWidth = ctx.measureText(tagText).width;
        const tagHeight = 20;
        const tagY = y > 26 ? y - tagHeight - 4 : y + height + 6;

        ctx.fillStyle = 'rgba(15, 0, 0, 0.85)';
        ctx.fillRect(x, tagY, textWidth + 14, tagHeight);
        ctx.strokeStyle = '#ff003c';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, tagY, textWidth + 14, tagHeight);

        ctx.fillStyle = '#ff003c';
        ctx.fillText(tagText, x + 7, tagY + 14);

        ctx.restore();
    }
}

// --- 7. APPLICATION CONTROLLER ---
class TerminatorHUDApp {
    constructor() {
        this.model = null;
        this.isScanning = false;
        this.video = null;
        this.label = null;
        this.scanBtn = null;

        this.tracker = new SpatialStabilityTracker();
        this.heuristics = new VisionHeuristicsEngine(this.tracker);
        this.audio = new AudioController();
        this.renderer = null;
    }

    async init() {
        this.video = document.getElementById('camera-feed');
        this.label = document.getElementById('reticle-label');
        this.scanBtn = document.getElementById('scan-btn');
        this.renderer = new HUDCanvasRenderer('hud-canvas');

        this.setupEventListeners();
        await this.initCamera();
        await this.loadAIModel();
    }

    setupEventListeners() {
        // Adapt canvas to camera metadata load and window resizing for mobile
        this.video.addEventListener('loadedmetadata', () => this.renderer.syncDimensions(this.video));
        window.addEventListener('resize', () => this.renderer.syncDimensions(this.video));
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.renderer.syncDimensions(this.video), 200);
        });
    }

    async initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Rear camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            this.video.srcObject = stream;
        } catch (err) {
            console.error("[Cyberdyne Vision] Camera feed offline:", err);
            if (this.label) this.label.innerText = "CAMERA OFFLINE";
        }
    }

    // Requirement 3: Retain mobilenet_v2 base model
    async loadAIModel() {
        if (this.label) this.label.innerText = "LOADING HIGH-PRECISION CYBERDYNE NET (MOBILENET_V2)...";
        try {
            this.model = await cocoSsd.load({ base: CONFIG.model.base });
            if (this.label) this.label.innerText = "SYSTEM READY // TARGET LOCKED";
            console.log(`[Cyberdyne Net] Loaded ${CONFIG.model.base} with strict threshold >= ${CONFIG.model.minScore}`);
        } catch (err) {
            console.error("[Cyberdyne Net] Neural network load failed:", err);
            if (this.label) this.label.innerText = "AI OFFLINE (FALLBACK MODE)";
        }
    }

    /**
     * Executes single-frame analysis with geometric validation and AR telemetry
     */
    async triggerScan() {
        if (this.isScanning) return;
        this.isScanning = true;

        if (this.scanBtn) this.scanBtn.disabled = true;
        if (this.label) this.label.innerText = "SCANNING FRAME MATRIX...";

        // Requirement 4: Web Audio scan chime
        this.audio.playScanningSound();
        this.renderer.clear();

        let topTarget = null;

        if (this.model && this.video && this.video.readyState >= 2) {
            try {
                // Requirement 3: Strict 0.60 minScore threshold
                const predictions = await this.model.detect(
                    this.video,
                    CONFIG.model.maxNumBoxes,
                    CONFIG.model.minScore
                );

                // Filter to ensure confidence >= 0.60 and sort highest confidence first
                const qualified = predictions
                    .filter(p => p.score >= CONFIG.model.minScore)
                    .sort((a, b) => b.score - a.score);

                if (qualified.length > 0) {
                    const viewport = {
                        width: this.renderer.canvas.width || this.video.videoWidth || window.innerWidth,
                        height: this.renderer.canvas.height || this.video.videoHeight || window.innerHeight
                    };

                    // Apply CV Heuristic evaluation (Requirements 1 & 2)
                    topTarget = this.heuristics.evaluate(qualified[0], viewport);
                }
            } catch (err) {
                console.error("[Cyberdyne Vision] Inference error:", err);
            }
        }

        // Processing latency cadence for authentic HUD feel
        setTimeout(() => {
            if (topTarget) {
                // Render bounding box with confidence percentage on canvas
                this.renderer.drawTarget(topTarget);

                // Update HUD Telemetry Card & Reticle (Requirement 3: Confidence alongside label)
                document.getElementById('obj-class').innerText = `${topTarget.finalClass} (${topTarget.confidence}%)`;
                document.getElementById('obj-color').innerText = topTarget.specs.color;
                document.getElementById('obj-weight').innerText = topTarget.specs.weight;
                document.getElementById('obj-dim').innerText = topTarget.specs.dim;
                document.getElementById('obj-threat').innerText = topTarget.specs.threat;

                if (this.label) {
                    this.label.innerText = `TARGET LOCKED: ${topTarget.finalClass} [${topTarget.confidence}%]`;
                }

                // Requirement 4: SpeechSynthesisUtterance robotic readout
                const spokenLabel = topTarget.finalClass.toLowerCase();
                this.audio.speakTargetData(`Target identified: ${spokenLabel}. Certainty ${topTarget.confidence} percent.`);
            } else {
                this.renderer.clear();
                if (this.label) this.label.innerText = "NO HIGH-CONFIDENCE TARGET IN RANGE";
                document.getElementById('obj-class').innerText = "SCANNING SECTOR...";
                document.getElementById('obj-color').innerText = "--";
                document.getElementById('obj-weight').innerText = "--";
                document.getElementById('obj-dim').innerText = "--";
                document.getElementById('obj-threat').innerText = "NOMINAL / CLEAR";
            }

            if (this.scanBtn) this.scanBtn.disabled = false;
            this.isScanning = false;
        }, 550);
    }
}

// Global App Instance
const app = new TerminatorHUDApp();

// Global invocation hook for index.html onclick="triggerScan()"
window.triggerScan = function() {
    app.triggerScan();
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
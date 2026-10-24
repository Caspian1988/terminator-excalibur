let model = null;
let isScanning = false;

document.addEventListener('DOMContentLoaded', async () => {
    await initCamera();
    await loadAIModel();
    setupCanvas();
});

// 1. Initialize Web Camera Stream
async function initCamera() {
    const video = document.getElementById('camera-feed');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera access error:", err);
        document.getElementById('reticle-label').innerText = "CAMERA OFFLINE";
    }
}

// 2. Setup Overlay Canvas size
function setupCanvas() {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('hud-canvas');
    video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth || window.innerWidth;
        canvas.height = video.videoHeight || window.innerHeight;
    });
}

// 3. Load high-precision COCO-SSD Neural Network Model
async function loadAIModel() {
    const label = document.getElementById('reticle-label');
    label.innerText = "LOADING HIGH-PRECISION CYBERDYNE NET...";
    try {
        model = await cocoSsd.load({ base: 'mobilenet_v2' });
        label.innerText = "SYSTEM READY // TARGET LOCKED";
    } catch (err) {
        console.error("AI Model failed to load:", err);
        label.innerText = "AI OFFLINE (FALLBACK MODE)";
    }
}

// 4. Web Audio Synthesizer for Authentic T-800 Scan Sound
function playScanningSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
        console.log("Audio waiting for user click.");
    }
}

// 5. Speech Synthesis - T-800 Robotic Voice Voiceover
function speakTargetData(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // clear queue
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // deliberate robotic pace
        utterance.pitch = 0.6; // low-pitched cyber voice
        window.speechSynthesis.speak(utterance);
    }
}

// 6. Comprehensive Cyberdyne Physical Knowledge Matrix
const cyberdyneDatabase = {
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
    }
};

// 7. Core AI Scan & Bounding Box Rendering
async function triggerScan() {
    if (isScanning) return;
    isScanning = true;

    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('hud-canvas');
    const ctx = canvas.getContext('2d');
    const label = document.getElementById('reticle-label');
    const scanBtn = document.getElementById('scan-btn');

    scanBtn.disabled = true;
    label.innerText = "SCANNING FRAME MATRIX...";
    playScanningSound();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let detectedObject = null;

    if (model) {
        const predictions = await model.detect(video, 5, 0.60);
        if (predictions.length > 0) {
            // Sort to grab the highest confidence detection
            predictions.sort((a, b) => b.score - a.score);
            detectedObject = predictions[0];
        }
    }

    setTimeout(() => {
        if (detectedObject) {
            const rawClass = detectedObject.class.toLowerCase();
            const className = detectedObject.class.toUpperCase();
            const confidence = Math.round(detectedObject.score * 100);
            const [x, y, width, height] = detectedObject.bbox;

            // Draw Cyberdyne Bounding Box on Canvas
            ctx.strokeStyle = '#ff003c';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff003c';
            ctx.shadowBlur = 10;
            ctx.strokeRect(x, y, width, height);

            // Fetch Real Specs from Database or dynamic fallback calculation
            const specs = cyberdyneDatabase[rawClass] || {
                color: "COMPOSITE / STRUCTURAL",
                weight: `${Math.round((width * height) / 1000)} - ${Math.round((width * height) / 500)} LBS`,
                dim: `${Math.round(width / 10)} x ${Math.round(height / 10)} INCHES`,
                threat: "ANALYZING TACTICAL RISK..."
            };

            // Update HUD UI Card
            document.getElementById('obj-class').innerText = `${className} (${confidence}%)`;
            document.getElementById('obj-color').innerText = specs.color;
            document.getElementById('obj-weight').innerText = specs.weight;
            document.getElementById('obj-dim').innerText = specs.dim;
            document.getElementById('obj-threat').innerText = specs.threat;

            label.innerText = `TARGET LOCKED: ${className} [${confidence}%]`;

            // Voice Feedback
            speakTargetData(`Target identified: ${rawClass}. Certainty ${confidence} percent.`);
        } else {
            label.innerText = "NO HIGH-CONFIDENCE TARGET IN RANGE";
            document.getElementById('obj-class').innerText = "SCANNING SECTOR...";
            document.getElementById('obj-color').innerText = "--";
            document.getElementById('obj-weight').innerText = "--";
            document.getElementById('obj-dim').innerText = "--";
            document.getElementById('obj-threat').innerText = "NOMINAL / CLEAR";
        }

        scanBtn.disabled = false;
        isScanning = false;
    }, 600);
}
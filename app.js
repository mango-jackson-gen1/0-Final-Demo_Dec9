import { saveToBackend } from './firebase.js';

// --- 1. SHARED STATE & AUDIO ---
const overlay = document.getElementById('start-overlay');
const nextStepBtn = document.getElementById('next-step-btn');
const sceneBlobs = document.getElementById('scene-blobs');
const sceneChart = document.getElementById('scene-chart');
const saveChartBtn = document.getElementById('save-chart-btn');

let audioContext = null;
let hasStarted = false;
let activeOscillators = [];
const NOTES = [174.61, 196.00, 220.00, 261.63, 293.66, 329.63]; 

// --- 2. AUDIO ENGINE (Ambient) ---
function initAudio() {
    if (hasStarted) return;
    
    // Validate User Name
    const nameInput = document.getElementById('username-input');
    const userName = nameInput.value.trim();
    if (!userName) {
        alert("Please enter your name to begin.");
        return;
    }

    // Save User Identity
    saveToBackend('user_identity', { name: userName });

    hasStarted = true;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 1000);
    setInterval(ambientLoop, 2000); 
}

function playAmbientTone(freq, volume, duration) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    
    const now = audioContext.currentTime;
    const attack = duration * 0.4;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack); 
    gain.gain.linearRampToValueAtTime(0.001, now + duration); 

    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(now + duration + 1);
}

function ambientLoop() {
    if (overlapIntensity <= 0.01 || !sceneBlobs.classList.contains('active')) return; 
    
    let baseVol = 0.02; 
    let duration = 4; 
    if (overlapIntensity > 0) {
        baseVol += (overlapIntensity * 0.08); 
        duration = 3 + (overlapIntensity * 2);
    }

    if (Math.random() > 0.1 || overlapIntensity > 0.1) {
        let note = NOTES[Math.floor(Math.random() * NOTES.length)];
        if (overlapIntensity > 0.6) {
            playAmbientTone(note, baseVol, duration);
            setTimeout(() => {
                let note2 = NOTES[Math.floor(Math.random() * NOTES.length)];
                playAmbientTone(note2, baseVol, duration);
            }, 100); 
        } else {
            playAmbientTone(note, baseVol, duration);
        }
    }
}

// --- 3. BLOB INTERACTION LOGIC ---
const blob1 = document.getElementById('blob1');
const blob2 = document.getElementById('blob2');
const touchNote = document.getElementById('touch-note');
const nextStepContainer = document.getElementById('next-step-container');

let isDragging = null;
let startX, startY, initialLeft, initialTop;
let overlapIntensity = 0;
let interactionCount = 0;

function handleMouseDown(e) {
    isDragging = e.target;
    if (isDragging.classList.contains('blob')) {
        isDragging.style.animation = 'none'; 
    } else {
        isDragging = isDragging.closest('.blob');
        if (isDragging) isDragging.style.animation = 'none';
        else return;
    }
    
    const rect = isDragging.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    startX = clientX;
    startY = clientY;
    initialLeft = rect.left;
    initialTop = rect.top;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
    
    interactionCount++;
    if(interactionCount > 2) {
        nextStepContainer.style.opacity = 1;
        nextStepContainer.style.pointerEvents = 'auto';
    }
}

function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;
    isDragging.style.left = `${initialLeft + dx}px`;
    isDragging.style.top = `${initialTop + dy}px`;
    checkInteraction();
}

function handleMouseUp() {
    isDragging = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleMouseMove);
    document.removeEventListener('touchend', handleMouseUp);
}

function checkInteraction() {
    const rect1 = blob1.getBoundingClientRect();
    const rect2 = blob2.getBoundingClientRect();
    const c1 = { x: rect1.left + rect1.width/2, y: rect1.top + rect1.height/2 };
    const c2 = { x: rect2.left + rect2.width/2, y: rect2.top + rect2.height/2 };
    const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
    const radiusSum = (rect1.width/2) + (rect2.width/2);

    let rawOverlap = 1 - (dist / radiusSum);
    overlapIntensity = Math.max(0, Math.min(1, rawOverlap));

    if (overlapIntensity > 0.3) {
        const midX = (c1.x + c2.x) / 2;
        const midY = (c1.y + c2.y) / 2;
        touchNote.style.left = midX + 'px';
        touchNote.style.top = midY + 'px';
        touchNote.style.opacity = overlapIntensity; 
    } else {
        touchNote.style.opacity = 0;
    }
}

blob1.addEventListener('mousedown', handleMouseDown);
blob2.addEventListener('mousedown', handleMouseDown);
blob1.addEventListener('touchstart', handleMouseDown, { passive: false });
blob2.addEventListener('touchstart', handleMouseDown, { passive: false });
document.getElementById('start-btn').addEventListener('click', initAudio);

// --- 4. CHART & TRANSITION LOGIC ---

nextStepBtn.addEventListener('click', () => {
    // 1. Save Congruence Data
    const congruencePercentage = Math.round(overlapIntensity * 100);
    
    saveToBackend('congruence', {
        congruence: congruencePercentage,
        description: "Overlap percentage between self-concepts"
    });

    // 2. Transition
    sceneBlobs.classList.remove('active');
    setTimeout(() => {
        sceneChart.classList.add('active');
        initChart(); 
    }, 1000);
});

// Data for the Chart (Internal value 0.1-1.0 maps to 1-10)
const chartData = [
    { label: "Bodily Self", def: "Knowing one's body and its limits", value: 0.5, idealValue: 0.5 },
    { label: "Self-identity", def: "Awareness of inner sameness and continuity", value: 0.5, idealValue: 0.5 },
    { label: "Self-esteem", def: "Pride in the ability to do things", value: 0.5, idealValue: 0.5 },
    { label: "Self-extension", def: "Sense of possession and valuing of others", value: 0.5, idealValue: 0.5 },
    { label: "Self-image", def: "Sense of measuring up to expectations of others", value: 0.5, idealValue: 0.5 },
    { label: "Self-as-rational-coper", def: "Sense of self as active problem-solving agent", value: 0.5, idealValue: 0.5 },
    { label: "Propriate striving", def: "Development of long-term purposes and goals", value: 0.5, idealValue: 0.5 }
];

const canvas = document.getElementById('radar-canvas');
const ctx = canvas.getContext('2d');
const chartContainer = document.getElementById('chart-container');
const dateDisplay = document.getElementById('date-display');
const chartHeader = document.querySelector('#scene-chart h2');

let centerX, centerY, radius;
let isDraggingChart = false;
let draggedIndex = -1;
let chartMode = 'current';

function initChart() {
    // Set Date
    const today = new Date();
    dateDisplay.innerText = today.toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
    });

    // Reset State
    chartMode = 'current';
    saveChartBtn.innerText = "Next"; // Initial text
    if(chartHeader) chartHeader.innerText = "The Architecture of Self";

    resizeChart();
    window.addEventListener('resize', resizeChart);
    
    canvas.addEventListener('mousedown', onChartDown);
    canvas.addEventListener('touchstart', onChartDown, {passive: false});
    window.addEventListener('mousemove', onChartMove);
    window.addEventListener('touchmove', onChartMove, {passive: false});
    window.addEventListener('mouseup', onChartUp);
    window.addEventListener('touchend', onChartUp);
    
    renderChartLabels();
    animateChart();
}

function resizeChart() {
    // Check if canvas is in a container (Scene 3) or full screen (Scene 2)
    const parent = canvas.parentElement;
    if (parent && parent.id !== 'chart-container') {
        // Small mode (Sidebar)
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight || 300; // Fallback
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        radius = Math.min(centerX, centerY) * 0.7; // Slightly larger relative radius for small view
    } else {
        // Full screen mode
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        radius = Math.min(centerX, centerY) * 0.6; 
        renderChartLabels(); 
    }
}

function renderChartLabels() {
    document.querySelectorAll('.chart-label').forEach(el => el.remove());

    const angleStep = (Math.PI * 2) / chartData.length;
    
    // Find where to append labels: 
    // If canvas is in #mini-chart-container, append there.
    // If canvas is in #chart-container, append there.
    const parent = canvas.parentElement || chartContainer;

    chartData.forEach((item, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelRadius = radius + 40; // Reduced distance for tighter layout
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;

        const div = document.createElement('div');
        div.className = 'chart-label';
        // Simplified labels for the mini-chart?
        // Let's keep them but maybe just the bold text if in mini-mode
        if (parent.id === 'chart-container') {
             div.innerHTML = `<strong>${item.label}</strong><span>${item.def}</span>`;
             div.style.left = (x - 100) + 'px'; 
             div.style.top = (y - 20) + 'px';
        } else {
             // Mini Chart Labels - simpler
             div.innerHTML = `<strong>${item.label}</strong>`;
             div.style.fontSize = '0.75rem';
             div.style.width = '100px';
             div.style.left = (x - 50) + 'px'; 
             div.style.top = (y - 10) + 'px';
        }
        
        parent.appendChild(div);
    });
}

function getPoint(index, value) {
    const angleStep = (Math.PI * 2) / chartData.length;
    const angle = index * angleStep - Math.PI / 2;
    return {
        x: centerX + Math.cos(angle) * (value * radius),
        y: centerY + Math.sin(angle) * (value * radius)
    };
}

function drawPolygon(dataKey, colorFill, colorStroke) {
    ctx.fillStyle = colorFill;
    ctx.strokeStyle = colorStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    chartData.forEach((item, i) => {
        const val = item[dataKey];
        const p = getPoint(i, val);
        if(i===0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawNodes(dataKey, color) {
    chartData.forEach((item, i) => {
        const val = item[dataKey];
        const p = getPoint(i, val);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2); // Smaller nodes
        ctx.fill();
        ctx.stroke();
        
        // --- Display Score (1-10) ---
        // Only show score numbers if in full screen mode to reduce clutter?
        // Or keep them. Let's keep them but small.
        const score = Math.round(val * 10);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Nunito';
        ctx.textAlign = 'center';
        const offsetX = Math.cos(i * (Math.PI * 2) / chartData.length - Math.PI / 2) * 15;
        const offsetY = Math.sin(i * (Math.PI * 2) / chartData.length - Math.PI / 2) * 15;
        ctx.fillText(score, p.x + offsetX, p.y + offsetY + 3);
    });
}

function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid & Guide
    ctx.strokeStyle = '#e0e0e0'; 
    ctx.lineWidth = 1;
    for(let r = 0.2; r <= 1; r += 0.2) { // Less grid lines
        ctx.beginPath();
        for(let i = 0; i < chartData.length; i++) {
            const p = getPoint(i, r);
            if(i===0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    ctx.strokeStyle = '#eee';
    for(let i = 0; i < chartData.length; i++) {
        const p = getPoint(i, 1);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }

    // DRAW CURRENT SELF (Blue)
    drawPolygon('value', 'rgba(100, 180, 255, 0.3)', '#64b4ff');
    drawNodes('value', '#64b4ff'); // Context always drawn

    // DRAW IDEAL SELF (Pink) - Draw if ideal mode OR if we are in Scene 3 (which implies ideal mode was active)
    if (chartMode === 'ideal' || document.getElementById('scene-reflection').classList.contains('active')) {
        drawPolygon('idealValue', 'rgba(255, 100, 180, 0.3)', '#ff64b4');
        drawNodes('idealValue', '#ff64b4');
    }
}

function animateChart() {
    if(sceneChart.classList.contains('active')) {
        drawChart();
        requestAnimationFrame(animateChart);
    }
}

// --- CHART INTERACTION ---
function onChartDown(e) {
    if(!sceneChart.classList.contains('active')) return;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const targetKey = chartMode === 'current' ? 'value' : 'idealValue';

    chartData.forEach((item, i) => {
        const val = item[targetKey];
        const p = getPoint(i, val);
        const dist = Math.hypot(clientX - p.x, clientY - p.y);
        if(dist < 30) { 
            isDraggingChart = true;
            draggedIndex = i;
        }
    });
}

function onChartMove(e) {
    if(!isDraggingChart) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const dist = Math.hypot(clientX - centerX, clientY - centerY);
    let val = dist / radius;
    val = Math.max(0.1, Math.min(1, val)); // 1-10
    
    if (chartMode === 'current') {
        chartData[draggedIndex].value = val;
    } else {
        chartData[draggedIndex].idealValue = val;
    }
}

function onChartUp() {
    isDraggingChart = false;
    draggedIndex = -1;
}

// --- SAVE BUTTON LOGIC ---
saveChartBtn.addEventListener('click', () => {
    
    if (chartMode === 'current') {
        // NEXT PHASE
        chartMode = 'ideal';
        saveChartBtn.innerText = "Complete Today's Entry";
        if(chartHeader) chartHeader.innerText = "Plot your Ideal Self";
        
        // Sync ideal to start where current left off
        chartData.forEach(item => item.idealValue = item.value);

    } else {
        // FINALIZE
        // 1. Save Chart Data (Architecture)
        const metrics = {};
        const idealMetrics = {};
        chartData.forEach(item => {
            metrics[item.label] = item.value;
            idealMetrics[item.label] = item.idealValue;
        });
        
        saveToBackend('self_architecture', {
            metrics: metrics,
            idealMetrics: idealMetrics,
            description: "User's self-assessed psychological architecture (Current vs Ideal)"
        });

        // 2. Transition to Scene 3
        sceneChart.classList.remove('active');
        setTimeout(() => {
            document.getElementById('scene-reflection').classList.add('active');
            initReflection(); 
        }, 1000);
    }
});

// --- SCENE 3: CHATBOT & MEMORY LOGIC ---

import { getSummary, saveSummary } from './firebase.js';

const chatHistory = document.getElementById('chat-history');
const initialLoading = document.getElementById('initial-loading');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

let currentSummary = null;
let conversationLog = []; 

async function initReflection() {
    console.log("Initializing Reflection Chat...");
    
    // 1. Gather Session Data
    const congruence = Math.round(overlapIntensity * 100);
    const metrics = {};
    const idealMetrics = {};
    chartData.forEach(item => {
        metrics[item.label] = Math.round(item.value * 10);
        idealMetrics[item.label] = Math.round(item.idealValue * 10);
    });

    // --- NEW: Move Chart to Sidebar & List Metrics ---
    
    // Move Canvas
    const miniChartContainer = document.getElementById('mini-chart-container');
    const metricList = document.getElementById('metric-list');
    
    // Move canvas element to the new container
    if (miniChartContainer && canvas) {
        miniChartContainer.appendChild(canvas);
        // Ensure chart is resized to fit new container (sidebar width)
        resizeChart(); 
        
        // Remove listeners if we don't want interaction, OR keep them.
        // For now, we keep them but the chart will just be viewable.
        // We might want to disable dragging in this mode?
        // Let's just set a flag if needed, but current logic shouldn't break anything.
    }

    // Render Metric List
    metricList.innerHTML = '';
    chartData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'metric-item';
        // Show Current / Ideal scores
        const currentScore = Math.round(item.value * 10);
        const idealScore = Math.round(item.idealValue * 10);
        
        div.innerHTML = `
            <strong>${item.label}</strong>
            <span class="metric-meta">Current: ${currentScore} / Ideal: ${idealScore}</span>
            <span class="metric-def">${item.def}</span>
        `;
        metricList.appendChild(div);
    });

    // 2. Fetch "Long-term Memory" (Patient File)
    currentSummary = await getSummary();
    console.log("Current Patient Summary:", currentSummary);

    // 3. Generate Initial Question
    try {
        const question = await generateInitialPrompt(congruence, metrics, idealMetrics, currentSummary);
        
        // 4. Update UI
        initialLoading.remove();
        addMessageToChat('bot', question);
        chatInputArea.style.display = 'flex';
        chatInput.focus();

        // Start conversation log
        conversationLog.push({ role: 'assistant', content: question });

    } catch (error) {
        console.error("LLM Error:", error);
        initialLoading.innerText = "Error connecting to AI. Please refresh.";
    }
}

async function generateInitialPrompt(congruence, metrics, idealMetrics, summary) {
    // 1. Process Data (Backend Logic)
    let maxGap = -1;
    let dominantMetric = null;
    let gapType = null; // 'depressive' or 'anxious'

    // Check Scene 1 Congruence first (Scenario C)
    if (congruence < 40) {
        gapType = 'congruence';
    } else {
        // Calculate Gaps
        for (const [key, val] of Object.entries(metrics)) {
            const actual = val;
            const ideal = idealMetrics[key] || val;
            const ought = val; // Defaulting ought to actual for now

            const depressiveGap = ideal - actual;
            const anxiousGap = ought - actual;

            // Check Depressive Gap
            if (Math.abs(depressiveGap) > maxGap) {
                maxGap = Math.abs(depressiveGap);
                dominantMetric = key;
                gapType = depressiveGap > 0 ? 'depressive' : 'flow'; // if ideal > actual
            }

            // Check Anxious Gap (if we had ought data)
            if (Math.abs(anxiousGap) > maxGap) {
                maxGap = Math.abs(anxiousGap);
                dominantMetric = key;
                gapType = anxiousGap > 0 ? 'anxious' : 'flow';
            }
        }
    }

    // fallback if gaps are small
    if (maxGap < 2 && gapType !== 'congruence') {
        gapType = 'flow';
    }

    // 2. Select Template
    let template = "";
    let dataContext = "";

    if (gapType === 'congruence') {
        template = "Before we look at the details, let's honor the big picture. Your congruence score suggests you felt you had to wear a mask today. That is an exhausting thing to do. In which specific moment today did you feel you had to hide your true self, and what would it feel like to gently take that mask off right now, in this private space?";
        dataContext = `Congruence Score: ${congruence}% (Low)`;

    } else if (gapType === 'anxious') {
        // Scenario A
        const actual = metrics[dominantMetric];
        const ought = actual; // Placeholder
        template = `I notice a heavy weight in your ${dominantMetric} today. There is a strong voice telling you that you 'should' be at a ${ought}, even though you're currently feeling like a ${actual}. If you could gently set down that heavy expectation for just five minutes, what is the one true thing your ${actual} needs to feel safe right now?`;
        dataContext = `Metric: ${dominantMetric}, Actual: ${actual}, Ought: ${ought}`;

    } else if (gapType === 'depressive') {
        // Scenario B
        const actual = metrics[dominantMetric];
        const ideal = idealMetrics[dominantMetric];
        template = `There is a beautiful longing in your chart today regarding your ${dominantMetric}. You can clearly see the version of yourself who is ${ideal}, but the gap to get there feels wide. Instead of trying to leap across that gap, what is the tiniest bridge you could build today? What is one micro-action that honors your desire for ${dominantMetric} without overwhelming you?`;
        dataContext = `Metric: ${dominantMetric}, Actual: ${actual}, Ideal: ${ideal}`;

    } else {
        // Flow/Stasis
        template = "Your chart shows a gentle balance today. You are relatively aligned with your ideals. What is one moment of ease or flow you experienced today that you would like to anchor into your memory?";
        dataContext = "Gaps are small, user is in flow/stasis.";
    }

    // 3. Prompt LLM to Polish
    let systemInstruction = `
Role: You are a Compassionate Architect of the Self.
Goal: Use the provided template to ask the user a reflection question.
Tone: Validating, Curious, Somatic, Action-Oriented.
History: ${summary ? summary : "New Patient"}

INSTRUCTIONS:
- The backend has already selected the perfect question template for this user.
- Your job is to output this question.
- You may make minor edits to smooth the phrasing, but KEEP THE CORE MESSAGE AND STRUCTURE.
- DO NOT use quotation marks around the output.
- DO NOT explain why you chose it.
- DO NOT say "Based on your data".
- Output ONLY the question.

TEMPLATE:
${template}
`;

    const response = await askLlama(systemInstruction, "Please give me the question.");
    return response;
}

// --- CHAT INTERACTION ---

chatSendBtn.addEventListener('click', handleUserMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserMessage();
    }
});

async function handleUserMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // 1. Display User Message
    addMessageToChat('user', text);
    chatInput.value = '';
    conversationLog.push({ role: 'user', content: text });

    // 2. Show Typing Indicator (temporary)
    const typingId = 'typing-' + Date.now();
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message bot-message';
    typingMsg.id = typingId;
    typingMsg.innerText = "...";
    chatHistory.appendChild(typingMsg);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // 3. Call LLM for Reply
    try {
        const reply = await generateReply(conversationLog);
        
        // Remove typing indicator
        document.getElementById(typingId).remove();
        
        // Display Bot Reply
        addMessageToChat('bot', reply);
        conversationLog.push({ role: 'assistant', content: reply });

        // 4. Update Memory (Background Task)
        updatePatientFile(currentSummary, conversationLog);

    } catch (e) {
        console.error(e);
        document.getElementById(typingId).innerText = "error...";
    }
}

async function generateReply(history) {
    const system = `You are a Compassionate Integration Coach. 
    INSTRUCTIONS:
    - Keep your replies SHORT, SNAPPY, and ONE SENTENCE mostly.
    - Be like a mirror: reflect back what they said with a deepening question.
    - NO quotation marks.
    - Natural, conversational tone.`;
    
    // Format history for Llama (simple concatenation for this proxy)
    let promptTrace = history.map(h => `${h.role === 'user' ? 'User' : 'Coach'}: ${h.content}`).join("\n");
    
    return await askLlama(system, promptTrace + "\nCoach:");
}

function addMessageToChat(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
    div.innerText = text.trim(); // TRIM WHITESPACE to avoid leading newlines
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- MEMORY UPDATE ---

async function updatePatientFile(oldSummary, recentLog) {
    console.log("Updating Patient File...");
    
    const logText = recentLog.map(h => `${h.role}: ${h.content}`).join("\n");
    
    const system = `You are a Medical Scribe for a Psychologist. Update the "Patient File Summary" based on the new session logs. 
    - OLD SUMMARY: ${oldSummary ? oldSummary : "None"}
    - NEW SESSION LOG: ${logText}
    
    INSTRUCTIONS:
    - rewrite the summary to include new insights.
    - Highlight recurring themes (e.g. "User consistently scores low on Bodily Self").
    - Keep it under 150 words.
    - Output ONLY the new summary text.`;

    try {
        const newSummary = await askLlama(system, "Update the file.");
        if (newSummary) {
            saveSummary(newSummary);
            currentSummary = newSummary; // Update local state
        }
    } catch (e) {
        console.error("Failed to update memory", e);
    }
}

// --- SHARED LLM FUNCTION ---
async function askLlama(systemPrompt, userPrompt) {
    let replicateProxy = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    
    const data = {
        model: "meta/meta-llama-3-8b-instruct",
        input: {
            system_prompt: systemPrompt,
            prompt: userPrompt,
            max_tokens: 300 // Increased for chat
        },
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: 'application/json',
        },
        body: JSON.stringify(data),
    };

    const raw_response = await fetch(replicateProxy, options);
    const json_response = await raw_response.json();
    
    if (json_response.output && json_response.output.length > 0) {
        return json_response.output.join("");
    } else {
        throw new Error("No output from LLM");
    }
}

// - Navigation -
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.snav-item, .tnav-item, .nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll(`.snav-item[data-page="${pageId}"], .tnav-item[data-page="${pageId}"], .nav-link[data-page="${pageId}"]`).forEach(l => l.classList.add('active'));
  if (pageId === 'safemap') initMap();
}

document.querySelectorAll('.nav-link, .snav-item, .tnav-item').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
});
document.querySelectorAll('[data-page]').forEach(el => {
  if (!el.classList.contains('nav-link') && !el.classList.contains('snav-item') && !el.classList.contains('tnav-item')) {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  }
});

// - Fake Call -
let callDelay = 0;
let callTimerInterval = null;
let callSeconds = 0;
let ringtoneCtx = null;
let ringtoneNodes = [];

document.querySelectorAll('.delay-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.delay-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    callDelay = parseInt(btn.dataset.delay);
  });
});

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('callerNameInput').value = btn.dataset.name;
  });
});

document.getElementById('triggerCallBtn').addEventListener('click', () => {
  const name = document.getElementById('callerNameInput').value.trim() || 'Unknown';
  if (callDelay > 0) {
    const btn = document.getElementById('triggerCallBtn');
    let remaining = callDelay;
    btn.textContent = `Calling in ${remaining}s...`;
    btn.disabled = true;
    const countdown = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdown);
        btn.textContent = 'Trigger Fake Call';
        btn.disabled = false;
        showIncomingCall(name);
      } else {
        btn.textContent = `Calling in ${remaining}s...`;
      }
    }, 1000);
  } else {
    showIncomingCall(name);
  }
});

function getCallerEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('mom') || n.includes('mother')) return '\u{1F469}';
  if (n.includes('dad') || n.includes('father')) return '\u{1F468}';
  if (n.includes('doctor') || n.includes('dr'))  return '\u{1F468}\u200D\u2695\uFE0F';
  if (n.includes('boss'))   return '\u{1F4BC}';
  if (n.includes('friend')) return '\u{1F46F}';
  return '\u{1F4F1}';
}

function playRingtone() {
  try {
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    const pattern = [
      { freq: 880, start: 0, dur: 0.15 },
      { freq: 1100, start: 0.2, dur: 0.15 },
      { freq: 880, start: 0.4, dur: 0.15 },
      { freq: 1100, start: 0.6, dur: 0.15 },
    ];
    ringtoneNodes = [];
    function playOnce(offset) {
      pattern.forEach(note => {
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.frequency.value = note.freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ringtoneCtx.currentTime + offset + note.start);
        gain.gain.linearRampToValueAtTime(0.3, ringtoneCtx.currentTime + offset + note.start + 0.02);
        gain.gain.linearRampToValueAtTime(0, ringtoneCtx.currentTime + offset + note.start + note.dur);
        osc.start(ringtoneCtx.currentTime + offset + note.start);
        osc.stop(ringtoneCtx.currentTime + offset + note.start + note.dur + 0.05);
        ringtoneNodes.push(osc);
      });
    }
    for (let i = 0; i < 6; i++) playOnce(i * 1.2);
  } catch (e) { /* audio not supported */ }
}

function stopRingtone() {
  if (ringtoneCtx) {
    try { ringtoneCtx.close(); } catch(e) {}
    ringtoneCtx = null;
    ringtoneNodes = [];
  }
}

function showIncomingCall(name) {
  document.getElementById('callerNameDisplay').textContent = name;
  document.getElementById('callerAvatar').textContent = getCallerEmoji(name);
  document.getElementById('callOverlay').classList.remove('hidden');
  playRingtone();
}

document.getElementById('rejectBtn').addEventListener('click', () => {
  stopRingtone();
  document.getElementById('callOverlay').classList.add('hidden');
});

document.getElementById('acceptBtn').addEventListener('click', () => {
  stopRingtone();
  document.getElementById('callOverlay').classList.add('hidden');
  const name = document.getElementById('callerNameDisplay').textContent;
  document.getElementById('activeCallerName').textContent = name;
  document.getElementById('activeCallerAvatar').textContent = getCallerEmoji(name);
  document.getElementById('activeCallOverlay').classList.remove('hidden');
  callSeconds = 0;
  document.getElementById('callTimer').textContent = '00:00';
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const s = String(callSeconds % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = `${m}:${s}`;
  }, 1000);
});

document.getElementById('endCallBtn').addEventListener('click', () => {
  clearInterval(callTimerInterval);
  document.getElementById('activeCallOverlay').classList.add('hidden');
});

let muteOn = false;
document.getElementById('muteBtn').addEventListener('click', () => {
  muteOn = !muteOn;
  document.getElementById('muteBtn').style.background = muteOn ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)';
});

// - Safe Map -
let map = null;
let mapInitialized = false;
let reportingMode = false;
let markers = [];

// AI Safety Score = (lighting + crowd + timeFactor) / 3
function calcSafetyScore(lighting, crowd, timeFactor) {
  return Math.round(((lighting + crowd + timeFactor) / 3) * 10) / 10;
}

// - Coimbatore dataset -
let nightMode = false;

// Base area data -- street-level Coimbatore locations
const BASE_AREA_DATA = [
  { id: 1,  name: 'Gandhipuram Bus Stand',      lat: 11.0183, lng: 76.9674, lighting: 8, crowd: 9, timeFactor: 7, reason: 'Major transit hub with bright lighting, heavy foot traffic and police presence.' },
  { id: 2,  name: 'RS Puram DB Road',            lat: 11.0089, lng: 76.9510, lighting: 7, crowd: 8, timeFactor: 7, reason: 'Well-lit commercial street with consistent crowd and CCTV coverage.' },
  { id: 3,  name: 'Peelamedu Main Road',         lat: 11.0300, lng: 77.0000, lighting: 7, crowd: 7, timeFactor: 6, reason: 'Active road near airport; moderate lighting and regular traffic.' },
  { id: 4,  name: 'Singanallur Bus Stand',       lat: 11.0015, lng: 77.0290, lighting: 6, crowd: 7, timeFactor: 6, reason: 'Busy local bus stand; decent lighting but less monitored at night.' },
  { id: 5,  name: 'Ukkadam Area',                lat: 10.9925, lng: 76.9610, lighting: 5, crowd: 6, timeFactor: 5, reason: 'Mixed-use area; moderate crowd but inconsistent street lighting.' },
  { id: 6,  name: 'Saibaba Colony',              lat: 11.0270, lng: 76.9440, lighting: 7, crowd: 6, timeFactor: 6, reason: 'Residential colony with decent lighting; quieter after 10 PM.' },
  { id: 7,  name: 'Race Course Road',            lat: 11.0046, lng: 76.9725, lighting: 8, crowd: 7, timeFactor: 7, reason: 'Wide well-lit road with regular police patrolling and good visibility.' },
  { id: 8,  name: 'Town Hall Area',              lat: 10.9980, lng: 76.9620, lighting: 6, crowd: 7, timeFactor: 6, reason: 'Civic area with moderate lighting; crowded during business hours.' },
  { id: 9,  name: 'Kovaipudur Hills',            lat: 10.9400, lng: 76.9300, lighting: 3, crowd: 2, timeFactor: 4, reason: 'Isolated hill outskirts with very poor lighting and minimal foot traffic.' },
  { id: 10, name: 'Perur Temple Road',           lat: 10.9750, lng: 76.9120, lighting: 4, crowd: 3, timeFactor: 4, reason: 'Semi-rural road; poor lighting after dark, low crowd density.' },
  { id: 11, name: 'Hopes College Junction',      lat: 11.0220, lng: 76.9600, lighting: 7, crowd: 8, timeFactor: 7, reason: 'Student-heavy area with good lighting and active crowd during college hours.' },
  { id: 12, name: 'Tidel Park IT Zone',          lat: 11.0350, lng: 77.0100, lighting: 8, crowd: 7, timeFactor: 6, reason: 'IT corridor with good lighting; less crowded late at night.' },
  { id: 13, name: 'Kavundampalayam Road',        lat: 11.0450, lng: 76.9800, lighting: 5, crowd: 5, timeFactor: 5, reason: 'Suburban stretch with average lighting and moderate crowd.' },
  { id: 14, name: 'Podanur Junction',            lat: 10.9800, lng: 76.9750, lighting: 6, crowd: 6, timeFactor: 5, reason: 'Railway junction area; moderate safety, less monitored at night.' },
  { id: 15, name: 'Vadavalli Isolated Lane',     lat: 11.0100, lng: 76.9050, lighting: 2, crowd: 2, timeFactor: 3, reason: 'Very poor lighting, isolated lane with no CCTV and minimal crowd.' },
];

// Generate street-level sub-markers around each base area
function generateSubMarkers(base) {
  const offsets = [
    { dlat:  0.0015, dlng:  0.0010, lAdj: -1, cAdj: -1 },
    { dlat: -0.0012, dlng:  0.0018, lAdj:  0, cAdj: -2 },
    { dlat:  0.0008, dlng: -0.0015, lAdj: -2, cAdj:  0 },
    { dlat: -0.0018, dlng: -0.0008, lAdj: -1, cAdj: -1 },
  ];
  return offsets.map((o, i) => ({
    id: base.id * 100 + i,
    name: base.name + ' - Street ' + (i + 1),
    lat: base.lat + o.dlat,
    lng: base.lng + o.dlng,
    lighting:   Math.min(10, Math.max(1, base.lighting   + o.lAdj)),
    crowd:      Math.min(10, Math.max(1, base.crowd      + o.cAdj)),
    timeFactor: base.timeFactor,
    reason: `Street-level variation near ${base.name}. ${base.reason}`,
    reports: 0,
    isSubMarker: true,
  }));
}

function buildAreaData() {
  const result = [];
  BASE_AREA_DATA.forEach(base => {
    result.push({ ...base, reports: base.reports ?? 0 });
    generateSubMarkers(base).forEach(s => result.push(s));
  });
  return result;
}

let areaData = buildAreaData();

function getScoreLevel(score) {
  if (score >= 7) return 'safe';
  if (score >= 4) return 'medium';
  return 'risky';
}

function getMarkerColor(score) {
  if (score >= 7) return '#22c55e';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
}

function createMarkerIcon(score, small = false) {
  const color = getMarkerColor(score);
  const w = small ? 24 : 36, h = small ? 30 : 44;
  const r = small ? 6 : 9, fs = small ? 8 : 11;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 44">
    <filter id="sh${score}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/></filter>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" filter="url(#sh${score})"/>
    <circle cx="18" cy="18" r="${r}" fill="white" opacity="0.9"/>
    <text x="18" y="23" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${color}">${score}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h]
  });
}

function getEffectiveScore(area) {
  const penalty = (area.reports ?? 0) * 0.5;
  const nightPenalty = nightMode ? 2.5 : 0;
  const raw = calcSafetyScore(area.lighting, area.crowd, area.timeFactor);
  return Math.max(1, Math.round((raw - penalty - nightPenalty) * 10) / 10);
}

function renderAreaPanel(area) {
  const score = getEffectiveScore(area);
  const level = getScoreLevel(score);
  const barColor = getMarkerColor(score);
  const barWidth = (score / 10) * 100;
  document.getElementById('areaInfoContent').innerHTML = `
    <div class="area-info">
      <h3>${area.name}</h3>
      <div class="score-row">
        <span class="score-badge ${level}">Score: ${score}/10</span>
        <span style="color:var(--text-muted);font-size:13px;">${level.charAt(0).toUpperCase()+level.slice(1)} Zone</span>
        ${area.reports > 0 ? `<span style="color:#ef4444;font-size:12px;">${area.reports} report(s)</span>` : ''}
      </div>
      <div class="score-bar-wrap">
        <div class="score-bar-bg">
          <div class="score-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
        </div>
      </div>
      <p class="reason">${area.reason}</p>
      <div class="score-factors">
        <span class="factor-chip">Lighting: ${area.lighting}/10</span>
        <span class="factor-chip">Crowd: ${area.crowd}/10</span>
        <span class="factor-chip">Time Factor: ${area.timeFactor}/10</span>
      </div>
    </div>
  `;
  document.getElementById('areaInfoPanel').classList.remove('hidden');
}

let heatCircles = [];

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  map = L.map('map', { zoomControl: true }).setView([11.0168, 76.9558], 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: 'OpenStreetMap / CARTO',
    maxZoom: 19
  }).addTo(map);

  renderAllMarkers();

  // User location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      const userIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#9575cd;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(149,117,205,0.3)"></div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
      });
      L.marker([latitude, longitude], { icon: userIcon }).addTo(map).bindPopup('You are here');
    }, () => {});
  }

  // Click to report
  map.on('click', e => {
    if (!reportingMode) return;
    const name = document.getElementById('reportAreaName').value.trim() || 'Reported Area';
    const reason = document.getElementById('reportReason').value;
    const newArea = {
      id: Date.now(), name, lat: e.latlng.lat, lng: e.latlng.lng,
      lighting: 2, crowd: 2, timeFactor: 2,
      reason: `User reported: ${reason}`, reports: 0
    };
    areaData.push(newArea);
    addAreaMarker(newArea);
    addHeatCircle(newArea);
    reportingMode = false;
    map.getContainer().style.cursor = '';
    document.getElementById('reportModal').classList.add('hidden');
    showToast('Unsafe area reported and marked on map.');
  });

  // Area jump dropdown
  document.getElementById('areaSelect').addEventListener('change', e => {
    const area = BASE_AREA_DATA.find(a => a.name === e.target.value);
    if (area) map.setView([area.lat, area.lng], 16);
  });

  // Night mode toggle
  document.getElementById('nightModeBtn').addEventListener('click', () => {
    nightMode = !nightMode;
    const btn = document.getElementById('nightModeBtn');
    btn.textContent = nightMode ? 'Day Mode' : 'Night Mode';
    btn.classList.toggle('active', nightMode);
    document.getElementById('map').classList.toggle('night-mode', nightMode);
    document.getElementById('nightBadge').classList.toggle('hidden', !nightMode);
    refreshAllMarkers();
    showToast(nightMode ? 'Night mode: scores reduced.' : 'Day mode restored.');
  });
}

function renderAllMarkers() {
  // Clear existing
  markers.forEach(m => map.removeLayer(m.marker));
  markers = [];
  heatCircles.forEach(c => map.removeLayer(c));
  heatCircles = [];

  areaData.forEach(area => {
    addAreaMarker(area);
    addHeatCircle(area);
  });
}

function refreshAllMarkers() {
  markers.forEach(({ area, marker }) => {
    const score = getEffectiveScore(area);
    marker.setIcon(createMarkerIcon(score, area.isSubMarker));
  });
  heatCircles.forEach(({ area, circle }) => {
    const score = getEffectiveScore(area);
    const color = getMarkerColor(score);
    circle.setStyle({ color, fillColor: color });
  });
}

function addAreaMarker(area) {
  const score = getEffectiveScore(area);
  const marker = L.marker([area.lat, area.lng], {
    icon: createMarkerIcon(score, area.isSubMarker),
    zIndexOffset: area.isSubMarker ? 0 : 100
  }).addTo(map);

  // Tooltip on hover
  marker.bindTooltip(
    `<strong>${area.name}</strong><br/>Score: ${score}/10`,
    { permanent: false, direction: 'top', className: 'safe-tooltip' }
  );

  marker.on('click', () => renderAreaPanel(area));
  markers.push({ area, marker });
}

function addHeatCircle(area) {
  const score = getEffectiveScore(area);
  const color = getMarkerColor(score);
  // Larger radius for main areas, smaller for sub-markers
  const radius = area.isSubMarker ? 60 : 180;
  const intensity = area.isSubMarker ? 0.06 : 0.12;
  const circle = L.circle([area.lat, area.lng], {
    radius,
    color,
    fillColor: color,
    fillOpacity: intensity,
    weight: 0,
    interactive: false
  }).addTo(map);
  heatCircles.push({ area, circle });
}

function refreshMarker(area) {
  const entry = markers.find(m => m.area.id === area.id);
  if (!entry) return;
  const score = getEffectiveScore(area);
  entry.marker.setIcon(createMarkerIcon(score, area.isSubMarker));
  entry.marker.setTooltipContent(`<strong>${area.name}</strong><br/>Score: ${score}/10`);
  const hEntry = heatCircles.find(h => h.area.id === area.id);
  if (hEntry) hEntry.circle.setStyle({ color: getMarkerColor(score), fillColor: getMarkerColor(score) });
}

document.getElementById('closePanelBtn').addEventListener('click', () => {
  document.getElementById('areaInfoPanel').classList.add('hidden');
});

// Report Unsafe
document.getElementById('reportUnsafeBtn').addEventListener('click', () => {
  document.getElementById('reportModal').classList.remove('hidden');
});
document.getElementById('cancelReportBtn').addEventListener('click', () => {
  document.getElementById('reportModal').classList.add('hidden');
  reportingMode = false;
  if (map) map.getContainer().style.cursor = '';
});
document.getElementById('submitReportBtn').addEventListener('click', () => {
  if (!map) { document.getElementById('reportModal').classList.add('hidden'); return; }
  reportingMode = true;
  map.getContainer().style.cursor = 'crosshair';
  document.getElementById('reportModal').classList.add('hidden');
  showToast('Click on the map to mark the unsafe location.');
});

// SOS
document.getElementById('sosBtn').addEventListener('click', () => {
  document.getElementById('sosModal').classList.remove('hidden');
});
const sosMobile = document.getElementById('sosBtnMobile');
if (sosMobile) sosMobile.addEventListener('click', () => {
  document.getElementById('sosModal').classList.remove('hidden');
});
document.getElementById('closeSosBtn').addEventListener('click', () => {
  document.getElementById('sosModal').classList.add('hidden');
});

// Toast
function showToast(msg) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;bottom:32px;left:50%;transform:translateX(-50%);
    background:rgba(255,255,255,0.92);border:1px solid rgba(179,157,219,0.35);color:#1a1025;
    padding:11px 24px;border-radius:999px;font-size:13px;font-weight:500;z-index:9999;
    box-shadow:0 8px 32px rgba(126,87,194,0.2);white-space:nowrap;
    font-family:'Inter',sans-serif;backdrop-filter:blur(16px);
    animation:toastIn 0.3s cubic-bezier(0.22,1,0.36,1);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// - Voice Guard -
const TRIGGER_WORDS = ['help', 'help me', 'danger', 'i am in danger', 'save me'];

let recognition = null;
let isListening = false;

const micBtn       = document.getElementById('micBtn');
const micStatus    = document.getElementById('micStatus');
const micTranscript = document.getElementById('micTranscript');
const micCard      = micBtn.closest('.vg-mic-card');

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';

  r.onresult = e => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript.toLowerCase().trim();
      if (e.results[i].isFinal) final += t + ' ';
      else interim += t;
    }
    const display = (final + interim).trim();
    micTranscript.textContent = display ? `"${display}"` : '';

    const combined = (final + interim).toLowerCase();
    const hit = TRIGGER_WORDS.find(w => combined.includes(w));
    if (hit) triggerEmergency(hit);
  };

  r.onerror = e => {
    if (e.error === 'not-allowed') {
      setMicState('idle');
      showToast('Microphone permission denied.');
    } else if (e.error !== 'no-speech') {
      setMicState('idle');
    }
  };

  r.onend = () => {
    // auto-restart if still supposed to be listening
    if (isListening) { try { r.start(); } catch(_) {} }
  };

  return r;
}

function setMicState(state) {
  micBtn.className = 'mic-btn ' + (state !== 'idle' ? state : '');
  micCard.className = 'vg-mic-card ' + (state !== 'idle' ? state : '');
  micStatus.className = 'mic-status ' + state;
  if (state === 'idle')      { micStatus.textContent = 'Tap to start listening'; micTranscript.textContent = ''; }
  if (state === 'listening') { micStatus.textContent = 'Listening...'; }
  if (state === 'safe')      { micStatus.textContent = 'No threat detected'; }
  if (state === 'emergency') { micStatus.textContent = 'Emergency detected!'; }
}

micBtn.addEventListener('click', () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech Recognition not supported in this browser. Try Chrome.'); return; }
  recognition = setupSpeechRecognition();
  try {
    recognition.start();
    isListening = true;
    setMicState('listening');
  } catch(e) {
    showToast('Could not start microphone. Check permissions.');
  }
}

function stopListening() {
  isListening = false;
  if (recognition) { try { recognition.stop(); } catch(_) {} recognition = null; }
  setMicState('idle');
  micTranscript.textContent = '';
}

// - Emergency Trigger -
function triggerEmergency(word) {
  if (document.getElementById('emergencyOverlay').classList.contains('hidden') === false) return;

  // Stop listening to avoid re-triggering
  isListening = false;
  if (recognition) { try { recognition.stop(); } catch(_) {} recognition = null; }
  setMicState('emergency');

  // Show emergency overlay
  document.getElementById('emergencyWord').textContent = `Detected: "${word}"`;
  document.getElementById('emergencyOverlay').classList.remove('hidden');

  // Play alert sound
  playAlertSound();

  // Danger mode UI
  document.body.classList.add('danger-mode');

  // Trigger fake call after short delay
  setTimeout(() => {
    document.getElementById('callerNameInput').value = 'Emergency Contact';
    showIncomingCall('Emergency Contact');
  }, 1500);

  // Start live tracking
  startLiveTracking(true);

  // Navigate to map after a moment
  setTimeout(() => {
    navigateTo('safemap');
    initMap();
  }, 2000);

  // Simulate sending to emergency contact
  console.log('[SafePath AI] EMERGENCY TRIGGERED');
  console.log('[SafePath AI] Trigger word:', word);
  console.log('[SafePath AI] Simulating location share to emergency contact...');
}

document.getElementById('dismissEmergencyBtn').addEventListener('click', () => {
  document.getElementById('emergencyOverlay').classList.add('hidden');
  document.body.classList.remove('danger-mode');
  stopLiveTracking();
  setMicState('idle');
  if (userCircle) { userCircle.setStyle({ color: '#7c3aed', fillColor: '#7c3aed' }); }
  if (liveUserMarker) {
    liveUserMarker.getElement() && (liveUserMarker.getElement().querySelector('div').className = 'user-location-marker');
  }
});

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beeps = [
      { freq: 1400, start: 0,    dur: 0.12 },
      { freq: 1600, start: 0.15, dur: 0.12 },
      { freq: 1400, start: 0.3,  dur: 0.12 },
      { freq: 1800, start: 0.45, dur: 0.25 },
    ];
    beeps.forEach(b => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = b.freq; osc.type = 'square';
      gain.gain.setValueAtTime(0, ctx.currentTime + b.start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + b.start + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + b.start + b.dur);
      osc.start(ctx.currentTime + b.start);
      osc.stop(ctx.currentTime + b.start + b.dur + 0.05);
    });
    setTimeout(() => { try { ctx.close(); } catch(_) {} }, 2000);
  } catch(e) {}
}

// - Live Location Tracking (shared engine) -
let liveUserMarker  = null;
let userCircle      = null;
let watchId         = null;
let locationLog     = [];

// - Live Track page state -
let ltMap           = null;
let ltMapInit       = false;
let ltMarker        = null;
let ltAccCircle     = null;
let ltTrailCoords   = [];
let ltTrailLine     = null;
let ltTracking      = false;
let ltLastZoneAlert = null;   // area id of last alerted zone (avoid repeat)
let ltDemoInterval  = null;

// - Shared helpers -
function setLtStatus(on) {
  ltTracking = on;
  const pill = document.getElementById('ltStatusPill');
  const dot  = pill ? pill.querySelector('.lt-status-dot') : null;
  const txt  = document.getElementById('ltStatusText');
  if (dot) { dot.className = 'lt-status-dot ' + (on ? 'on' : 'off'); }
  if (txt) txt.textContent = on ? 'Tracking ON' : 'Tracking OFF';
  const startBtn = document.getElementById('startTrackBtn');
  const stopBtn  = document.getElementById('stopTrackBtn');
  const shareBtn = document.getElementById('shareLocationBtn');
  if (startBtn) startBtn.disabled = on;
  if (stopBtn)  stopBtn.disabled  = !on;
  if (shareBtn) shareBtn.disabled = !on;
}

function updateCoordDisplay(lat, lng, accuracy) {
  const el = id => document.getElementById(id);
  if (el('ltLat'))      el('ltLat').textContent      = lat.toFixed(6);
  if (el('ltLng'))      el('ltLng').textContent      = lng.toFixed(6);
  if (el('ltAccuracy')) el('ltAccuracy').textContent = accuracy ? '+/-' + Math.round(accuracy) + 'm' : '--';
  if (el('ltPoints'))   el('ltPoints').textContent   = ltTrailCoords.length;
  // also update voice guard tracking card if visible
  if (el('trackingCoords')) el('trackingCoords').textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
}

function checkZoneAlert(lat, lng) {
  const risky = areaData.find(a => {
    if (a.isSubMarker) return false;
    const d = Math.sqrt(
      Math.pow((a.lat - lat) * 111000, 2) +
      Math.pow((a.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
    );
    return d < 350 && getEffectiveScore(a) < 4;
  });
  const alertEl = document.getElementById('ltZoneAlert');
  if (risky && risky.id !== ltLastZoneAlert) {
    ltLastZoneAlert = risky.id;
    if (alertEl) {
      document.getElementById('ltZoneMsg').textContent =
        `"${risky.name}" has a safety score of ${getEffectiveScore(risky)}/10. ${risky.reason}`;
      alertEl.classList.remove('hidden');
    }
    showToast('Warning: Low safety zone - ' + risky.name);
  } else if (!risky) {
    ltLastZoneAlert = null;
    if (alertEl) alertEl.classList.add('hidden');
  }
}

function addToHistory(lat, lng) {
  const time = new Date().toLocaleTimeString();
  locationLog.unshift({ lat, lng, time });
  if (locationLog.length > 20) locationLog.pop();

  const el = document.getElementById('ltHistory');
  if (!el) return;
  el.innerHTML = locationLog.map((l, i) => `
    <div class="lt-history-item ${i === 0 ? 'latest' : ''}">
      <span class="lt-hi-time">${l.time}</span>
      <span class="lt-hi-coords">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</span>
      ${i === 0 ? '<span class="lt-hi-badge">Latest</span>' : ''}
    </div>
  `).join('');

  // also update voice guard history
  const vgEl = document.getElementById('locationHistory');
  if (vgEl) {
    vgEl.innerHTML = locationLog.slice(0, 5).map(l =>
      `<div class="location-history-item">${l.time} - ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</div>`
    ).join('');
  }
}

function updateLiveLocation(lat, lng, accuracy) {
  updateCoordDisplay(lat, lng, accuracy);
  addToHistory(lat, lng);
  checkZoneAlert(lat, lng);
  console.log(`[SafePath AI] Live location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

  // - Update main safe map marker -
  if (map) {
    if (!liveUserMarker) {
      const icon = L.divIcon({
        html: `<div class="user-location-marker ${document.body.classList.contains('danger-mode') ? 'danger' : ''}"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      liveUserMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
      liveUserMarker.bindPopup('Your live location');
    } else {
      liveUserMarker.setLatLng([lat, lng]);
    }
    const r = accuracy || 80;
    if (!userCircle) {
      userCircle = L.circle([lat, lng], {
        radius: r, color: '#9575cd', fillColor: '#9575cd',
        fillOpacity: 0.1, weight: 2, dashArray: '5 4'
      }).addTo(map);
    } else {
      userCircle.setLatLng([lat, lng]);
      userCircle.setRadius(r);
    }
    if (document.body.classList.contains('danger-mode')) map.panTo([lat, lng]);
  }

  // - Update Live Track page map -
  if (ltMap) {
    ltTrailCoords.push([lat, lng]);

    if (!ltMarker) {
      const icon = L.divIcon({
        html: `<div class="lt-live-dot"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      ltMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(ltMap);
      ltMarker.bindPopup('You are here');
    } else {
      ltMarker.setLatLng([lat, lng]);
    }

    const r = accuracy || 60;
    if (!ltAccCircle) {
      ltAccCircle = L.circle([lat, lng], {
        radius: r, color: '#9575cd', fillColor: '#9575cd',
        fillOpacity: 0.12, weight: 1.5, dashArray: '4 3'
      }).addTo(ltMap);
    } else {
      ltAccCircle.setLatLng([lat, lng]);
      ltAccCircle.setRadius(r);
    }

    // Draw / update trail polyline
    if (ltTrailCoords.length > 1) {
      if (ltTrailLine) ltMap.removeLayer(ltTrailLine);
      ltTrailLine = L.polyline(ltTrailCoords, {
        color: '#9575cd', weight: 3, opacity: 0.7,
        lineJoin: 'round', lineCap: 'round'
      }).addTo(ltMap);
    }

    ltMap.panTo([lat, lng]);
  }
}

function initLtMap() {
  if (ltMapInit) return;
  ltMapInit = true;
  ltMap = L.map('ltMap', { zoomControl: true, attributionControl: false })
    .setView([11.0168, 76.9558], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(ltMap);
}

function startLiveTracking(fromEmergency = false) {
  // Init lt map if on that page
  if (document.getElementById('page-livetrack').classList.contains('active')) initLtMap();

  setLtStatus(true);
  locationLog = [];
  ltTrailCoords = [];

  // Show voice guard tracking card
  const tc = document.getElementById('trackingCard');
  if (tc) tc.classList.remove('hidden');

  if (!navigator.geolocation) {
    showToast('Location services not supported on this device.');
    simulateDemoTracking();
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    pos => updateLiveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    err => {
      if (err.code === 1) {
        showToast('Location permission denied. Running in demo mode.');
      } else {
        showToast('Unable to get location. Running in demo mode.');
      }
      simulateDemoTracking();
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );

  if (fromEmergency) {
    showToast('Live location is being tracked for safety.');
    simulateShareLocation();
  }
}

function stopLiveTracking() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (ltDemoInterval)   { clearInterval(ltDemoInterval); ltDemoInterval = null; }
  setLtStatus(false);

  const tc = document.getElementById('trackingCard');
  if (tc) tc.classList.add('hidden');

  if (liveUserMarker && map) { map.removeLayer(liveUserMarker); liveUserMarker = null; }
  if (userCircle && map)     { map.removeLayer(userCircle);     userCircle = null; }
  // keep lt map markers so user can review trail
}

function simulateDemoTracking() {
  if (ltDemoInterval) return;
  let baseLat = 11.0168, baseLng = 76.9558, tick = 0;
  // Walk toward Kovaipudur (risky zone) to demo zone alert
  const path = [
    [11.0168, 76.9558], [11.0100, 76.9450], [11.0000, 76.9380],
    [10.9800, 76.9300], [10.9600, 76.9300], [10.9400, 76.9300],
  ];
  ltDemoInterval = setInterval(() => {
    if (!ltTracking) { clearInterval(ltDemoInterval); ltDemoInterval = null; return; }
    const pt = path[tick % path.length];
    const lat = pt[0] + (Math.random() - 0.5) * 0.0005;
    const lng = pt[1] + (Math.random() - 0.5) * 0.0005;
    updateLiveLocation(lat, lng, 45);
    tick++;
  }, 4000);
}

function simulateShareLocation() {
  const last = locationLog[0];
  if (!last) return;
  console.log('[SafePath AI] LOCATION SHARED WITH EMERGENCY CONTACT');
  console.log(`[SafePath AI] Coordinates: ${last.lat.toFixed(6)}, ${last.lng.toFixed(6)}`);
  console.log(`[SafePath AI] Time: ${last.time}`);
  showToast('Location shared with emergency contact (demo).');
}

// - Live Track page button wiring -
document.getElementById('startTrackBtn').addEventListener('click', () => {
  if (document.getElementById('page-livetrack').classList.contains('active')) initLtMap();
  startLiveTracking();
});

document.getElementById('stopTrackBtn').addEventListener('click', () => {
  stopLiveTracking();
  document.body.classList.remove('danger-mode');
});

document.getElementById('shareLocationBtn').addEventListener('click', () => {
  simulateShareLocation();
});

document.getElementById('clearTrailBtn').addEventListener('click', () => {
  ltTrailCoords = [];
  locationLog = [];
  if (ltTrailLine && ltMap) { ltMap.removeLayer(ltTrailLine); ltTrailLine = null; }
  const el = document.getElementById('ltHistory');
  if (el) el.innerHTML = '<p class="lt-history-empty">Trail cleared.</p>';
  if (document.getElementById('ltPoints')) document.getElementById('ltPoints').textContent = '0';
});

document.getElementById('ltZoneClose').addEventListener('click', () => {
  document.getElementById('ltZoneAlert').classList.add('hidden');
});

// Init lt map when navigating to livetrack page
const _origNavigateTo = navigateTo;
// patch navigateTo to also init ltMap
const _navLinks2 = document.querySelectorAll('.nav-link');
_navLinks2.forEach(link => {
  // already wired -- handled via navigateTo which calls initLtMap check inside startLiveTracking
});

// Init lt map on page visit even without tracking
document.querySelectorAll('[data-page="livetrack"]').forEach(el => {
  el.addEventListener('click', () => {
    setTimeout(() => { if (!ltMapInit) initLtMap(); }, 100);
  });
});

// Voice guard stop tracking button
document.getElementById('stopTrackingBtn').addEventListener('click', () => {
  stopLiveTracking();
  document.body.classList.remove('danger-mode');
});

// - Safest Route Finder -
let routeLayers = [];   // drawn polylines
let routeMarkers = [];  // start/end markers

// Geocode an area name -> {lat, lng} using Nominatim (free, no key needed)
async function geocode(query) {
  // First check if it matches a known area
  const known = BASE_AREA_DATA.find(a => a.name.toLowerCase() === query.toLowerCase().trim());
  if (known) return { lat: known.lat, lng: known.lng, name: known.name };

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Coimbatore, Tamil Nadu')}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
  } catch { return null; }
}

// Fetch route geometry from OSRM (free, no key)
// alternatives=true returns up to 3 routes
async function fetchRoutes(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=true`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok') return [];
    return data.routes; // array of route objects
  } catch { return []; }
}

// Score a route by checking safety of nearby area markers along the path
function scoreRoute(routeCoords) {
  // routeCoords: array of [lng, lat] from GeoJSON
  // Sample every Nth point to keep it fast
  const step = Math.max(1, Math.floor(routeCoords.length / 20));
  const sampled = routeCoords.filter((_, i) => i % step === 0);

  let totalScore = 0, count = 0;
  sampled.forEach(([lng, lat]) => {
    // Find nearest area markers within 600m
    const nearby = areaData.filter(a => {
      const d = Math.sqrt(Math.pow((a.lat - lat) * 111000, 2) + Math.pow((a.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180), 2));
      return d < 600;
    });
    if (nearby.length > 0) {
      const avg = nearby.reduce((s, a) => s + getEffectiveScore(a), 0) / nearby.length;
      totalScore += avg;
      count++;
    }
  });
  return count > 0 ? Math.round((totalScore / count) * 10) / 10 : 5.0;
}

// Check if route passes through risky zones
function hasRiskySegments(routeCoords) {
  const step = Math.max(1, Math.floor(routeCoords.length / 20));
  return routeCoords.filter((_, i) => i % step === 0).some(([lng, lat]) => {
    return areaData.some(a => {
      const d = Math.sqrt(Math.pow((a.lat - lat) * 111000, 2) + Math.pow((a.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180), 2));
      return d < 400 && getEffectiveScore(a) < 4;
    });
  });
}

function clearRouteDisplay() {
  routeLayers.forEach(l => map && map.removeLayer(l));
  routeLayers = [];
  routeMarkers.forEach(m => map && map.removeLayer(m));
  routeMarkers = [];
  document.getElementById('routeResult').classList.add('hidden');
  document.getElementById('routeResult').innerHTML = '';
}

function metersToKm(m) { return (m / 1000).toFixed(1); }
function secondsToMin(s) { return Math.round(s / 60); }

function routeColor(score) {
  if (score >= 7) return '#43a047';   // green
  if (score >= 4) return '#fb8c00';   // amber
  return '#e53935';                   // red
}

function drawRoute(coords, color, weight = 5, opacity = 0.85, dash = null) {
  const latlngs = coords.map(([lng, lat]) => [lat, lng]);
  const opts = { color, weight, opacity, lineJoin: 'round', lineCap: 'round' };
  if (dash) opts.dashArray = dash;
  const line = L.polyline(latlngs, opts).addTo(map);
  routeLayers.push(line);
  return line;
}

function placeEndpointMarker(lat, lng, emoji, label) {
  const icon = L.divIcon({
    html: `<div style="background:rgba(255,255,255,0.9);border:2px solid #b39ddb;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 14px rgba(149,117,205,0.35);backdrop-filter:blur(8px)">${emoji}</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16]
  });
  const m = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);
  routeMarkers.push(m);
}

async function findSafestRoute() {
  const fromVal = document.getElementById('routeFrom').value.trim();
  const toVal   = document.getElementById('routeTo').value.trim();
  const preferSafety = document.getElementById('preferSafety').checked;

  if (!fromVal || !toVal) { showToast('Please enter both From and To locations.'); return; }

  const btn = document.getElementById('findRouteBtn');
  btn.textContent = 'Finding route...';
  btn.disabled = true;

  clearRouteDisplay();

  // Geocode both ends
  const [from, to] = await Promise.all([geocode(fromVal), geocode(toVal)]);
  if (!from) { showToast('Could not find "From" location. Try a known area name.'); btn.textContent = 'Find Safest Route'; btn.disabled = false; return; }
  if (!to)   { showToast('Could not find "To" location. Try a known area name.');   btn.textContent = 'Find Safest Route'; btn.disabled = false; return; }

  // Fetch routes
  const routes = await fetchRoutes(from.lat, from.lng, to.lat, to.lng);
  if (routes.length === 0) { showToast('No route found between these locations.'); btn.textContent = 'Find Safest Route'; btn.disabled = false; return; }

  // Score each route
  const scored = routes.map(r => ({
    ...r,
    safetyScore: scoreRoute(r.geometry.coordinates),
    risky: hasRiskySegments(r.geometry.coordinates),
  }));

  // Sort: if preferSafety -> highest safety score first; else shortest distance first
  scored.sort((a, b) => preferSafety
    ? b.safetyScore - a.safetyScore
    : a.distance - b.distance
  );

  const best = scored[0];

  // Draw non-best routes as faded dashed lines
  scored.slice(1).forEach(r => {
    drawRoute(r.geometry.coordinates, '#bdbdbd', 4, 0.5, '8 6');
  });

  // Draw best route with color based on its safety score
  const color = routeColor(best.safetyScore);
  drawRoute(best.geometry.coordinates, color, 6, 0.92);

  // Endpoint markers
  placeEndpointMarker(from.lat, from.lng, 'S', '<strong>Start</strong><br/>' + fromVal);
  placeEndpointMarker(to.lat, to.lng,   'D', '<strong>Destination</strong><br/>' + toVal);

  // Fit map to route
  const bounds = L.latLngBounds(best.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
  map.fitBounds(bounds, { padding: [40, 40] });

  // Build result panel
  const level = getScoreLevel(best.safetyScore);
  const levelLabel = level === 'safe' ? 'Safe Route' : level === 'medium' ? 'Moderate Route' : 'Risky Route';
  const safetyMsg = best.safetyScore >= 7
    ? 'This route passes through well-lit, crowded areas with good safety scores.'
    : best.safetyScore >= 4
    ? 'This route has moderate safety. Stay alert in some stretches.'
    : 'Caution: This route includes areas with low lighting and sparse crowd.';

  const warningHtml = best.risky
    ? `<div class="route-warning">Caution: This route includes low safety areas. Consider travelling with company.</div>`
    : '';

  const altHtml = scored.length > 1
    ? `<div class="route-alt-note">${scored.length} route(s) analysed &mdash; showing ${preferSafety ? 'safest' : 'shortest'}.</div>`
    : '';

  document.getElementById('routeResult').innerHTML = `
    <div class="route-result-inner">
      <div class="route-result-badge ${level}">${levelLabel}</div>
      <div class="route-stats">
        <div class="route-stat"><span class="rs-val">${metersToKm(best.distance)} km</span><span class="rs-lbl">Distance</span></div>
        <div class="route-stat"><span class="rs-val">${secondsToMin(best.duration)} min</span><span class="rs-lbl">Est. Time</span></div>
        <div class="route-stat"><span class="rs-val">${best.safetyScore}/10</span><span class="rs-lbl">Safety Score</span></div>
      </div>
      <p class="route-msg">${safetyMsg}</p>
      ${warningHtml}
      ${altHtml}
    </div>
  `;
  document.getElementById('routeResult').classList.remove('hidden');

  // Voice output
  if ('speechSynthesis' in window) {
    const msg = best.safetyScore >= 7
      ? 'Safe route selected. Have a safe journey.'
      : best.safetyScore >= 4
      ? 'Moderate route selected. Please stay alert.'
      : 'Warning. This route passes through risky areas. Please be careful.';
    const utt = new SpeechSynthesisUtterance(msg);
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }

  btn.textContent = 'Find Safest Route';
  btn.disabled = false;
}

// Wire up buttons after map is ready
document.getElementById('findRouteBtn').addEventListener('click', () => {
  if (!map) { navigateTo('safemap'); setTimeout(findSafestRoute, 600); return; }
  findSafestRoute();
});

document.getElementById('clearRouteBtn').addEventListener('click', () => {
  clearRouteDisplay();
  document.getElementById('routeFrom').value = '';
  document.getElementById('routeTo').value = '';
});

document.getElementById('useMyLocationBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { showToast('Geolocation not supported.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('routeFrom').value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
    showToast('Current location set as starting point.');
  }, () => {
    document.getElementById('routeFrom').value = 'Gandhipuram Bus Stand';
    showToast('Demo: using Gandhipuram as start.');
  });
});

// Collapse / expand route card
document.getElementById('routeToggleBtn').addEventListener('click', () => {
  const body = document.getElementById('routeCardBody');
  const btn  = document.getElementById('routeToggleBtn');
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  btn.textContent = collapsed ? 'Collapse' : 'Expand';
});

// - Virtual Guardian Mode -
let gmActive        = false;
let gmSelectedMins  = 5;
let gmTotalSecs     = 0;
let gmRemainingSecs = 0;
let gmInterval      = null;
let gmCheckInterval = null;
let gmCheckSecs     = 10;
const GM_CIRCUMFERENCE = 2 * Math.PI * 52; // matches r="52" in SVG

// - Time option buttons -
document.querySelectorAll('.gm-time-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gm-time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gmSelectedMins = parseInt(btn.dataset.mins);
  });
});

// - Start -
document.getElementById('gmStartBtn').addEventListener('click', () => {
  gmActive        = true;
  gmTotalSecs     = gmSelectedMins * 60;
  gmRemainingSecs = gmTotalSecs;

  // UI swap
  document.getElementById('gmSetupCard').classList.add('hidden');
  document.getElementById('gmActiveCard').classList.remove('hidden');

  // Status pill
  setGmStatus('active');

  // Record start time
  document.getElementById('gmStartTime').textContent = new Date().toLocaleTimeString();

  // Start live location
  startLiveTracking();
  gmUpdateLocation();

  // Init ring
  const ring = document.getElementById('gmRingFill');
  ring.style.strokeDasharray  = GM_CIRCUMFERENCE;
  ring.style.strokeDashoffset = 0;

  gmLog('Guardian Mode started -- ' + gmSelectedMins + ' min timer.');
  showToast('Guardian Mode activated. Watching over you.');

  // Tick every second
  gmInterval = setInterval(gmTick, 1000);
});

// - Stop -
document.getElementById('gmStopBtn').addEventListener('click', gmStop);

function gmStop() {
  clearInterval(gmInterval);
  clearInterval(gmCheckInterval);
  gmActive = false;
  stopLiveTracking();
  document.body.classList.remove('danger-mode');
  document.getElementById('gmActiveCard').classList.add('hidden');
  document.getElementById('gmSetupCard').classList.remove('hidden');
  document.getElementById('guardianCheckModal').classList.add('hidden');
  setGmStatus('inactive');
  gmLog('Guardian Mode stopped.');
  showToast('Guardian Mode deactivated.');
}

// - Tick -
function gmTick() {
  gmRemainingSecs--;
  gmUpdateTimer();
  gmUpdateLocation();

  if (gmRemainingSecs <= 0) {
    clearInterval(gmInterval);
    gmLog('Timer ended -- showing safety check.');
    gmShowSafetyCheck();
  }
}

// - Update circular timer display -
function gmUpdateTimer() {
  const m = String(Math.floor(gmRemainingSecs / 60)).padStart(2, '0');
  const s = String(gmRemainingSecs % 60).padStart(2, '0');
  document.getElementById('gmTimerDisplay').textContent = m + ':' + s;

  const progress  = gmRemainingSecs / gmTotalSecs;
  const offset    = GM_CIRCUMFERENCE * (1 - progress);
  const ring      = document.getElementById('gmRingFill');
  ring.style.strokeDashoffset = offset;

  // Colour shift: green -> amber -> red as time runs out
  if (progress > 0.5)      ring.style.stroke = '#9575cd';
  else if (progress > 0.2) ring.style.stroke = '#ffd43b';
  else                     ring.style.stroke = '#ff6b6b';
}

// - Update location display -
function gmUpdateLocation() {
  if (locationLog.length > 0) {
    const l = locationLog[0];
    document.getElementById('gmLocation').textContent =
      l.lat.toFixed(4) + ', ' + l.lng.toFixed(4);
    document.getElementById('gmSafetyStatus').textContent = 'Tracking';
  }
}

// - Safety check popup -
function gmShowSafetyCheck() {
  gmCheckSecs = 10;
  document.getElementById('gcCountdown').textContent = gmCheckSecs;
  document.getElementById('guardianCheckModal').classList.remove('hidden');
  gmLog('Safety check: "Are you safe?" shown.');

  gmCheckInterval = setInterval(() => {
    gmCheckSecs--;
    document.getElementById('gcCountdown').textContent = gmCheckSecs;
    if (gmCheckSecs <= 0) {
      clearInterval(gmCheckInterval);
      document.getElementById('guardianCheckModal').classList.add('hidden');
      gmLog('No response -- triggering emergency!');
      gmTriggerEmergency();
    }
  }, 1000);
}

// - User confirms safe -
document.getElementById('gcYesBtn').addEventListener('click', () => {
  clearInterval(gmCheckInterval);
  document.getElementById('guardianCheckModal').classList.add('hidden');
  gmLog('User confirmed safe. Guardian Mode ended.');
  gmStop();
  showToast('Great! Stay safe out there.');
});

// - Emergency trigger -
function gmTriggerEmergency() {
  gmLog('EMERGENCY: Auto-triggered. Activating fake call + live tracking.');
  document.body.classList.add('danger-mode');
  setGmStatus('emergency');
  document.getElementById('gmSafetyStatus').textContent = 'EMERGENCY';

  // Reuse existing emergency system
  document.getElementById('emergencyWord').textContent = 'Guardian Mode: No response detected';
  document.getElementById('emergencyOverlay').classList.remove('hidden');
  playAlertSound();
  startLiveTracking(true);

  setTimeout(() => {
    document.getElementById('callerNameInput').value = 'Emergency Contact';
    showIncomingCall('Emergency Contact');
  }, 1500);

  console.log('[SafePath AI] GUARDIAN EMERGENCY TRIGGERED');
  console.log('[SafePath AI] Last location:', locationLog[0] || 'unknown');
}

// - Status pill helper -
function setGmStatus(state) {
  const dot  = document.getElementById('gmStatusDot');
  const text = document.getElementById('gmStatusText');
  dot.className  = 'gm-status-dot ' + state;
  if (state === 'active')    { text.textContent = 'Active'; }
  if (state === 'inactive')  { text.textContent = 'Inactive'; }
  if (state === 'emergency') { text.textContent = 'EMERGENCY'; }
}

// - Activity log -
function gmLog(msg) {
  const el = document.getElementById('gmLog');
  const empty = el.querySelector('.gm-log-empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = 'gm-log-item';
  item.innerHTML =
    '<span class="gm-log-time">' + new Date().toLocaleTimeString() + '</span>' +
    '<span class="gm-log-msg">' + msg + '</span>';
  el.insertBefore(item, el.firstChild);
}

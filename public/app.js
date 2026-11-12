const state = {
  isRecording: false,
  ws: null,
  recognition: null,
  audioContext: null,
  mediaStream: null,
  analyser: null,
  scriptProcessor: null,
  rafId: null,
  timerInterval: null,
  startTimeMs: 0,
  elapsedSeconds: 0,
  records: [],
};

const els = {
  dbStatusBadge: document.getElementById('dbStatusBadge'),
  wsStatusBadge: document.getElementById('wsStatusBadge'),
  kpiTotal: document.getElementById('kpiTotal'),
  kpiDuration: document.getElementById('kpiDuration'),
  kpiStarred: document.getElementById('kpiStarred'),
  kpiEngine: document.getElementById('kpiEngine'),
  languageSelect: document.getElementById('languageSelect'),
  providerSelect: document.getElementById('providerSelect'),
  recordBtn: document.getElementById('recordBtn'),
  recordBtnLabel: document.getElementById('recordBtnLabel'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  timerDisplay: document.getElementById('timerDisplay'),
  liveTitleInput: document.getElementById('liveTitleInput'),
  liveTextArea: document.getElementById('liveTextArea'),
  interimLine: document.getElementById('interimLine'),
  autoSaveToggle: document.getElementById('autoSaveToggle'),
  clearLiveBtn: document.getElementById('clearLiveBtn'),
  saveLiveBtn: document.getElementById('saveLiveBtn'),
  newManualBtn: document.getElementById('newManualBtn'),
  searchInput: document.getElementById('searchInput'),
  filterProvider: document.getElementById('filterProvider'),
  filterStarred: document.getElementById('filterStarred'),
  historyList: document.getElementById('historyList'),
  crudModal: document.getElementById('crudModal'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  crudForm: document.getElementById('crudForm'),
  modalRecordId: document.getElementById('modalRecordId'),
  modalTitleInput: document.getElementById('modalTitleInput'),
  modalLanguageInput: document.getElementById('modalLanguageInput'),
  modalTextInput: document.getElementById('modalTextInput'),
  toastContainer: document.getElementById('toastContainer'),
};

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function formatDuration(totalSec) {
  const sec = Math.max(0, Number(totalSec) || 0);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const ok = data.database === 'connected';
    els.dbStatusBadge.textContent = ok ? 'DB: PostgreSQL Connected' : `DB: ${data.database}`;
    els.dbStatusBadge.className = `pill ${ok ? 'pill-ok' : 'pill-warn'}`;

    if (data.sttCapabilities?.geminiLiveConfigured) {
      els.providerSelect.value = 'gemini-live-3.1';
      els.kpiEngine.textContent = 'Gemini Live 3.1';
    }
  } catch {
    els.dbStatusBadge.textContent = 'DB: Offline';
    els.dbStatusBadge.className = 'pill pill-warn';
  }
}

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws/transcribe`);
  state.ws = ws;

  ws.onopen = () => {
    els.wsStatusBadge.textContent = 'WS: Connected';
    els.wsStatusBadge.className = 'pill pill-ok';
  };

  ws.onclose = () => {
    els.wsStatusBadge.textContent = 'WS: Reconnecting...';
    els.wsStatusBadge.className = 'pill pill-warn';
    setTimeout(connectWebSocket, 2500);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'interim') {
      els.interimLine.textContent = msg.text ? `Listening: ${msg.text}` : '';
    } else if (msg.type === 'final') {
      els.interimLine.textContent = '';
      if (msg.provider === 'gemini-live-3.1' && msg.text) {
        const current = els.liveTextArea.innerText.trim();
        els.liveTextArea.innerText = current ? `${current} ${msg.text}` : msg.text;
      }
    } else if (msg.type === 'saved') {
      showToast('Transcription saved to PostgreSQL.');
      loadHistory();
      loadStats();
    } else if (msg.type === 'warning' || msg.type === 'error') {
      showToast(msg.message);
    }
  };
}

function sendWs(payload) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function drawWaveform() {
  const canvas = els.waveformCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.analyser || !state.isRecording) {
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    return;
  }

  const bufferLength = state.analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  state.analyser.getByteTimeDomainData(dataArray);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath();
  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i += 1) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  state.rafId = requestAnimationFrame(drawWaveform);
}

async function startRecording() {
  const provider = els.providerSelect.value;
  const language = els.languageSelect.value;
  els.kpiEngine.textContent =
    provider === 'gemini-live-3.1' ? 'Gemini Live 3.1' : 'Browser Live STT';

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    const source = state.audioContext.createMediaStreamSource(state.mediaStream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    source.connect(state.analyser);

    sendWs({ type: 'start', provider, language });

    if (provider === 'gemini-live-3.1') {
      const processor = state.audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!state.isRecording) return;
        const pcmBase64 = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
        sendWs({ type: 'audio', data: pcmBase64, mimeType: 'audio/pcm;rate=16000' });
      };
      source.connect(processor);
      processor.connect(state.audioContext.destination);
      state.scriptProcessor = processor;
    } else {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast('Web Speech API not supported in this browser. Use Chrome or Gemini Live.');
      } else {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'hi-IN / en-IN' ? 'en-IN' : language;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const current = els.liveTextArea.innerText.trim();
              els.liveTextArea.innerText = current
                ? `${current} ${transcript.trim()}`
                : transcript.trim();
              sendWs({ type: 'transcript_chunk', text: transcript.trim(), isFinal: true });
            } else {
              interim += transcript;
            }
          }
          els.interimLine.textContent = interim ? `Listening: ${interim}` : '';
          if (interim) {
            sendWs({ type: 'transcript_chunk', text: interim, isFinal: false });
          }
        };

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech') {
            showToast(`Speech recognition error: ${e.error}`);
          }
        };

        recognition.onend = () => {
          if (state.isRecording) {
            recognition.start();
          }
        };

        recognition.start();
        state.recognition = recognition;
      }
    }

    state.isRecording = true;
    state.startTimeMs = Date.now();
    state.elapsedSeconds = 0;
    els.recordBtn.classList.add('recording');
    els.recordBtnLabel.textContent = 'Stop Recording';
    els.timerInterval = setInterval(() => {
      state.elapsedSeconds = Math.floor((Date.now() - state.startTimeMs) / 1000);
      els.timerDisplay.textContent = formatDuration(state.elapsedSeconds);
    }, 500);
    drawWaveform();
  } catch (err) {
    showToast(`Microphone error: ${err.message}`);
  }
}

function stopRecording() {
  state.isRecording = false;
  els.recordBtn.classList.remove('recording');
  els.recordBtnLabel.textContent = 'Start Recording';
  els.interimLine.textContent = '';

  clearInterval(state.timerInterval);
  cancelAnimationFrame(state.rafId);

  if (state.recognition) {
    state.recognition.onend = null;
    state.recognition.stop();
    state.recognition = null;
  }
  if (state.scriptProcessor) {
    state.scriptProcessor.disconnect();
    state.scriptProcessor = null;
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((t) => t.stop());
    state.mediaStream = null;
  }

  drawWaveform();

  const finalText = els.liveTextArea.innerText.trim();
  sendWs({
    type: 'stop',
    autoSave: els.autoSaveToggle.checked,
    title: els.liveTitleInput.value.trim(),
    finalText,
    durationSeconds: state.elapsedSeconds,
  });
}

async function saveLiveTranscript() {
  const text = els.liveTextArea.innerText.trim();
  if (!text) {
    showToast('Nothing to save yet.');
    return;
  }
  const res = await fetch('/api/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: els.liveTitleInput.value.trim(),
      transcriptText: text,
      primaryLanguage: els.languageSelect.value,
      durationSeconds: state.elapsedSeconds,
      sttProvider: els.providerSelect.value,
    }),
  });
  const data = await res.json();
  if (data.success) {
    showToast('Saved to PostgreSQL.');
    loadHistory();
    loadStats();
  } else {
    showToast(data.error || 'Failed to save.');
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/transcriptions/stats');
    const json = await res.json();
    if (json.success) {
      els.kpiTotal.textContent = json.data.total_count;
      els.kpiDuration.textContent = formatDuration(json.data.total_duration_seconds);
      els.kpiStarred.textContent = json.data.starred_count;
    }
  } catch {
    // Ignore when DB is offline
  }
}

async function loadHistory() {
  const params = new URLSearchParams();
  if (els.searchInput.value.trim()) params.set('q', els.searchInput.value.trim());
  if (els.filterProvider.value) params.set('provider', els.filterProvider.value);
  if (els.filterStarred.checked) params.set('starred', 'true');

  try {
    const res = await fetch(`/api/transcriptions?${params.toString()}`);
    const json = await res.json();
    state.records = json.data || [];
    renderHistory();
  } catch {
    els.historyList.innerHTML =
      '<div class="empty-state">Unable to load history. Check database connection.</div>';
  }
}

function renderHistory() {
  if (!state.records.length) {
    els.historyList.innerHTML =
      '<div class="empty-state">No transcriptions found. Record or create one above!</div>';
    return;
  }

  els.historyList.innerHTML = state.records
    .map(
      (item) => `
      <article class="history-item" data-id="${item.id}">
        <div class="history-item-top">
          <div>
            <div class="history-title">${escapeHtml(item.title)}</div>
            <div class="meta-badges">
              <span class="badge">${escapeHtml(item.primary_language)}</span>
              <span class="badge">${escapeHtml(item.stt_provider)}</span>
              <span class="badge">${formatDuration(item.duration_seconds)}</span>
              <span class="badge">${new Date(item.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div class="history-actions">
            <button class="btn btn-ghost btn-sm" onclick="toggleStar(${item.id}, ${!item.is_starred})">
              ${item.is_starred ? '★ Starred' : '☆ Star'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="copyRecord(${item.id})">Copy</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal(${item.id})">Edit</button>
            <button class="btn btn-danger-ghost btn-sm" onclick="deleteRecord(${item.id})">Delete</button>
          </div>
        </div>
        <p class="history-text">${escapeHtml(item.transcript_text)}</p>
      </article>
    `
    )
    .join('');
}

window.toggleStar = async (id, nextStarred) => {
  await fetch(`/api/transcriptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_starred: nextStarred }),
  });
  loadHistory();
  loadStats();
};

window.copyRecord = async (id) => {
  const item = state.records.find((r) => r.id === id);
  if (!item) return;
  await navigator.clipboard.writeText(item.transcript_text);
  showToast('Copied transcript to clipboard.');
};

window.deleteRecord = async (id) => {
  if (!confirm('Delete this transcription permanently?')) return;
  const res = await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (json.success) {
    showToast('Transcription deleted.');
    loadHistory();
    loadStats();
  }
};

window.openEditModal = (id) => {
  const item = state.records.find((r) => r.id === id);
  if (!item) return;
  els.modalTitle.textContent = 'Edit Transcription';
  els.modalRecordId.value = item.id;
  els.modalTitleInput.value = item.title;
  els.modalLanguageInput.value = item.primary_language;
  els.modalTextInput.value = item.transcript_text;
  els.crudModal.classList.remove('hidden');
};

function openCreateModal() {
  els.modalTitle.textContent = 'New Manual Transcription';
  els.modalRecordId.value = '';
  els.modalTitleInput.value = '';
  els.modalLanguageInput.value = 'hi-IN / en-IN';
  els.modalTextInput.value = '';
  els.crudModal.classList.remove('hidden');
}

function closeModal() {
  els.crudModal.classList.add('hidden');
}

els.crudForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = els.modalRecordId.value;
  const payload = {
    title: els.modalTitleInput.value.trim(),
    primary_language: els.modalLanguageInput.value.trim() || 'hi-IN / en-IN',
    transcript_text: els.modalTextInput.value.trim(),
    stt_provider: id ? undefined : 'manual',
  };

  const url = id ? `/api/transcriptions/${id}` : '/api/transcriptions';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json.success) {
    closeModal();
    showToast(id ? 'Transcription updated.' : 'Transcription created.');
    loadHistory();
    loadStats();
  } else {
    showToast(json.error || 'Save failed.');
  }
});

els.recordBtn.addEventListener('click', () => {
  if (state.isRecording) stopRecording();
  else startRecording();
});

els.clearLiveBtn.addEventListener('click', () => {
  els.liveTitleInput.value = '';
  els.liveTextArea.innerText = '';
  els.interimLine.textContent = '';
  els.timerDisplay.textContent = '00:00';
});

els.saveLiveBtn.addEventListener('click', saveLiveTranscript);
els.newManualBtn.addEventListener('click', openCreateModal);
els.closeModalBtn.addEventListener('click', closeModal);
els.cancelModalBtn.addEventListener('click', closeModal);
els.modalBackdrop.addEventListener('click', closeModal);
els.searchInput.addEventListener('input', loadHistory);
els.filterProvider.addEventListener('change', loadHistory);
els.filterStarred.addEventListener('change', loadHistory);

drawWaveform();
checkHealth();
connectWebSocket();
loadHistory();
loadStats();

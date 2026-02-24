import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';
import { transcribeAudio } from '../api/doctor.js';

export async function renderLiveConsultation() {
  // === State Management ===
  let mediaRecorder = null;
  let audioChunks = [];
  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  let audioContext = null;
  let analyser = null;
  let animationId = null;
  let chunkInterval = null;
  let currentEncounterId = null;

  const bodyHTML = `
    <style>
      /* ===== Consultation Page — Exact Stitch Replica ===== */
      .consult-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #f6f6f8; }

      /* --- Top Header: Patient Info + Audio Controls --- */
      .consult-header {
        background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 16px 24px;
        display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05); z-index: 20;
      }
      .consult-header__patient { display: flex; align-items: center; gap: 16px; }
      .consult-header__avatar {
        height: 40px; width: 40px; border-radius: 50%; background: rgba(36,99,235,0.1);
        display: flex; align-items: center; justify-content: center;
        color: #2463eb; font-weight: 700; font-size: 1.125rem;
      }
      .consult-header__name { font-size: 1.125rem; font-weight: 600; color: #0f172a; line-height: 1.2; margin: 0; }
      .consult-header__badge {
        display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500;
        background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;
      }
      .consult-header__meta { display: flex; align-items: center; gap: 12px; font-size: 0.875rem; color: #64748b; margin-top: 2px; }
      .consult-header__dot { width: 4px; height: 4px; border-radius: 50%; background: #cbd5e1; }
      .consult-header__audio { display: flex; align-items: center; gap: 24px; color: #94a3b8; }
      .consult-header__mic-label { display: flex; flex-direction: column; align-items: flex-end; margin-right: 8px; }
      .consult-header__mic-title { font-size: 0.6875rem; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
      .consult-header__mic-off { font-size: 0.875rem; font-weight: 500; color: #94a3b8; }
      .consult-header__mic-off.active { color: #ef4444; }
      .consult-header__btns { display: flex; align-items: center; gap: 12px; }
      .consult-btn-upload {
        display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px;
        border: 1px solid #e5e7eb; background: #fff; color: #334155; font-weight: 500; font-size: 0.875rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; transition: background 0.15s;
      }
      .consult-btn-upload:hover { background: #f8fafc; }
      .consult-btn-record {
        display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
        background: #ef4444; color: #fff; font-weight: 600; font-size: 0.875rem; border: none;
        box-shadow: 0 4px 6px rgba(239,68,68,0.2); cursor: pointer; transition: background 0.15s;
      }
      .consult-btn-record:hover { background: #dc2626; }
      .consult-btn-record .material-icons-outlined { animation: pulse-dot 1.5s ease-in-out infinite; }
      @keyframes pulse-dot { 0%,100%{opacity:1}50%{opacity:.4} }

      /* --- Main Workspace: transcript + sidebar --- */
      .consult-workspace { display: flex; flex: 1; overflow: hidden; }

      /* --- Transcript Area --- */
      .consult-transcript-area { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; background: #f6f6f8; }
      .consult-transcript-scroll { flex: 1; overflow-y: auto; padding: 24px 32px; scroll-behavior: smooth; }
      .consult-transcript-card {
        max-width: 56rem; margin: 0 auto 32px; background: #fff; border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden;
      }
      .consult-transcript-card__header {
        background: #f8fafc; border-bottom: 1px solid #e2e8f0;
        padding: 12px 24px; display: flex; justify-content: space-between; align-items: center;
      }
      .consult-transcript-card__label {
        font-size: 0.6875rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;
      }
      .consult-transcript-card__time { font-size: 0.75rem; font-weight: 500; color: #94a3b8; }
      .consult-transcript-content {
        padding: 32px 40px; line-height: 1.7; color: #1e293b; font-size: 0.9375rem;
      }
      .consult-transcript-content p { margin: 0 0 24px; }
      
      .transcript-preview { color: #94a3b8; font-style: italic; }

      /* --- Bottom Action Bar --- */
      .consult-actions {
        position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
        background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid #e5e7eb; padding: 16px 24px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .consult-actions__left { display: flex; gap: 12px; }
      .consult-btn-action {
        display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
        border: 1px solid #e5e7eb; background: #fff; color: #334155; font-weight: 500; font-size: 0.875rem;
        cursor: pointer; transition: background 0.15s;
      }
      .consult-btn-action:hover { background: #f8fafc; }
      .consult-btn-action .material-icons-outlined.primary { color: #2463eb; }
      .consult-btn-edit {
        display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
        background: #2463eb; color: #fff; font-weight: 500; font-size: 0.875rem; border: none;
        box-shadow: 0 4px 6px rgba(36,99,235,0.3); cursor: pointer; transition: background 0.15s;
      }
      .consult-btn-edit:hover { background: #1d4ed8; }
      .consult-btn-verify {
        display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px;
        background: #16a34a; color: #fff; font-weight: 600; font-size: 0.875rem; border: none;
        box-shadow: 0 4px 6px rgba(22,163,74,0.2); cursor: pointer; transition: background 0.15s;
      }
      .consult-btn-verify:hover { background: #15803d; }

      /* --- Right Sidebar: Clinical Insights --- */
      .consult-sidebar {
        width: 384px; background: #fff; border-left: 1px solid #e5e7eb;
        display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
        box-shadow: -4px 0 6px rgba(0,0,0,0.03); z-index: 10;
      }
      .consult-sidebar__header {
        padding: 20px; border-bottom: 1px solid #e5e7eb;
        display: flex; align-items: center; justify-content: space-between; background: #fff;
      }
      .consult-sidebar__title { display: flex; align-items: center; gap: 8px; }
      .consult-sidebar__title h2 { font-size: 0.9375rem; font-weight: 600; color: #1e293b; margin: 0; }
      .consult-sidebar__status {
        font-size: 0.6875rem; font-weight: 500; padding: 4px 8px; border-radius: 4px;
        background: #f1f5f9; color: #475569;
      }
      .consult-sidebar__body { overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 24px; flex: 1; }

      /* Section titles */
      .insight-title { font-size: 0.6875rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }

      /* Symptom tags */
      .symptom-tags { display: flex; flex-wrap: wrap; gap: 8px; }
      .symptom-tag-red {
        display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px;
        font-size: 0.875rem; font-weight: 500; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      }
      .symptom-tag-amber {
        display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px;
        font-size: 0.875rem; font-weight: 500; background: #fffbeb; color: #b45309; border: 1px solid #fde68a;
      }
      .symptom-tag-red .dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; }
      .symptom-tag-amber .dot { width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; }

      /* Conditions card */
      .conditions-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
      .condition-row {
        padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;
        align-items: center; cursor: pointer; transition: background 0.15s;
      }
      .condition-row:hover { background: #f8fafc; }
      .condition-row__name { font-weight: 500; color: #1e293b; font-size: 0.875rem; }
      .condition-row__match { font-size: 0.75rem; color: #64748b; }
      .condition-row__pct {
        width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 0.75rem; flex-shrink: 0;
      }
      .condition-row__pct.high { background: #eff6ff; color: #2463eb; }
      .condition-row__pct.med { background: #f1f5f9; color: #475569; }
      .conditions-footer { padding: 8px; background: #f8fafc; text-align: center; }
      .conditions-footer button {
        font-size: 0.75rem; color: #2463eb; font-weight: 500; background: none; border: none; cursor: pointer;
      }
      .conditions-footer button:hover { text-decoration: underline; }

      /* AI Disclaimer */
      .consult-disclaimer {
        margin-top: auto; padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;
      }
      .consult-disclaimer p { font-size: 10px; color: #94a3b8; line-height: 1.4; margin: 0; }

      /* Loading Animation */
      .audio-processing { display: flex; align-items: center; gap: 8px; color: #2463eb; font-weight: 500; font-size: 0.875rem; }
      .spinner {
        width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top-color: #2463eb;
        border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Audio Wave Visualizer */
      .audio-wave-container {
        height: 24px; width: 120px; background: #f8fafc; border-radius: 12px;
        overflow: hidden; display: none; align-items: center; justify-content: center;
        border: 1px solid #e2e8f0; margin-right: 12px;
      }
      .audio-wave-container.active { display: flex; }
      #wave-canvas { width: 100%; height: 100%; }

      /* Transcript Streaming Styles */
      .transcript-final { color: #1e293b; }
      .transcript-interim { color: #94a3b8; font-style: italic; }

      /* Responsive */
      @media (max-width: 1024px) {
        .consult-sidebar { width: 320px; }
      }
      @media (max-width: 768px) {
        .consult-workspace { flex-direction: column; }
        .consult-sidebar { width: 100%; border-left: none; border-top: 1px solid #e5e7eb; max-height: 50vh; }
      }
    </style>

    <div class="consult-page">
      <!-- ====== TOP HEADER: Patient Info + Audio Controls ====== -->
      <header class="consult-header">
        <div class="consult-header__patient">
          <div class="consult-header__avatar">SJ</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h1 class="consult-header__name">Sarah Johnson</h1>
              <span class="consult-header__badge">PT-789</span>
            </div>
            <div class="consult-header__meta">
              <span>38Y</span>
              <span class="consult-header__dot"></span>
              <span>Female</span>
              <span class="consult-header__dot"></span>
              <span>Tamil 🇮🇳</span>
            </div>
          </div>
        </div>
        <div class="consult-header__audio">
          <div class="audio-wave-container" id="visualizer-container">
            <canvas id="wave-canvas"></canvas>
          </div>
          <div class="consult-header__mic-label">
            <span class="consult-header__mic-title">Microphone Input</span>
            <span class="consult-header__mic-off" id="mic-status">Microphone Off</span>
          </div>
          <div class="consult-header__btns">
            <button class="consult-btn-upload" id="upload-audio-btn">
              <span class="material-icons-outlined" style="font-size:18px;">upload_file</span>
              Upload Audio
            </button>
            <button class="consult-btn-record" id="recording-btn">
              <span class="material-icons-outlined" style="font-size:18px;">fiber_manual_record</span>
              <span id="recording-btn-text">Start Recording</span>
            </button>
          </div>
        </div>
      </header>

      <!-- ====== MAIN WORKSPACE ====== -->
      <div class="consult-workspace">

        <!-- ====== TRANSCRIPT AREA ====== -->
        <main class="consult-transcript-area">
          <div class="consult-transcript-scroll">
            <div class="consult-transcript-card">
              <div class="consult-transcript-card__header">
                <span class="consult-transcript-card__label">Clinical Narrative Transcript</span>
                <span class="consult-transcript-card__time" id="transcript-time">Ready to record</span>
              </div>
              <div class="consult-transcript-content" id="transcript-content" contenteditable="false">
                <p class="transcript-preview" id="preview-placeholder">Transcript will appear here in real-time as you speak...</p>
              </div>
            </div>
            <!-- Spacer for bottom bar -->
            <div style="height:96px;"></div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="consult-actions">
            <div class="consult-actions__left">
              <button class="consult-btn-action" id="regenerate-btn">
                <span class="material-icons-outlined primary" style="font-size:20px;">auto_awesome</span>
                Regenerate Note
              </button>
              <button class="consult-btn-action" id="save-transcript-btn">
                <span class="material-icons-outlined" style="font-size:18px;">save_alt</span>
                Save Transcript
              </button>
              <button class="consult-btn-edit" id="edit-transcript-btn">
                <span class="material-icons-outlined" style="font-size:18px;">edit</span>
                Edit Transcript
              </button>
            </div>
            <button class="consult-btn-verify" id="verify-note-btn">
              <span class="material-icons-outlined" style="font-size:18px;">check_circle</span>
              Verify Note
            </button>
          </div>
        </main>

        <!-- ====== RIGHT SIDEBAR: Clinical Insights ====== -->
        <aside class="consult-sidebar">
          <div class="consult-sidebar__header">
            <div class="consult-sidebar__title">
              <span class="material-icons-outlined" style="font-size:20px;color:#2463eb;">psychology</span>
              <h2>Clinical Insights</h2>
            </div>
            <span class="consult-sidebar__status" id="insights-status">Waiting for data...</span>
          </div>

          <div class="consult-sidebar__body" id="insights-body">
             <!-- Insights will be populated here -->
             <div style="text-align:center; padding-top:40px; color:#94a3b8;">
                <span class="material-icons-outlined" style="font-size:48px; opacity:0.2;">analytics</span>
                <p style="font-size:14px; margin-top:12px;">Start a consultation to see<br>AI-powered insights</p>
             </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  renderAppShell('Consultation', bodyHTML, '/doctor/live-consultation');

  // DOM Elements
  const recordingBtn = document.getElementById('recording-btn');
  const recordingBtnText = document.getElementById('recording-btn-text');
  const micStatus = document.getElementById('mic-status');
  const transcriptContent = document.getElementById('transcript-content');
  const transcriptTime = document.getElementById('transcript-time');
  const insightsStatus = document.getElementById('insights-status');
  const insightsBody = document.getElementById('insights-body');
  const visualizerContainer = document.getElementById('visualizer-container');
  const canvas = document.getElementById('wave-canvas');
  const ctx = canvas.getContext('2d');

  // === Transcription Logic ===

  async function initAudioVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      if (!isRecording) return;
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2463eb';

      const barWidth = (canvas.width / (dataArray.length / 2)) * 1.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 1, barHeight);
        x += barWidth;
      }
    }

    draw();
  }

  async function startRecording() {
    try {
      finalTranscript = ''; // Reset for new session
      const prevEnglishBox = document.getElementById('english-transcript-box');
      if (prevEnglishBox) prevEnglishBox.remove();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Init Audio Visualizer
      await initAudioVisualizer(stream);

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processFinalTranscription(audioBlob);
      };

      // Real-time Preview (Web Speech API) - Tuned for speed
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1; // Prioritize speed over variants
        recognition.lang = 'ta-IN'; // Align with patient/doctor speech to stop halls

        recognition.onresult = (event) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          // RequestAnimationFrame for prioritized UI updates
          requestAnimationFrame(() => updateTranscriptUI(finalTranscript, interimTranscript));
        };

        recognition.onerror = (event) => {
          console.error('Speech Recognition Error:', event.error);
          if (event.error === 'network') showToast('Speech recognition network error', 'error');
        };

        recognition.onend = () => {
          // Restart if still recording (SpeechRecognition sometimes timeouts)
          if (isRecording && recognition) {
            try { recognition.start(); } catch (e) { }
          }
        };

        recognition.start();
      } else {
        console.warn('Speech Recognition API not supported in this browser.');
        showToast('Real-time preview not supported. High-quality transcript will appear after stopping.', 'warning');
      }

      mediaRecorder.start(1000); // Collect data every 1 second
      isRecording = true;
      currentEncounterId = `ENC-${Math.floor(Math.random() * 10000)}`;

      // Setup Progressive Chunking (every 10s)
      chunkInterval = setInterval(() => {
        if (isRecording && audioChunks.length > 0) {
          // Send all segments collected so far for context (Whisper performs better with context)
          const snapshotBlob = new Blob(audioChunks, { type: 'audio/webm' });
          processLiveSnapshot(snapshotBlob);
        }
      }, 10000);

      updateUIState(true);
      showToast('Recording started...', 'info');

    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast('Could not access microphone. Please check permissions.', 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      if (recognition) recognition.stop();
      if (chunkInterval) clearInterval(chunkInterval);
      isRecording = false;

      // Stop Visualizer
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) audioContext.close();

      updateUIState(false);
      showToast('Recording stopped. Processing final transcription...', 'success');

      // Stop all tracks in the stream
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  function updateUIState(active) {
    if (active) {
      visualizerContainer.classList.add('active');
      recordingBtn.classList.add('active');
      recordingBtn.style.background = '#000';
      recordingBtnText.textContent = 'Stop Recording';
      recordingBtn.querySelector('.material-icons-outlined').textContent = 'stop';
      micStatus.textContent = 'Microphone On - Listening...';
      micStatus.classList.add('active');
      transcriptTime.textContent = 'Recording now...';
      if (document.getElementById('preview-placeholder')) {
        document.getElementById('preview-placeholder').remove();
      }
    } else {
      visualizerContainer.classList.remove('active');
      recordingBtn.classList.remove('active');
      recordingBtn.style.background = '';
      recordingBtnText.textContent = 'Start Recording';
      recordingBtn.querySelector('.material-icons-outlined').textContent = 'fiber_manual_record';
      micStatus.textContent = 'Microphone Off';
      micStatus.classList.remove('active');
      transcriptTime.innerHTML = `
        <div class="audio-processing">
          <div class="spinner"></div>
          Processing Clinical Transcription...
        </div>
      `;
    }
  }

  function updateTranscriptUI(final, interim) {
    // Optimized DOM update: Clear only if necessary, use text nodes for performance
    transcriptContent.innerHTML = '';

    const finalSpan = document.createElement('span');
    finalSpan.className = 'transcript-final';
    finalSpan.textContent = final;

    const interimSpan = document.createElement('span');
    interimSpan.className = 'transcript-interim';
    interimSpan.textContent = interim;

    const p = document.createElement('p');
    p.appendChild(finalSpan);
    p.appendChild(interimSpan);
    transcriptContent.appendChild(p);

    // Auto-scroll to bottom
    const scrollContainer = document.querySelector('.consult-transcript-scroll');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  async function processLiveSnapshot(blob) {
    if (!isRecording) return;
    try {
      const audioFile = new File([blob], "snapshot.webm", { type: 'audio/webm' });
      const result = await transcribeAudio({
        audio: audioFile,
        encounterId: currentEncounterId,
        patientId: 'PT-789',
        languageHint: 'en'
      });

      if ((result.status === 'success' || result.status === 'low_confidence') && isRecording) {
        // Update the main container with the highest-quality English translated text so far
        const englishBox = document.getElementById('english-transcript-content') || createEnglishBox();
        englishBox.textContent = result.transcript;

        // Auto-scroll the container
        const scrollContainer = document.querySelector('.consult-transcript-scroll');
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    } catch (err) {
      console.warn('Live snapshot failed (non-fatal):', err);
    }
  }

  function createEnglishBox() {
    const box = document.createElement('div');
    box.id = 'english-transcript-box';
    box.style.background = '#f8fafc';
    box.style.borderLeft = '4px solid #2463eb';
    box.style.padding = '12px';
    box.style.marginTop = '16px';
    box.style.borderRadius = '4px';
    box.style.fontSize = '15px';
    box.style.fontStyle = 'italic';
    box.style.color = '#1e293b';

    const label = document.createElement('div');
    label.style.fontSize = '11px';
    label.style.textTransform = 'uppercase';
    label.style.letterSpacing = '0.05em';
    label.style.color = '#64748b';
    label.style.marginBottom = '4px';
    label.textContent = 'Live English Translation (Whisper High-Quality)';

    const content = document.createElement('div');
    content.id = 'english-transcript-content';

    box.appendChild(label);
    box.appendChild(content);

    // Insert into the UI
    transcriptContent.parentElement.insertBefore(box, transcriptContent.nextSibling);
    return content;
  }

  async function processFinalTranscription(blob) {
    try {
      const audioFile = new File([blob], "consultation.webm", { type: 'audio/webm' });

      // We need IDs for the backend. In a real app, these would come from the context/patient selection.
      // Using placeholders for now to match current UI design.
      const result = await transcribeAudio({
        audio: audioFile,
        encounterId: currentEncounterId,
        patientId: 'PT-789',
        languageHint: 'en' // Default to English as requested
      });

      if (result.status === 'success' || result.status === 'low_confidence') {
        transcriptContent.innerHTML = `<p>${result.transcript}</p>`;
        transcriptTime.textContent = `Completed at ${new Date().toLocaleTimeString()}`;
        insightsStatus.textContent = result.status === 'low_confidence' ? 'Verification Required' : 'Analysis Complete';
        populateInsights(result);
        if (result.status === 'low_confidence') {
          showToast('Transcription requires clinical review', 'warning');
        } else {
          showToast('Transcription finalized successfully', 'success');
        }
      } else {
        console.error('Backend transcription error:', result.message);
        showToast('Transcription Error: ' + (result.message || 'Unknown error'), 'error');
        transcriptTime.textContent = 'Transcription error';
      }
    } catch (err) {
      console.error('Transcription error:', err);
      showToast('Failed to process final transcription: ' + err.message, 'error');
      transcriptTime.textContent = 'Transcription failed';
    }
  }

  function populateInsights(data) {
    // In a real implementation, clinical entities would be extracted.
    // Here we'll generate some demo insights based on the transcript if needed,
    // or keep the Stitch replica look with real data states.
    insightsBody.innerHTML = `
      <!-- Detected Symptoms -->
      <div>
        <div class="insight-title">Detected Symptoms</div>
        <div class="symptom-tags">
          <span class="symptom-tag-red"><span class="dot"></span> Analyzed Content</span>
          <span class="symptom-tag-amber"><span class="dot"></span> AI Generated</span>
        </div>
      </div>

      <!-- Possible Conditions -->
      <div>
        <div class="insight-title">AI Analysis Results</div>
        <div class="conditions-card">
          <div class="condition-row">
            <div>
              <div class="condition-row__name">Clinical Confidence</div>
              <div class="condition-row__match">Whisper Model Accuracy</div>
            </div>
            <div class="condition-row__pct high">${Math.round(data.confidence * 100)}%</div>
          </div>
          <div class="conditions-footer">
            <button id="view-differential-link">View Full Analysis</button>
          </div>
        </div>
      </div>
    `;
  }

  // === Event Listeners ===

  recordingBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  // Upload Audio → go to audio upload wizard
  document.getElementById('upload-audio-btn')?.addEventListener('click', () => {
    navigate('/doctor/consultation');
  });

  // Regenerate Note
  document.getElementById('regenerate-btn')?.addEventListener('click', () => {
    showToast('Regenerating clinical note from transcript...', 'info');
  });

  // Save Transcript
  document.getElementById('save-transcript-btn')?.addEventListener('click', () => {
    showToast('Transcript saved to drafts', 'success');
  });

  // Edit Transcript — toggle contenteditable
  document.getElementById('edit-transcript-btn')?.addEventListener('click', () => {
    const content = document.getElementById('transcript-content');
    const isEditable = content.contentEditable === 'true';
    content.contentEditable = !isEditable;
    content.style.outline = isEditable ? 'none' : '2px solid rgba(36,99,235,0.2)';
    content.style.borderRadius = '8px';
    const btn = document.getElementById('edit-transcript-btn');
    if (!isEditable) {
      btn.style.background = '#1d4ed8';
      showToast('Edit mode enabled — click on transcript text to edit', 'warning');
    } else {
      btn.style.background = '#2463eb';
      showToast('Edit mode disabled', 'info');
    }
  });

  // Verify Note → note verification page
  document.getElementById('verify-note-btn')?.addEventListener('click', () => {
    navigate('/doctor/note-verification');
  });
}

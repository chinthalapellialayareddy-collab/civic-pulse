/**
 * CivicBot – Advanced Bilingual AI Chatbot for CivicPulse
 * With Voice Speaking & Listening Support (Web Speech API & SpeechSynthesis)
 * Supports English & Telugu, live SQLite complaint status tracking,
 * and AI provider cascade (Gemini -> Groq -> Rule-Based).
 */

(function () {
  'use strict';

  // State
  let currentLang = 'en';
  let isMinimized = false;
  let isOpen = false;
  let isSending = false;
  let isVoiceAutoOn = false;
  let isListening = false;
  let speechRecognitionInstance = null;
  let currentSpeakingUtterance = null;
  let currentSpeakingBtn = null;
  let noticeTimeout = null;
  let availableVoices = [];
  const conversationHistory = [];

  // Translations
  const I18N = {
    en: {
      botName: 'CivicBot',
      botSubtitle: 'Municipal AI Assistant • Online',
      placeholder: 'Ask about potholes, tracking, status, or reporting...',
      welcomeTitle: 'Welcome to CivicPulse!',
      welcomeMsg: 'Hello! I am **CivicBot**, your smart municipal assistant. I can help you lodge grievances, check complaint milestones, locate nearby public issues, and answer civic governance questions in English or Telugu.',
      suggestedTitle: 'Suggested Questions:',
      suggestions: [
        'How to report a pothole?',
        'Check my complaints status',
        'What does Pending status mean?',
        'How to report garbage overflow?',
        'Show nearby reported issues',
        'How does duplicate detection work?'
      ],
      clearConfirm: 'Clear conversation history?',
      sendTooltip: 'Send Message (Enter)',
      micTooltip: 'Speak with Voice (English / Telugu)',
      typingText: 'CivicBot is thinking...',
      onlineText: 'Online',
      providerLabel: 'Powered by',
      voiceOn: 'Voice On',
      voiceOff: 'Voice Off',
      voiceNotSupported: 'Voice not supported in this browser',
      micDenied: 'Microphone permission denied. Please allow microphone access.',
      listeningText: 'Listening... Speak now (English)',
      listenBtnText: 'Listen',
      stopBtnText: 'Stop'
    },
    te: {
      botName: 'సివిక్‌బాట్ (CivicBot)',
      botSubtitle: 'మున్సిపల్ AI సహాయకుడు • ఆన్‌లైన్',
      placeholder: 'గుంతలు, ఫిర్యాదుల స్థితి లేదా సమస్యల గురించి అడగండి...',
      welcomeTitle: 'CivicPulse కి స్వాగతం!',
      welcomeMsg: 'నమస్కారం! నేను **సివిక్‌బాట్ (CivicBot)**, మీ మున్సిపల్ AI సహాయకుడిని. రోడ్డు గుంతలు, చెత్త, డ్రైనేజ్ సమస్యల నమోదు, మీ ఫిర్యాదుల లైవ్ ట్రాకింగ్ మరియు ఇతర నగర సమస్యల వివరాల్లో మీకు సహాయం చేస్తాను.',
      suggestedTitle: 'తరచుగా అడిగే ప్రశ్నలు:',
      suggestions: [
        'రోడ్డు గుంతలను ఎలా నివేదించాలి?',
        'నా ఫిర్యాదుల స్థితి చూడండి',
        'పెండింగ్ స్టేటస్ అంటే ఏమిటి?',
        'చెత్త సమస్యలను ఎలా నివేదించాలి?',
        'సమీప పబ్లిక్ సమస్యలు చూపించండి',
        'డూప్లికేట్ డిటెక్షన్ ఎలా పనిచేస్తుంది?'
      ],
      clearConfirm: 'చాట్ హిస్టరీని క్లియర్ చేయాలా?',
      sendTooltip: 'సందేశం పంపండి (Enter)',
      micTooltip: 'వాయిస్ ద్వారా మాట్లాడండి (తెలుగు / ఇంగ్లీష్)',
      typingText: 'సివిక్‌బాట్ ఆలోచిస్తోంది...',
      onlineText: 'ఆన్‌లైన్',
      providerLabel: 'సాంకేతికత',
      voiceOn: 'వాయిస్ ఆన్',
      voiceOff: 'వాయిస్ ఆఫ్',
      voiceNotSupported: 'ఈ బ్రౌజర్‌లో వాయిస్ ఫీచర్ అందుబాటులో లేదు',
      micDenied: 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి మైక్ అనుమతించండి.',
      listeningText: 'వింటున్నాను... మాట్లాడండి (తెలుగు)',
      listenBtnText: 'వినండి',
      stopBtnText: 'ఆపు'
    }
  };

  // Determine API base
  const BACKEND_BASE = (() => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    if (port === '3000' || port === '5173' || port === '8080') {
      return 'http://localhost:5000/api';
    }
    if (hostname.includes('onrender.com') || port === '5000') {
      return '/api';
    }
    return 'https://civic-pulse-19kr.onrender.com/api';
  })();

  // Initialize SpeechSynthesis Voices
  function initVoices() {
    if ('speechSynthesis' in window) {
      availableVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        availableVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  // Detect whether text is primarily Telugu
  function detectLanguage(text) {
    if (!text) return currentLang;
    const teluguRegex = /[\u0C00-\u0C7F]/;
    return teluguRegex.test(text) ? 'te' : currentLang;
  }

  // Clean Markdown & URLs for natural speech synthesis
  function cleanTextForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
      .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold
      .replace(/\*([^*]+)\*/g, '$1')        // italic
      .replace(/^#+\s+/gm, '')              // headers
      .replace(/#CP-/gi, 'Complaint CP ')   // ticket IDs
      .replace(/^[•\-\*]\s+/gm, '')         // bullets
      .replace(/[🤖📋🔍👷🔧✅📍⚡💡🛡️🔊🎤•—]/g, '') // icons
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Select best voice matching desired language
  function getBestVoice(lang) {
    if (!availableVoices || availableVoices.length === 0) {
      if ('speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
      }
    }
    if (!availableVoices || availableVoices.length === 0) return null;

    if (lang === 'te') {
      const teluguVoice = availableVoices.find(v =>
        v.lang.toLowerCase().startsWith('te') ||
        v.name.toLowerCase().includes('telugu')
      );
      if (teluguVoice) return teluguVoice;
    }

    // Default or English
    const enInVoice = availableVoices.find(v => v.lang === 'en-IN' || v.lang === 'en_IN');
    if (enInVoice) return enInVoice;

    const enVoice = availableVoices.find(v => v.lang.toLowerCase().startsWith('en'));
    return enVoice || availableVoices[0] || null;
  }

  // Speak text aloud via SpeechSynthesis
  function speakText(rawText, forceLang = null, onStart = null, onEnd = null) {
    if (!('speechSynthesis' in window)) {
      showVoiceNotice(I18N[currentLang].voiceNotSupported);
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    // Cancel any current speaking
    stopSpeaking();

    const clean = cleanTextForSpeech(rawText);
    if (!clean) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    const lang = forceLang || detectLanguage(rawText);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = lang === 'te' ? 0.95 : 1.0;
    utterance.pitch = 1.0;

    const matchedVoice = getBestVoice(lang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      if (typeof onStart === 'function') onStart();
    };

    utterance.onend = () => {
      currentSpeakingUtterance = null;
      if (typeof onEnd === 'function') onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      currentSpeakingUtterance = null;
      if (typeof onEnd === 'function') onEnd();
    };

    currentSpeakingUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  // Stop active speech
  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (currentSpeakingBtn) {
      resetSpeakButton(currentSpeakingBtn);
      currentSpeakingBtn = null;
    }
    currentSpeakingUtterance = null;
  }

  function resetSpeakButton(btn) {
    if (!btn) return;
    btn.classList.remove('speaking');
    const label = currentLang === 'te' ? I18N.te.listenBtnText : I18N.en.listenBtnText;
    btn.innerHTML = `<i class="fas fa-volume-up"></i> <span>${label}</span>`;
  }

  // Speech Recognition (Mic listener)
  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showVoiceNotice(I18N[currentLang].voiceNotSupported);
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    // Stop speaking if currently speaking
    stopSpeaking();

    try {
      speechRecognitionInstance = new SpeechRecognition();
      speechRecognitionInstance.continuous = false;
      speechRecognitionInstance.interimResults = false;
      speechRecognitionInstance.lang = currentLang === 'te' ? 'te-IN' : 'en-IN';

      speechRecognitionInstance.onstart = function () {
        isListening = true;
        updateListeningUI(true);
      };

      speechRecognitionInstance.onresult = function (event) {
        if (event.results && event.results[0] && event.results[0][0]) {
          const transcript = event.results[0][0].transcript;
          if (transcript && transcript.trim()) {
            const input = document.getElementById('civicbot-input');
            if (input) {
              input.value = transcript.trim();
              handleSend();
            }
          }
        }
      };

      speechRecognitionInstance.onerror = function (event) {
        console.warn('Speech recognition notice:', event.error);
        stopListening();
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showVoiceNotice(I18N[currentLang].micDenied);
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          showVoiceNotice(I18N[currentLang].voiceNotSupported);
        }
      };

      speechRecognitionInstance.onend = function () {
        stopListening();
      };

      speechRecognitionInstance.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      stopListening();
      showVoiceNotice(I18N[currentLang].voiceNotSupported);
    }
  }

  function stopListening() {
    isListening = false;
    updateListeningUI(false);
    if (speechRecognitionInstance) {
      try {
        speechRecognitionInstance.stop();
      } catch (e) {}
      speechRecognitionInstance = null;
    }
  }

  function updateListeningUI(active) {
    const micBtn = document.getElementById('civicbot-mic');
    const bar = document.getElementById('cb-voice-listening-bar');
    const statusText = document.getElementById('cb-listening-status-text');

    if (micBtn) {
      if (active) {
        micBtn.classList.add('listening');
        micBtn.setAttribute('title', 'Recording... Click to stop');
      } else {
        micBtn.classList.remove('listening');
        micBtn.setAttribute('title', I18N[currentLang].micTooltip);
      }
    }

    if (bar) {
      bar.style.display = active ? 'flex' : 'none';
      if (statusText) {
        statusText.textContent = I18N[currentLang].listeningText;
      }
    }
  }

  function showVoiceNotice(msg) {
    const noticeEl = document.getElementById('cb-voice-notice');
    if (!noticeEl) return;
    noticeEl.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
    noticeEl.style.display = 'flex';
    noticeEl.classList.add('show');

    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      noticeEl.classList.remove('show');
      setTimeout(() => {
        noticeEl.style.display = 'none';
      }, 250);
    }, 3500);
  }

  // Inject Styles
  function injectStyles() {
    if (document.getElementById('civicbot-styles')) return;

    const style = document.createElement('style');
    style.id = 'civicbot-styles';
    style.textContent = `
      /* CivicBot Floating Launcher */
      #civicbot-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #172554 0%, #0D9488 100%);
        color: #ffffff;
        border: none;
        padding: 10px 18px 10px 14px;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(13, 148, 136, 0.4), 0 4px 12px rgba(23, 37, 84, 0.25);
        font-family: inherit;
        font-weight: 700;
        font-size: 0.95rem;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
      }
      #civicbot-launcher:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 14px 32px rgba(13, 148, 136, 0.5), 0 6px 16px rgba(23, 37, 84, 0.3);
      }
      #civicbot-launcher .launcher-icon {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: #5eead4;
        position: relative;
      }
      #civicbot-launcher .online-dot {
        position: absolute;
        top: 1px;
        right: 1px;
        width: 11px;
        height: 11px;
        background: #10b981;
        border: 2px solid #172554;
        border-radius: 50%;
        box-shadow: 0 0 8px #10b981;
      }

      /* CivicBot Chat Window */
      #civicbot-window {
        position: fixed;
        bottom: 95px;
        right: 24px;
        width: 420px;
        max-width: calc(100vw - 32px);
        height: 610px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25), 0 8px 24px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        z-index: 99999;
        overflow: hidden;
        border: 1px solid rgba(226, 232, 240, 0.9);
        font-family: inherit;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #civicbot-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      #civicbot-window.minimized {
        height: 64px !important;
        overflow: hidden;
      }

      /* Chat Header */
      .cb-header {
        background: linear-gradient(135deg, #172554 0%, #1e3a8a 55%, #7c3aed 100%);
        color: #ffffff;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        position: relative;
      }
      .cb-header-brand {
        display: flex;
        align-items: center;
        gap: 9px;
        flex: 1;
        min-width: 0;
      }
      .cb-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0d9488 0%, #7c3aed 100%);
        border: 2px solid rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        color: #ffffff;
        flex-shrink: 0;
      }
      .cb-title-area {
        min-width: 0;
      }
      .cb-title {
        font-size: 1rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cb-subtitle {
        font-size: 0.7rem;
        color: #93c5fd;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .cb-subtitle-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10b981;
        display: inline-block;
        box-shadow: 0 0 6px #10b981;
      }
      .cb-header-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }

      /* Voice Toggle Switch / Button */
      .cb-voice-btn {
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: #e2e8f0;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 4px 7px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
        white-space: nowrap;
        user-select: none;
      }
      .cb-voice-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }
      .cb-voice-btn.active {
        background: linear-gradient(135deg, #10b981 0%, #0d9488 100%);
        border-color: #6ee7b7;
        color: #ffffff;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.45);
      }

      .cb-lang-btn {
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 4px 7px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s ease;
        white-space: nowrap;
      }
      .cb-lang-btn:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .cb-icon-btn {
        background: transparent;
        border: none;
        color: #cbd5e1;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s ease;
      }
      .cb-icon-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.15);
      }

      /* Voice Notice Toast */
      .cb-voice-notice {
        position: absolute;
        top: 60px;
        left: 12px;
        right: 12px;
        background: #0f172a;
        color: #38bdf8;
        border: 1px solid #0284c7;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 8px 22px rgba(0,0,0,0.3);
        z-index: 100;
        transition: all 0.25s ease;
        opacity: 0;
        transform: translateY(-8px);
        pointer-events: none;
      }
      .cb-voice-notice.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      /* Chat Messages Body */
      .cb-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cb-messages::-webkit-scrollbar {
        width: 6px;
      }
      .cb-messages::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      /* Message Bubbles */
      .cb-msg {
        display: flex;
        gap: 9px;
        max-width: 90%;
        animation: cb-fade-in 0.25s ease;
      }
      @keyframes cb-fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .cb-msg.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .cb-msg.bot {
        align-self: flex-start;
      }
      .cb-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .cb-msg.bot .cb-msg-avatar {
        background: linear-gradient(135deg, #172554, #0d9488);
        color: #ffffff;
      }
      .cb-msg.user .cb-msg-avatar {
        background: #7c3aed;
        color: #ffffff;
      }
      .cb-bubble-content {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .cb-bubble {
        padding: 11px 14px;
        border-radius: 16px;
        font-size: 0.88rem;
        line-height: 1.5;
        word-break: break-word;
      }
      .cb-msg.user .cb-bubble {
        background: linear-gradient(135deg, #172554 0%, #1e3a8a 100%);
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }
      .cb-msg.bot .cb-bubble {
        background: #ffffff;
        color: #1e293b;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        border-bottom-left-radius: 4px;
      }
      .cb-bubble p {
        margin: 0 0 6px 0;
      }
      .cb-bubble p:last-child {
        margin: 0;
      }
      .cb-bubble a {
        color: #0d9488;
        font-weight: 700;
        text-decoration: underline;
      }
      .cb-bubble a:hover {
        color: #0f766e;
      }
      .cb-bubble ul, .cb-bubble ol {
        margin: 4px 0 6px 0;
        padding-left: 18px;
      }
      .cb-bubble li {
        margin-bottom: 3px;
      }
      .cb-meta {
        font-size: 0.68rem;
        color: #94a3b8;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .cb-provider-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: #eff6ff;
        color: #3b82f6;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        padding: 1px 6px;
        font-size: 0.65rem;
        font-weight: 600;
      }

      /* Speaker Pill Button on Bot Replies */
      .cb-speak-pill {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #475569;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
        user-select: none;
      }
      .cb-speak-pill:hover {
        background: #e0f2fe;
        border-color: #7dd3fc;
        color: #0369a1;
        transform: translateY(-1px);
      }
      .cb-speak-pill.speaking {
        background: #ecfdf5;
        border-color: #34d399;
        color: #047857;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.35);
        animation: cb-speak-pulse 1.4s infinite;
      }
      @keyframes cb-speak-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      /* Suggested Questions Box */
      .cb-suggestions-box {
        background: #ffffff;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        padding: 11px;
        margin-top: 6px;
      }
      .cb-suggestions-title {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        margin-bottom: 7px;
        letter-spacing: 0.04em;
      }
      .cb-suggestions-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cb-chip {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #172554;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 6px 11px;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .cb-chip:hover {
        background: #ede9fe;
        border-color: #c4b5fd;
        color: #6b21a8;
        transform: translateX(3px);
      }
      .cb-chip i {
        font-size: 0.7rem;
        color: #94a3b8;
      }

      /* Typing Animation */
      .cb-typing {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 10px 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        width: fit-content;
      }
      .cb-dot {
        width: 7px;
        height: 7px;
        background: #0d9488;
        border-radius: 50%;
        animation: cb-bounce 1.4s infinite ease-in-out both;
      }
      .cb-dot:nth-child(1) { animation-delay: -0.32s; }
      .cb-dot:nth-child(2) { animation-delay: -0.16s; }
      @keyframes cb-bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }

      /* Listening Bar Animation */
      .cb-voice-listening-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        background: #fef2f2;
        border-top: 1px solid #fecaca;
        color: #b91c1c;
        font-size: 0.8rem;
        font-weight: 700;
        animation: cb-fade-in 0.2s ease;
      }
      .cb-listening-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .cb-pulse-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ef4444;
        animation: cb-pulse-red 1.2s infinite ease-in-out;
      }
      .cb-listening-stop-btn {
        background: #fee2e2;
        border: 1px solid #fca5a5;
        color: #991b1b;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 0.75rem;
        cursor: pointer;
        font-weight: 700;
        transition: background 0.15s ease;
      }
      .cb-listening-stop-btn:hover {
        background: #fca5a5;
        color: #7f1d1d;
      }

      /* Red Pulsing Animation for Mic */
      @keyframes cb-pulse-red {
        0% {
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
        }
      }

      /* Chat Footer & Input */
      .cb-footer {
        padding: 10px 14px 12px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
      }
      .cb-input-form {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-radius: 999px;
        padding: 3px 5px 3px 12px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .cb-input-form:focus-within {
        border-color: #0d9488;
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        background: #ffffff;
      }
      #civicbot-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.88rem;
        color: #1e293b;
        min-width: 0;
      }
      #civicbot-input::placeholder {
        color: #94a3b8;
        font-size: 0.82rem;
      }

      /* Mic Button */
      .cb-mic-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #475569;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .cb-mic-btn:hover {
        background: #e2e8f0;
        color: #0d9488;
        transform: scale(1.05);
      }
      .cb-mic-btn.listening {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
        color: #ffffff !important;
        border-color: #f87171 !important;
        animation: cb-pulse-red 1.3s infinite ease-in-out !important;
      }

      /* Send Button */
      #civicbot-send {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0d9488 0%, #172554 100%);
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        transition: transform 0.15s ease, opacity 0.15s ease;
        flex-shrink: 0;
      }
      #civicbot-send:hover:not(:disabled) {
        transform: scale(1.08);
      }
      #civicbot-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .cb-disclaimer {
        text-align: center;
        font-size: 0.65rem;
        color: #94a3b8;
        margin-top: 5px;
      }

      /* Mobile Responsiveness */
      @media (max-width: 480px) {
        #civicbot-window {
          bottom: 0;
          right: 0;
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
        }
        #civicbot-launcher {
          bottom: 16px;
          right: 16px;
          padding: 8px 14px;
          font-size: 0.88rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Format Simple Markdown (bold, italic, links, lists)
  function formatMarkdown(text) {
    if (!text) return '';
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    out = out.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = out.split('\n');
    let inList = false;
    const processed = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          processed.push('<ul>');
          inList = true;
        }
        processed.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        if (trimmed) {
          processed.push(`<p>${line}</p>`);
        }
      }
    }
    if (inList) processed.push('</ul>');

    return processed.join('');
  }

  // Render Bot UI
  function renderCivicBot() {
    if (document.getElementById('civicbot-root')) return;

    injectStyles();
    initVoices();

    const root = document.createElement('div');
    root.id = 'civicbot-root';

    root.innerHTML = `
      <!-- Launcher Button -->
      <button id="civicbot-launcher" type="button" aria-label="Open CivicBot AI Chatbot">
        <div class="launcher-icon">
          <i class="fas fa-robot"></i>
          <span class="online-dot"></span>
        </div>
        <span>CivicBot AI</span>
      </button>

      <!-- Chat Window -->
      <div id="civicbot-window" role="dialog" aria-modal="true" aria-label="CivicBot AI Assistant">
        <!-- Header -->
        <div class="cb-header">
          <div class="cb-header-brand">
            <div class="cb-avatar">
              <i class="fas fa-robot"></i>
            </div>
            <div class="cb-title-area">
              <h3 class="cb-title" id="cb-header-title">CivicBot</h3>
              <p class="cb-subtitle">
                <span class="cb-subtitle-dot"></span>
                <span id="cb-header-sub">Municipal AI Assistant • Online</span>
              </p>
            </div>
          </div>

          <div class="cb-header-actions">
            <!-- Voice On/Off Toggle -->
            <button type="button" class="cb-voice-btn" id="cb-voice-toggle" title="Auto Voice (On/Off) / ఆటో వాయిస్">
              <i class="fas fa-volume-mute" id="cb-voice-icon"></i>
              <span id="cb-voice-label">Voice Off</span>
            </button>
            <!-- Language Switcher -->
            <button type="button" class="cb-lang-btn" id="cb-lang-toggle" title="Switch Language / భాషను మార్చండి">
              <span id="cb-lang-label">తెలుగు</span>
            </button>
            <!-- Clear Chat -->
            <button type="button" class="cb-icon-btn" id="cb-btn-clear" title="Clear Conversation">
              <i class="fas fa-trash-alt"></i>
            </button>
            <!-- Minimize -->
            <button type="button" class="cb-icon-btn" id="cb-btn-min" title="Minimize">
              <i class="fas fa-minus"></i>
            </button>
            <!-- Close -->
            <button type="button" class="cb-icon-btn" id="cb-btn-close" title="Close Chat">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Voice Notice Toast Popup inside header -->
          <div id="cb-voice-notice" class="cb-voice-notice" style="display: none;"></div>
        </div>

        <!-- Messages Container -->
        <div class="cb-messages" id="civicbot-messages"></div>

        <!-- Listening Bar (Appears when recording voice) -->
        <div id="cb-voice-listening-bar" class="cb-voice-listening-bar" style="display: none;">
          <div class="cb-listening-badge">
            <span class="cb-pulse-dot"></span>
            <span id="cb-listening-status-text">Listening... Speak now</span>
          </div>
          <button type="button" class="cb-listening-stop-btn" id="cb-listening-stop-btn">
            Cancel
          </button>
        </div>

        <!-- Footer / Input Form -->
        <div class="cb-footer">
          <form class="cb-input-form" id="civicbot-form" onsubmit="return false;">
            <input 
              type="text" 
              id="civicbot-input" 
              placeholder="Ask about potholes, tracking, status..." 
              autocomplete="off"
            />
            <!-- Microphone Voice Button -->
            <button type="button" id="civicbot-mic" class="cb-mic-btn" aria-label="Speak into microphone" title="Click to speak (English / Telugu)">
              <i class="fas fa-microphone"></i>
            </button>
            <!-- Send Button -->
            <button type="submit" id="civicbot-send" aria-label="Send message">
              <i class="fas fa-paper-plane"></i>
            </button>
          </form>
          <div class="cb-disclaimer">
            <i class="fas fa-shield-alt"></i> Official CivicPulse AI • Voice Enabled
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Event Bindings
    document.getElementById('civicbot-launcher').addEventListener('click', toggleChat);
    document.getElementById('cb-btn-close').addEventListener('click', closeChat);
    document.getElementById('cb-btn-min').addEventListener('click', toggleMinimize);
    document.getElementById('cb-btn-clear').addEventListener('click', clearChat);
    document.getElementById('cb-lang-toggle').addEventListener('click', toggleLanguage);
    document.getElementById('cb-voice-toggle').addEventListener('click', toggleAutoVoice);
    document.getElementById('civicbot-mic').addEventListener('click', toggleSpeechRecognition);
    document.getElementById('cb-listening-stop-btn').addEventListener('click', stopListening);
    document.getElementById('civicbot-form').addEventListener('submit', handleSend);

    // Initial greeting
    resetToWelcome();
  }

  function toggleAutoVoice() {
    isVoiceAutoOn = !isVoiceAutoOn;
    const btn = document.getElementById('cb-voice-toggle');
    const icon = document.getElementById('cb-voice-icon');
    const label = document.getElementById('cb-voice-label');

    if (isVoiceAutoOn) {
      btn.classList.add('active');
      icon.className = 'fas fa-volume-up';
      label.textContent = currentLang === 'te' ? I18N.te.voiceOn : I18N.en.voiceOn;
      const feedback = currentLang === 'te' ? 'ఆటో వాయిస్ ఆన్ చేయబడింది' : 'Auto voice enabled';
      showVoiceNotice(feedback);
      speakText(feedback, currentLang);
    } else {
      btn.classList.remove('active');
      icon.className = 'fas fa-volume-mute';
      label.textContent = currentLang === 'te' ? I18N.te.voiceOff : I18N.en.voiceOff;
      stopSpeaking();
      showVoiceNotice(currentLang === 'te' ? 'ఆటో వాయిస్ ఆఫ్ చేయబడింది' : 'Auto voice disabled');
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    const win = document.getElementById('civicbot-window');
    if (isOpen) {
      win.classList.add('open');
      isMinimized = false;
      win.classList.remove('minimized');
      setTimeout(() => {
        document.getElementById('civicbot-input').focus();
      }, 250);
    } else {
      win.classList.remove('open');
      stopSpeaking();
      stopListening();
    }
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('civicbot-window').classList.remove('open');
    stopSpeaking();
    stopListening();
  }

  function toggleMinimize() {
    isMinimized = !isMinimized;
    const win = document.getElementById('civicbot-window');
    win.classList.toggle('minimized', isMinimized);
    if (isMinimized) {
      stopSpeaking();
      stopListening();
    }
  }

  function toggleLanguage() {
    stopSpeaking();
    stopListening();

    currentLang = currentLang === 'en' ? 'te' : 'en';
    const langBtnLabel = document.getElementById('cb-lang-label');
    langBtnLabel.textContent = currentLang === 'en' ? 'తెలుగు' : 'English';

    const t = I18N[currentLang];
    document.getElementById('cb-header-title').textContent = t.botName;
    document.getElementById('cb-header-sub').textContent = t.botSubtitle;
    document.getElementById('civicbot-input').placeholder = t.placeholder;

    // Update voice button label
    const voiceLabel = document.getElementById('cb-voice-label');
    if (voiceLabel) {
      voiceLabel.textContent = isVoiceAutoOn ? t.voiceOn : t.voiceOff;
    }

    const micBtn = document.getElementById('civicbot-mic');
    if (micBtn) {
      micBtn.setAttribute('title', t.micTooltip);
    }

    resetToWelcome();
  }

  function clearChat() {
    stopSpeaking();
    stopListening();

    const t = I18N[currentLang];
    if (confirm(t.clearConfirm)) {
      conversationHistory.length = 0;
      resetToWelcome();
    }
  }

  function resetToWelcome() {
    const container = document.getElementById('civicbot-messages');
    container.innerHTML = '';

    const t = I18N[currentLang];
    const user = (window.api && typeof window.api.getUser === 'function') ? window.api.getUser() : null;
    let personalizedWelcome = t.welcomeMsg;
    if (user && user.name) {
      personalizedWelcome = (currentLang === 'te' 
        ? `నమస్కారం **${user.name}** గారు! ` 
        : `Welcome back, **${user.name}**! `) + personalizedWelcome;
    }

    // Append Welcome Message (without auto-speak on initial render)
    appendMessage({
      role: 'bot',
      text: personalizedWelcome,
      provider: 'CivicPulse Smart AI',
      skipAutoSpeak: true
    });

    // Append Suggestions
    appendSuggestions();
  }

  function appendSuggestions() {
    const container = document.getElementById('civicbot-messages');
    const t = I18N[currentLang];

    const box = document.createElement('div');
    box.className = 'cb-suggestions-box';
    box.innerHTML = `
      <div class="cb-suggestions-title"><i class="fas fa-lightbulb" style="color: #f59e0b;"></i> ${t.suggestedTitle}</div>
      <div class="cb-suggestions-list">
        ${t.suggestions.map(q => `
          <button type="button" class="cb-chip" onclick="window.CivicBot.askQuestion('${q.replace(/'/g, "\\'")}')">
            <span>${q}</span>
            <i class="fas fa-chevron-right"></i>
          </button>
        `).join('')}
      </div>
    `;

    container.appendChild(box);
    scrollToBottom();
  }

  function appendMessage({ role, text, provider = null, time = null, skipAutoSpeak = false }) {
    const container = document.getElementById('civicbot-messages');
    const msgEl = document.createElement('div');
    msgEl.className = `cb-msg ${role}`;

    const icon = role === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let providerBadge = '';
    let speakerPill = '';

    if (role === 'bot') {
      if (provider) {
        const isAi = provider.includes('Gemini') || provider.includes('Groq');
        const iconPill = isAi ? 'fa-bolt' : 'fa-database';
        providerBadge = `<span class="cb-provider-pill"><i class="fas ${iconPill}"></i> ${provider}</span>`;
      }
      const label = currentLang === 'te' ? I18N.te.listenBtnText : I18N.en.listenBtnText;
      speakerPill = `
        <button type="button" class="cb-speak-pill" title="Read aloud / బిగ్గరగా చదవండి" aria-label="Read reply aloud">
          <i class="fas fa-volume-up"></i>
          <span>${label}</span>
        </button>
      `;
    }

    msgEl.innerHTML = `
      <div class="cb-msg-avatar">${icon}</div>
      <div class="cb-bubble-content">
        <div class="cb-bubble">
          ${formatMarkdown(text)}
        </div>
        <div class="cb-meta">
          <span>${timeStr}</span>
          ${providerBadge}
          ${speakerPill}
        </div>
      </div>
    `;

    // Hook speaker button on bot reply
    if (role === 'bot') {
      const speakBtn = msgEl.querySelector('.cb-speak-pill');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => {
          if (currentSpeakingBtn === speakBtn) {
            stopSpeaking();
          } else {
            stopSpeaking();
            currentSpeakingBtn = speakBtn;
            speakBtn.classList.add('speaking');
            const stopLabel = currentLang === 'te' ? I18N.te.stopBtnText : I18N.en.stopBtnText;
            speakBtn.innerHTML = `<i class="fas fa-stop"></i> <span>${stopLabel}</span>`;
            speakText(text, detectLanguage(text), null, () => {
              resetSpeakButton(speakBtn);
              if (currentSpeakingBtn === speakBtn) currentSpeakingBtn = null;
            });
          }
        });
      }

      // Auto-speak if Voice is On
      if (isVoiceAutoOn && !skipAutoSpeak) {
        speakText(text, detectLanguage(text), () => {
          if (speakBtn) {
            currentSpeakingBtn = speakBtn;
            speakBtn.classList.add('speaking');
            const stopLabel = currentLang === 'te' ? I18N.te.stopBtnText : I18N.en.stopBtnText;
            speakBtn.innerHTML = `<i class="fas fa-stop"></i> <span>${stopLabel}</span>`;
          }
        }, () => {
          if (speakBtn) resetSpeakButton(speakBtn);
          if (currentSpeakingBtn === speakBtn) currentSpeakingBtn = null;
        });
      }
    }

    container.appendChild(msgEl);
    scrollToBottom();
  }

  function showTypingIndicator() {
    removeTypingIndicator();
    const container = document.getElementById('civicbot-messages');

    const typingEl = document.createElement('div');
    typingEl.id = 'cb-typing-indicator';
    typingEl.className = 'cb-msg bot';
    typingEl.innerHTML = `
      <div class="cb-msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="cb-typing">
        <span class="cb-dot"></span>
        <span class="cb-dot"></span>
        <span class="cb-dot"></span>
      </div>
    `;

    container.appendChild(typingEl);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('cb-typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    const container = document.getElementById('civicbot-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Handle Send Form
  async function handleSend(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSending) return;

    const input = document.getElementById('civicbot-input');
    const text = input.value.trim();
    if (!text) return;

    // Clear input
    input.value = '';

    // Stop listening if mic was open
    stopListening();

    // Append User Message
    appendMessage({ role: 'user', text });
    conversationHistory.push({ role: 'user', content: text });

    // Lock send
    isSending = true;
    document.getElementById('civicbot-send').disabled = true;
    showTypingIndicator();

    try {
      const token = (window.api && typeof window.api.getToken === 'function') ? window.api.getToken() : null;

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${BACKEND_BASE}/chatbot/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          language: currentLang,
          conversationHistory: conversationHistory.slice(-6)
        })
      });

      const data = await res.json().catch(() => null);

      removeTypingIndicator();

      if (data && data.success && data.reply) {
        appendMessage({
          role: 'bot',
          text: data.reply,
          provider: data.provider || 'CivicPulse Engine'
        });
        conversationHistory.push({ role: 'bot', content: data.reply });
      } else {
        const errorFallback = currentLang === 'te'
          ? 'క్షమించండి, సివిక్‌బాట్ సమాధానం రూపొందించడంలో తాత్కాలిక సమస్య ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి లేదా నేరుగా [ఫిర్యాదు పేజీకి](/report-issue.html) వెళ్ళండి.'
          : 'I apologize, but CivicBot encountered a temporary processing delay. Please try again or head directly to [Report an Issue](/report-issue.html).';

        appendMessage({
          role: 'bot',
          text: (data && data.reply) || errorFallback,
          provider: 'Offline Resilience'
        });
      }
    } catch (err) {
      removeTypingIndicator();
      console.warn('CivicBot network error:', err);

      const networkFallback = currentLang === 'te'
        ? 'సర్వర్ కనెక్టివిటీ సమస్య ఏర్పడింది. దయచేసి బ్యాకెండ్ సర్వర్ రన్ అవుతోందో లేదో తనిఖీ చేయండి.'
        : 'Cannot reach the CivicPulse AI server. Please make sure the backend server is running.';

      appendMessage({
        role: 'bot',
        text: networkFallback,
        provider: 'Connection Notice'
      });
    } finally {
      isSending = false;
      document.getElementById('civicbot-send').disabled = false;
      input.focus();
    }
  }

  // Public Interface for suggested chip clicks
  window.CivicBot = {
    init: renderCivicBot,
    toggle: toggleChat,
    speak: speakText,
    stopSpeaking: stopSpeaking,
    toggleVoice: toggleAutoVoice,
    askQuestion: function (q) {
      const input = document.getElementById('civicbot-input');
      if (input) {
        input.value = q;
        handleSend();
      }
    }
  };

  // Auto-init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCivicBot);
  } else {
    renderCivicBot();
  }
})();

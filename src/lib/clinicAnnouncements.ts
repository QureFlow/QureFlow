let audioContext: AudioContext | undefined;
let activeUtterance: SpeechSynthesisUtterance | undefined;
let cancelPending: (() => void) | undefined;

export function stopClinicAnnouncements() {
  cancelPending?.();
  try {
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) window.speechSynthesis.cancel();
  } catch { /* The browser may already be shutting down. */ }
}

// Run before awaiting the API so the browser sees the staff member's click.
export function prepareClinicAudio() {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    }
  } catch {
    // A blocked chime must not prevent the independent voice announcement.
  }
  try {
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
  } catch {
    // Report speech failures when an announcement is actually requested.
  }
}

function playChime() {
  try {
    if (!audioContext || audioContext.state !== 'running') return;
    const ctx = audioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {
    // Speech can still work when Web Audio is unavailable.
  }
}

export function announceClinic(text: string, onError: (message: string) => void) {
  cancelPending?.();
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) {
    onError('Voice announcements are unavailable in this browser. Open QureFlow in Chrome or Edge.');
    return;
  }

  let voiceTimer: ReturnType<typeof setTimeout> | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let utterance: SpeechSynthesisUtterance | undefined;
  let finished = false;
  const cleanup = () => {
    finished = true;
    clearTimeout(voiceTimer);
    clearTimeout(startTimer);
    synth.removeEventListener('voiceschanged', start);
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      if (activeUtterance === utterance) activeUtterance = undefined;
    }
    if (cancelPending === cleanup) cancelPending = undefined;
  };
  const fail = (message: string) => {
    if (finished) return;
    cleanup();
    try { synth.cancel(); } catch { /* Already unavailable. */ }
    onError(message);
  };
  const start = () => {
    if (finished || utterance) return;
    try {
      const voices = synth.getVoices();
      if (!voices.length) return;
      clearTimeout(voiceTimer);
      synth.removeEventListener('voiceschanged', start);
      // Prefer an installed English voice; no patient names or contact data are spoken.
      const english = voices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
      const localEnglish = english.filter((voice) => voice.localService);
      const candidates = localEnglish.length ? localEnglish : english;
      const voice = candidates.find((item) => /^en-IN$/i.test(item.lang)) ||
        candidates.find((item) => item.default) || candidates[0] ||
        voices.find((item) => item.default) || voices[0];
      utterance = new window.SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.92;
      utterance.volume = 1;
      // Retain the utterance until playback ends, including browsers that use weak references.
      activeUtterance = utterance;
      utterance.onstart = () => clearTimeout(startTimer);
      utterance.onend = cleanup;
      utterance.onerror = (event) => fail(
        event.error === 'not-allowed'
          ? 'Voice playback was blocked. Click Test voice, then Repeat announcement. Check that the tab is unmuted.'
          : 'The voice could not play. Check your speakers and try Test voice, then Repeat announcement.',
      );
      startTimer = setTimeout(() => fail(
        'Voice playback did not start. Unmute the tab, check your speakers, and click Test voice or Repeat announcement.',
      ), 8000);
      if (synth.speaking || synth.pending) synth.cancel();
      if (synth.paused) synth.resume();
      playChime();
      synth.speak(utterance);
    } catch {
      fail('The voice could not play. Try Test voice in Chrome or Edge and check that the tab is unmuted.');
    }
  };
  cancelPending = cleanup;
  synth.addEventListener('voiceschanged', start);
  voiceTimer = setTimeout(() => {
    start();
    if (!utterance) fail('No speaking voice is available. Enable an English speech voice on this device, then reload QureFlow.');
  }, 2000);
  start();
}

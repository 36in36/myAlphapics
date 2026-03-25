let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let userHasInteracted = false;
let speechUnlocked = false;

// Detect iOS (Safari or PWA)
const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  
  voicesLoaded = true;
  
  // Ranked preference: natural-sounding English voices
  const preferred = [
    'Samantha',                    // macOS/iOS — excellent
    'Google US English',           // Chrome — very natural
    'Google UK English Female',    // Chrome — warm, clear
    'Karen',                       // macOS — Australian, friendly
    'Microsoft Zira',              // Windows — decent female
    'Microsoft Jenny',             // Windows 11 — natural
    'Microsoft Aria',              // Windows 11 — natural
  ];
  
  for (const name of preferred) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) {
      preferredVoice = match;
      console.log('TTS: Using voice:', match.name);
      return;
    }
  }
  
  // Fallback: first English voice that isn't too robotic
  const englishVoice = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('eSpeak'));
  if (englishVoice) {
    preferredVoice = englishVoice;
    console.log('TTS: Fallback voice:', englishVoice.name);
  } else {
    console.warn('TTS: No English voice found among', voices.length, 'voices');
  }
}

// Track user interaction — required for speech on mobile
function markInteraction() {
  if (userHasInteracted) return;
  userHasInteracted = true;
  
  // "Warm up" the speech engine with a real (but inaudible) utterance
  // Empty string doesn't work on iOS — use a space or short word at volume 0
  if (window.speechSynthesis) {
    // Cancel anything pending first
    window.speechSynthesis.cancel();
    
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0.01; // iOS ignores volume=0, use near-zero
    warmup.rate = 2;      // Make it fast
    warmup.onend = () => {
      speechUnlocked = true;
      console.log('TTS: Speech unlocked after warmup');
    };
    warmup.onerror = () => {
      // Still mark as attempted — some iOS versions fire error for near-silent
      speechUnlocked = true;
      console.log('TTS: Warmup error (may still be unlocked)');
    };
    window.speechSynthesis.speak(warmup);
    console.log('TTS: Warmup initiated after user interaction');
  }
  
  // Also warm up audio elements for sound effects
  if (typeof Audio !== 'undefined') {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {}
  }
}

// Voices load async in Chrome — need to listen for the event
if (typeof window !== 'undefined') {
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  
  // Listen for first user interaction — use multiple events for reliability
  // In iOS PWA mode, touchstart is the most reliable
  const interactionEvents = ['click', 'touchstart', 'touchend', 'keydown'];
  interactionEvents.forEach((evt) => {
    document.addEventListener(evt, markInteraction, { once: true, capture: true });
  });
}

// Chrome bug: speechSynthesis hangs after ~15s. Keep-alive with periodic resume.
// SKIP on iOS — pause/resume kills speech on Safari
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  if (isIOS) return; // Don't use keep-alive on iOS
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('TTS: speechSynthesis not available');
      resolve();
      return;
    }
    
    if (!voicesLoaded) {
      loadVoices();
      if (!voicesLoaded) {
        console.warn('TTS: Voices not loaded yet, retrying in 200ms');
        setTimeout(() => {
          loadVoices();
          doSpeak(text, resolve);
        }, 200);
        return;
      }
    }
    
    doSpeak(text, resolve);
  });
}

function doSpeak(text: string, resolve: () => void) {
  // Cancel any in-progress speech
  window.speechSynthesis.cancel();
  
  // iOS sometimes needs a brief delay after cancel
  const delay = isIOS ? 50 : 0;
  
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = 1.1;
    
    if (preferredVoice) {
      u.voice = preferredVoice;
    }
    
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        stopKeepAlive();
        resolve();
      }
    };
    
    u.onend = safeResolve;
    u.onerror = (e) => {
      console.warn('TTS: Speech error:', e.error, 'for text:', text.substring(0, 40));
      safeResolve();
    };
    
    startKeepAlive();
    window.speechSynthesis.speak(u);
    
    // Safety timeout — resolve if speech never fires onend
    setTimeout(safeResolve, 10000);
  }, delay);
}

let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let userHasInteracted = false;

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  
  voicesLoaded = true;
  
  // Ranked preference: natural-sounding English voices
  const preferred = [
    'Google US English',           // Chrome — very natural
    'Google UK English Female',    // Chrome — warm, clear
    'Samantha',                    // macOS/iOS — excellent
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
  
  // "Warm up" the speech engine with a silent utterance on first tap
  // This unlocks speechSynthesis on iOS/Android
  if (window.speechSynthesis) {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
    console.log('TTS: Warmed up after user interaction');
  }
}

// Voices load async in Chrome — need to listen for the event
if (typeof window !== 'undefined') {
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  
  // Listen for first user interaction
  ['click', 'touchstart', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, markInteraction, { once: true, capture: true });
  });
}

// Chrome bug: speechSynthesis hangs after ~15s. Keep-alive with periodic resume.
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
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
      // If still no voices, wait briefly for them
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
  
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  u.pitch = 1.1;
  
  if (preferredVoice) {
    u.voice = preferredVoice;
  }
  
  u.onend = () => {
    stopKeepAlive();
    resolve();
  };
  u.onerror = (e) => {
    console.warn('TTS: Speech error:', e.error, 'for text:', text.substring(0, 40));
    stopKeepAlive();
    resolve();
  };
  
  startKeepAlive();
  window.speechSynthesis.speak(u);
  
  // Safety timeout — if speech never fires onend (mobile bug), resolve anyway
  setTimeout(() => {
    if (window.speechSynthesis.speaking) {
      console.warn('TTS: Safety timeout — speech still going after 10s');
    }
    resolve();
  }, 10000);
}

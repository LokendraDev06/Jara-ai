/* =============================================
   Jara – app.js
   Chat logic, animations, Hinglish AI interface
   ============================================= */

const API_URL = "http://127.0.0.1:5000/api/chat";

// ── State ────────────────────────────────────────
let isSpeaking = false;
let micActive = false;
let recognition = null;
let currentAudio = null;
let typewriterInterval = null;

// ── DOM refs ─────────────────────────────────────
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatPanel = document.getElementById("chatPanel");
const waveform = document.getElementById("waveform");
const avatarRing = document.getElementById("avatarRingOuter");
const avatarSvg = document.querySelector(".avatar-svg-wrapper");
const dateEl = document.getElementById("dateText");
const timeEl = document.getElementById("timeText");

// ── Live Clock ───────────────────────────────────
function updateClock() {
  const now = new Date();
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const d = days[now.getDay()];
  const m = months[now.getMonth()];
  const date = now.getDate();
  const yr = now.getFullYear();
  let h = now.getHours();
  const min = String(now.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  dateEl.textContent = `${d}, ${m} ${date}, ${yr}`;
  timeEl.textContent = `${h}:${min} ${ampm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Avatar animation helpers ─────────────────────
function setSpeaking(val) {
  isSpeaking = val;
  if (val) {
    waveform.classList.add("active");
    avatarRing.classList.add("speaking");
    avatarSvg.classList.add("speaking");
  } else {
    waveform.classList.remove("active");
    avatarRing.classList.remove("speaking");
    avatarSvg.classList.remove("speaking");
  }
}

// SVG animations removed as we now use a realistic image avatar.
// Animations are now handled via CSS classes on .avatar-svg-wrapper.
function startMouthAnim() { /* No-op for image avatar */ }
function stopMouthAnim() { /* No-op for image avatar */ }


// Blink animation removed for static image avatar.
function triggerBlink() { /* No-op for image avatar */ }

// ── Stop All Speech & Animations ─────────────────
function stopAllSpeech() {
  // 1. Stop HTML5 Audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // 2. Stop Web Speech Synthesis
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // 3. Stop Typewriter Interval
  if (typewriterInterval) {
    clearInterval(typewriterInterval);
    typewriterInterval = null;
  }

  // 4. Reset AI State & Animations
  setSpeaking(false);
  stopMouthAnim();
}

// ── Voice / TTS ──────────────────────────────────

function cleanTextForSpeech(text) {
  if (!text) return "";
  
  return text
    // 1. Remove Markdown Bold (**text**) and Italic (*text* or _text_)
    .replace(/(\*\*|__|\*|_)/g, "")
    // 2. Remove Markdown Headers (### Header)
    .replace(/^#+\s+/gm, "")
    // 3. Remove List dots/dashes at start of lines (e.g. "- Item" or "1. Item")
    .replace(/^[\s\t]*([-*+]|\d+\.)\s+/gm, "")
    // 4. Remove Emojis and Graphics using Unicode property escapes
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Symbol}]/gu, "")
    // 5. Remove specific annoying symbols like em-dash or bullet points
    .replace(/[—•●○]|\(Psst.*?\)/gi, "")
    // 6. Final cleanup: multiple spaces/newlines to single space
    .replace(/\s+/g, " ")
    .trim();
}


async function speak(text) {
  // If no audio context or busy, just animation fallback
  if (!text) return;
  
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return; // Nothing to say after filtering

  // Stop any previous audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    // 1. बैकएंड से ऑडियो जनरेट करवाएं (Fetch audio from backend)
    const response = await fetch("http://127.0.0.1:5000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("TTS Proxy failed:", errData.error || response.status);
      console.log("🔄 Falling back to Web Speech API...");
      speakNative(cleanText);
      return;
    }

    const data = await response.json();
    if (data.status !== "success") throw new Error("TTS failed to save file");

    // 2. जब फाइल तैयार हो जाए, उसे ऐसे प्ले करें:
    const audio = new Audio(data.file + '?t=' + new Date().getTime()); // ताज़ा फाइल के लिए टाइमस्टैम्प

    audio.onplay = () => {
      setSpeaking(true);
      startMouthAnim();
    };

    audio.onended = () => {
      setSpeaking(false);
      stopMouthAnim();
    };

    audio.onerror = () => {
      setSpeaking(false);
      stopMouthAnim();
    };

    currentAudio = audio;
    await audio.play();

  } catch (err) {
    console.error("TTS Error:", err);
    console.log("🔄 Falling back to Web Speech API...");
    speakNative(cleanText);
  }
}

/**
 * Fallback to browser's native TTS (Web Speech API)
 */
function speakNative(text) {
  if (!window.speechSynthesis) {
    // Ultimate fallback: just animation
    setSpeaking(true);
    startMouthAnim();
    setTimeout(() => {
      setSpeaking(false);
      stopMouthAnim();
    }, 2000);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  
  // Strict priority: High Quality Female -> Female -> Any Natural
  const bestVoice = 
    voices.find(v => (v.name.includes("Natural") || v.name.includes("Neural")) && (v.name.includes("Female") || v.name.includes("Raveena") || v.name.includes("Heera"))) ||
    voices.find(v => v.name.includes("Female") || v.name.includes("Raveena") || v.name.includes("Heera") || v.name.includes("Google Hindi")) ||
    voices.find(v => v.lang && (v.lang.includes("hi") || v.lang.includes("en-IN")));
  
  if (bestVoice) {
    utterance.voice = bestVoice;
    console.log("🔊 Fallback Voice Selection:", bestVoice.name);
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.1;

  utterance.onstart = () => {
    setSpeaking(true);
    startMouthAnim();
  };
  utterance.onend = () => {
    setSpeaking(false);
    stopMouthAnim();
  };
  utterance.onerror = () => {
    setSpeaking(false);
    stopMouthAnim();
  };

  window.speechSynthesis.speak(utterance);
}



function startBlinkLoop() {
  triggerBlink();
  const delay = 3000 + Math.random() * 3000;
  setTimeout(startBlinkLoop, delay);
}

// ── Message rendering ────────────────────────────
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatPanel.scrollTop = chatPanel.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "msg ai typing";
  div.id = "typingIndicator";
  div.textContent = "Jara soch rahi hai...";
  chatMessages.appendChild(div);
  chatPanel.scrollTop = chatPanel.scrollHeight;
  return div;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// ── Simulate typewriter for AI response ──────────
function typewriterMessage(text) {
  const div = addMessage("", "ai");
  let i = 0;
  const speed = Math.min(30, Math.max(8, 1000 / text.length));
  
  // Start speaking
  speak(text);

  if (typewriterInterval) clearInterval(typewriterInterval);

  typewriterInterval = setInterval(() => {
    div.textContent += text[i];
    i++;
    chatPanel.scrollTop = chatPanel.scrollHeight;
    if (i >= text.length) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
      // animation state is now managed by speech.onend
    }
  }, speed);
}

// ── Core send function ───────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Interrupt previous speech/animations
  stopAllSpeech();

  chatInput.value = "";
  addMessage(text, "user");

  setSpeaking(true);
  startMouthAnim();
  const typingEl = addTypingIndicator();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    removeTypingIndicator();

    if (response.ok) {
      const reply = data.reply || "Sorry, kuch problem aa gayi. Phir try karo!";
      typewriterMessage(reply);
    } else {
      // Use specific error reply from server if available
      const errMsg = data.reply || `Server error: ${response.status} 😅`;
      addMessage(errMsg, "ai");
      setSpeaking(false);
      stopMouthAnim();
    }
  } catch (err) {
    removeTypingIndicator();
    setSpeaking(false);
    stopMouthAnim();
    console.error("API Error:", err);
    addMessage("Arre yaar, lagta hai internet mein thoda panga hai. Ek baar connect karke dekho na! 😅💖", "ai");
  }
}

// ── Quick message (feature buttons) ─────────────
function sendQuickMessage(text) {
  chatInput.value = text;
  sendMessage();
}

// ── Keyboard handler ─────────────────────────────
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── Mic button with STT ──────────────────────────
function toggleMic() {
  // Always stop existing speech when interacting with mic
  stopAllSpeech();
  if (micActive) {
    stopRecording();
    return;
  }

  // Check for SpeechRecognition support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage("Arre! Aapka browser voice recognition support nahi karta. Chrome use karein! 😅", "ai");
    return;
  }

  startRecording(SpeechRecognition);
}

function startRecording(SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'hi-IN'; // Hindlish support
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const btn = document.getElementById("micBtn");

  recognition.onstart = () => {
    micActive = true;
    btn.classList.add("recording");
    addMessage("🎙️ Bolna shuru kijiye...", "ai");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage(); // Auto send
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    stopRecording();
    if (event.error === 'not-allowed') {
      addMessage("Mic ki permission chahiye! Settings mein check karein. 🎤", "ai");
    }
  };

  recognition.onend = () => {
    stopRecording();
  };

  recognition.start();
}

function stopRecording() {
  micActive = false;
  const btn = document.getElementById("micBtn");
  btn.classList.remove("recording");
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

// ── Init ─────────────────────────────────────────
function init() {
  startBlinkLoop();

  // Welcome message after a short delay
  setTimeout(() => {
    const greetings = [
      "Namaste! Main Jara hoon — tumhari AI saathi 🌟 Kya help chahiye?",
      "Heyy! Main Jara hoon 😊 Batao, main kya kar sakti hoon tumhare liye?",
      "Sat Sri Akal! Main Jara hoon — tumhara personal AI assistant ✨ Kuch poochho!",
    ];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    setTimeout(() => {
      typewriterMessage(g);
    }, 600);
  }, 800);
}

document.addEventListener("DOMContentLoaded", init);

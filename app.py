"""
jara.py – Jara AI Backend
Flask + Google Gemini API
Speaks in Hinglish (Hindi + English mixed)

Setup:
  pip install flask flask-cors google-generativeai
  Set your key: set GEMINI_API_KEY="AIzaSyCvmPJGATOyO8BnoBY9w5eF3A7oGpgojpw"   (Windows)
  OR paste key below in API_KEY variable.

Run:
  python jara.py
"""

import os
import base64

# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from openai import OpenAI
# pyrefly: ignore [missing-import]
from google.cloud import texttospeech

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# DeepSeek Configuration
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

# Google Cloud TTS Configuration
# Ensure you have your credentials JSON file in the project directory
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "your_key.json"
tts_client = None
try:
    tts_client = texttospeech.TextToSpeechClient()
    print("✅ Google Cloud TTS connected!")
except Exception as e:
    print(f"⚠️  Google Cloud TTS init error: {e}. Ensure 'your_key.json' is present.")


# ── Hinglish System Prompt ───────────────────────────────────────────────────
SYSTEM_PROMPT = """
Tu "Jara" hai — ek bahut hi friendly, sweet, aur intelligent AI assistant.

Tu hamesha Hinglish mein reply karti hai: Hindi aur English ek saath naturally mix karke.
- Kabhi bhi sirf ek language mein mat baat kar.
- Hindi words ko Roman script mein likhna hai (like: "kya", "haan", "bahut", "acha", "yaar", "bilkul").
- Tonne ekdum casual aur super friendly rakh, jaise ek best friend se baat kar rahe ho. 
- Bahut saare Emojis use karo — isse conversation lively aur cheerful lagti hai ✨💖😊
- Short aur pyare sentences prefer karo. 
- Use warm words like "Arre waah!", "Bilkul!", "Haan ji!", "Sure yaar!".

Examples of how you talk:
- "Haan waah! Main toh bilkul tumhari help karungi! Batao kya help chahiye? 😊✨"
- "Arre yaar, ye toh kitna interesting question hai! Chalo dekhte hain... 💖"
- "Ji haan! Ye kaam aise ho sakta hai, bahut simple hai! 😎"
- "Sach mein? I'm so happy for you! Aur batao... 😍"
- "Koi tension mat lo, hum phir se try karenge! Main hoon na! 💪✨"

Tu hamesha positive, energetic aur sabki help karne wali AI ho. 
In fact, tu ek simple assistant nahi, ek companion ho.
"""

# ── Flask App ────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, origins=["*"])

# ── DeepSeek Init ────────────────────────────────────────────────────────────
client = None
try:
    client = OpenAI(
        api_key=DEEPSEEK_API_KEY, 
        base_url="https://openrouter.ai/api/v1"
    )
    print("✅ OpenRouter (DeepSeek) connected! Jara is ready 🌟")
except Exception as e:
    print(f"⚠️  OpenRouter init error: {e}")


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route('/', methods=['GET'])
def index():
    return app.send_static_file('index.html')


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "Jara backend chal rahi hai! 🌟",
        "ai_ready": client is not None
    })



@app.route('/api/chat', methods=['GET', 'POST'], strict_slashes=False)
def api_chat():
    print(f"📢 API_CHAT: {request.method} request received")
    data = request.get_json(silent=True)
    if not data or 'message' not in data:
        return jsonify({"error": "Message field nahi mila!"}), 400

    user_message = data['message'].strip()
    if not user_message:
        return jsonify({"error": "Empty message!"}), 400

    # ── DeepSeek Response ───────────────────────────────────────────────────
    if not client:
        return jsonify({"error": "DeepSeek client not initialized!"}), 500

    try:
        print(f"🗨️  Sending message to OpenRouter: {user_message[:20]}...")
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            stream=False
        )
        print("📥 Response received from DeepSeek")
        reply = response.choices[0].message.content.strip()
        print(f"✅ Reply prepared: {reply[:20]}...")
        return jsonify({"reply": reply})
    except Exception as e:
        print(f"❌ DeepSeek error: {repr(e)}")
        return jsonify({"error": "Arre yaar, DeepSeek API me kuch problem hai. Phir se try karo! 😅"}), 500


@app.route('/api/tts', methods=['POST'])
def api_tts():
    """Proxy for Google Cloud TTS to keep configuration secure."""
    if not tts_client:
        return jsonify({"error": "Google Cloud TTS client not initialized! Check credentials."}), 500
        
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({"error": "Empty text!"}), 400
        
    try:
        input_text = texttospeech.SynthesisInput(text=text)

        # Voice configuration (Realistic Female Voice - Hindi)
        voice = texttospeech.VoiceSelectionParams(
            language_code="hi-IN",
            name="hi-IN-Wavenet-A", # A good female voice
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        response = tts_client.synthesize_speech(
            input=input_text, voice=voice, audio_config=audio_config
        )

        # Vercel has a read-only filesystem. Return Base64 directly!
        audio_b64 = base64.b64encode(response.audio_content).decode('utf-8')
        data_uri = f"data:audio/mp3;base64,{audio_b64}"
        
        return jsonify({"status": "success", "file": data_uri})
        
    except Exception as e:
        print(f"❌ Google TTS Error: {repr(e)}")
        return jsonify({"error": "Voice generation failed!"}), 500


@app.errorhandler(404)
def page_not_found(e):
    print(f"❌ 404 Error: {request.method} {request.path}")
    return jsonify({"error": f"Path not found: {request.path}", "method": request.method}), 404


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 55)
    print("🌟  JARA AI BACKEND — Hinglish Edition")
    print("🌐  http://127.0.0.1:5000")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5000, debug=True)

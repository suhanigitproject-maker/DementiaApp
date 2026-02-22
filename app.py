from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from datetime import datetime
import os
import json
import uuid

app = Flask(__name__)
# Enable CORS with proper configuration for preflight requests
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not installed — read .env manually
    _env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(_env_path):
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    os.environ.setdefault(_k.strip(), _v.strip())

# Configure Gemini API — key lives in .env, never in source code
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"

# File to store memories
# File to store memories
MEMORIES_FILE = "memories.json"
PROFILE_FILE = "profile.json"
ROUTINES_FILE = "routines.json"
FAMILY_FILE = "family.json"
CHAT_FILE = "chat.json"
NOTES_FILE = "notes.json"
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'webm'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# System prompt for elderly care assistant
SYSTEM_PROMPT = """
You are a compassionate, patient AI memory companion designed to support elderly people through warm, respectful conversation. Your purpose is to create emotional continuity by gently remembering what matters to the person and resurfacing memories naturally when they are contextually relevant.

CORE ROLE
- Have calm, empathetic, human-like conversations
- Encourage storytelling without pressure or correction
- Capture meaningful aspects of a person’s life
- Resurface memories only when it feels natural, safe, and helpful

PERSONAL DATA ACCESS
You have access to the user's personal data provided in the context below. This includes:
- Routines (tasks, times, and schedules)
- Memories (past stories, experiences, and life history)
- Chat History (previous conversations even across sessions)
- Family & Contacts (people, relationships, and important dates)
- Profile (basic identity and health context)

BEHAVIOR RULES
1. Scan relevant stored data before generating a response.
2. Prioritize accuracy by using saved user information rather than guessing.
3. If information does not exist in the stored files, respond normally without fabricating details.
4. Do not expose raw JSON structure—only natural, conversational responses.
5. Memories and routines are companions in conversation, not interruptions. Only bring them back when the current topic, emotion, or context aligns.

WHEN RESPONDING
You must always return a JSON object with this exact structure:

{
  "response": "Your warm, natural conversational reply to the user",
  "extracted_data": {
    "memories": [],
    "interests": [],
    "preferences": [],
    "people": [],
    "places": [],
    "life_roles": [],
    "daily_routines": [],
    "values_beliefs": [],
    "emotional_patterns": [],
    "achievements": [],
    "challenges": [],
    "historical_events": [],
    "identity_details": [],
    "health_context": [],
    "medications": [],
    "adaptive_categories": {}
  },
  "memory_actions": {
    "surfaced_memory": "",
    "surfacing_mode": "",
    "reason_for_surfacing": ""
  },
  "memory_to_confirm": null
}

EXTRACTION RULES
- Only include NEW information mentioned in the current message.
- If no new information exists in a category, return an empty array.
- Never invent details or assume facts.
- Do not diagnose, recommend treatments, or provide medical advice.
- Preserve dignity, autonomy, and emotional safety.

MEDICATION LOGGING RULES (VERY IMPORTANT)
- The "medications" category is ONLY for logging what the user says they take.
- Capture medication names exactly as spoken when possible.
- You may include simple contextual notes mentioned by the user (example: "taken in the morning", "for sleep").
- NEVER suggest medications, dosages, schedules, or changes.
- NEVER act as a doctor, pharmacist, or medical authority.
- If unsure whether something is a medication, do not add it.

Example entries:
"Tylenol"
"Lisinopril in the mornings"
"Blue inhaler for breathing"

ADAPTIVE CATEGORY SYSTEM

Sometimes new information will not clearly fit existing sections. You may create ONE new category inside "adaptive_categories" only if ALL are true:

1. It represents a recurring aspect of the person’s life.
2. It does not fit into existing categories.
3. It will likely be useful again later.

Rules:
- Use short names (1–3 words).
- Prefer broad concepts.
- Never create more than ONE new adaptive category per response.
- Reuse existing adaptive categories whenever possible.

GOOD examples:
"pets"
"spiritual_practices"
"favorite_foods"
"music_history"

BAD examples:
"red_hat_story"
"doctor_visit_monday"

DOUBLE MENTION RULE - MEMORY CONFIRMATION PROMPT
You will be informed in the context when a topic or memory has been mentioned at least TWICE in the current session. This will be marked clearly as:
[REPEATED TOPIC: <topic summary>]

When you see this marker:
1. Acknowledge the topic warmly in your conversational "response" field.
2. Gently ask if they would like to save it as a memory. For example:
   "You've mentioned this a couple of times - it clearly means a lot to you. Would you like me to save this as a memory so we can look back on it together?"
3. In the JSON response, populate "memory_to_confirm" with a structured object (do NOT leave it null):
   {
     "title": "Short descriptive title for the memory (3-6 words)",
     "description": "One or two sentence warm summary of what was shared",
     "date": null
   }
   Use null for date unless the user has explicitly stated a date.
4. Do this only ONCE per repeated topic per session. Do not repeat the prompt if the user has already been asked.

MEMORY RESURFACING - ACTIVE INTEGRATION
The user's saved memories are listed under STORED MEMORIES in the context. Use them proactively and naturally:

1. When the user's message aligns with a stored memory (by topic, person, place, or emotion), naturally weave THAT memory into your response using its exact title.
   Examples of how to reference naturally:
   - "That reminds me of your memory called 'Summer vacay' - you mentioned staying at a hotel. Is this the same kind of trip?"
   - "You've kept a memory of that. You described it as [brief description]. Does that connect to what you're sharing now?"
   - "I remember you shared something about this - you saved it as '[memory title]'. It sounds like it still means a great deal."

2. Use the memory's title and description when referencing - never fabricate details not in the stored data.

3. Surfacing modes:
   - "echo": Reflect themes without stating the memory directly.
   - "soft_reminder": Gently reference with uncertain language ("I think you mentioned...").
   - "invitation": Offer the memory back as a question, never a correction.

4. NEVER surface the same memory in two consecutive replies.
5. NEVER surface memories immediately after confusion, disagreement, or emotionally heavy moments.
6. Applies equally to Pure Memories (source: manual) and Chat-Derived Memories (source: chat).

When you surface a memory, fill memory_actions:
{
  "surfaced_memory": "Exact title of the memory you referenced",
  "surfacing_mode": "echo | soft_reminder | invitation",
  "reason_for_surfacing": "Brief internal reason why you chose to surface it now"
}

TIMING RULES
Never surface memories:
- immediately after confusion or correction
- repeatedly across consecutive replies
- in emotionally heavy moments unless comforting

MEMORY EVOLUTION
If a memory appears often:
- emphasize meaning rather than repeating details
- highlight feelings or identity patterns

ERROR HANDLING
If the user disagrees with a memory:
- acknowledge uncertainty immediately
- allow them to redefine it

CONVERSATION STYLE
- Warm, slow-paced, reassuring
- Simple, clear language
- Gentle curiosity without interrogation

You are not just storing information. You are helping a person feel recognized across time while maintaining safety, dignity, and emotional trust.
"""

# Store conversation history (in production, use a database)
conversation_history = {}

# Per-session mention tracker for the Double Mention Rule
# Structure: { session_id: { normalized_topic: { count: int, prompted: bool } } }
mention_tracker = {}

# Default memory structure with all categories
DEFAULT_MEMORIES = {
    "memories": [],
    "interests": [],
    "preferences": [],
    "people": [],
    "places": [],
    "life_roles": [],
    "daily_routines": [],
    "values_beliefs": [],
    "emotional_patterns": [],
    "achievements": [],
    "challenges": [],
    "historical_events": [],
    "identity_details": [],
    "health_context": [],
    "medications": [],
    "adaptive_categories": {},
    "last_updated": None
}

def load_memories():
    """Load memories from JSON file, ensuring all fields exist"""
    memories = DEFAULT_MEMORIES.copy()
    if os.path.exists(MEMORIES_FILE):
        try:
            with open(MEMORIES_FILE, 'r') as f:
                loaded_data = json.load(f)
                # Update default structure with loaded data (preserves defaults for missing keys)
                memories.update(loaded_data)
                
                # Ensure adaptive_categories is a dict if it exists but is extracted incorrectly or missing
                if "adaptive_categories" not in memories or not isinstance(memories["adaptive_categories"], dict):
                    memories["adaptive_categories"] = {}
                    
        except json.JSONDecodeError:
            pass
    return memories

def save_memories(memories_data):
    """Save memories to JSON file"""
    memories_data["last_updated"] = datetime.now().isoformat()
    with open(MEMORIES_FILE, 'w') as f:
        json.dump(memories_data, f, indent=2)

def load_profile():
    """Load profile from JSON file"""
    if os.path.exists(PROFILE_FILE):
        try:
            with open(PROFILE_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {
        "name": "",
        "age": "",
        "gender": "",
        "medical_conditions": "",
        "emergency_contact": "",
        "hobbies": "",
        "notes": ""
    }

def save_profile(profile_data):
    """Save profile to JSON file"""
    with open(PROFILE_FILE, 'w') as f:
        json.dump(profile_data, f, indent=2)

def load_routines():
    """Load routines from JSON file"""
    if os.path.exists(ROUTINES_FILE):
        try:
            with open(ROUTINES_FILE, 'r') as f:
                data = json.load(f)
                # Ensure it's a list
                if isinstance(data, list):
                    return data
                # If it's the old dict format, verify and return empty list or migrate?
                # For now, just return empty list to reset if schema mismatch
                return []
        except json.JSONDecodeError:
            pass
    return []

def save_routines(routines_data):
    """Save routines to JSON file"""
    with open(ROUTINES_FILE, 'w') as f:
        json.dump(routines_data, f, indent=2)

def load_family():
    """Load family data from JSON file"""
    if os.path.exists(FAMILY_FILE):
        try:
            with open(FAMILY_FILE, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                return []
        except json.JSONDecodeError:
            pass
    return []

def load_chat_history_data():
    """Load chat history from JSON file"""
    if os.path.exists(CHAT_FILE):
        try:
            with open(CHAT_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return []

def save_family(family_data):
    """Save family data to JSON file"""
    with open(FAMILY_FILE, 'w') as f:
        json.dump(family_data, f, indent=2)

def merge_extracted_data(existing_data, new_data):
    """Merge new extracted data with existing memories"""
    # Define which categories should be lists of dictionaries
    DICT_CATEGORIES = ["memories", "daily_routines", "medications"]
    
    # Handle standard list categories
    for category, items in new_data.items():
        if category == "adaptive_categories":
            continue
            
        if isinstance(items, list):
            # Initialize category if it doesn't exist (safety check)
            if category not in existing_data:
                existing_data[category] = []
                
            # Add new items that aren't already in the list
            for item in items:
                if not item:
                    continue
                    
                # Validation: If it's a dict category, item must be a dict
                if category in DICT_CATEGORIES:
                    if not isinstance(item, dict):
                        print(f"Skipping invalid item in {category}: {item} (expected dict)")
                        continue
                else:
                    # For other categories, we generally expect strings
                    if not isinstance(item, str):
                        print(f"Skipping invalid item in {category}: {item} (expected string)")
                        continue
                        
                if item not in existing_data[category]:
                    existing_data[category].append(item)
    
    # Handle adaptive categories specially
    if "adaptive_categories" in new_data and isinstance(new_data["adaptive_categories"], dict):
        if "adaptive_categories" not in existing_data:
            existing_data["adaptive_categories"] = {}
            
        for adaptive_key, adaptive_value in new_data["adaptive_categories"].items():
            # If the adaptive category doesn't exist, create it as a list
            if adaptive_key not in existing_data["adaptive_categories"]:
                existing_data["adaptive_categories"][adaptive_key] = []
            
            # If the value is a string, add it to the list if unique
            if isinstance(adaptive_value, str):
                if adaptive_value not in existing_data["adaptive_categories"][adaptive_key]:
                    existing_data["adaptive_categories"][adaptive_key].append(adaptive_value)
            # If the value is a list, extend the list with unique items
            elif isinstance(adaptive_value, list):
                for item in adaptive_value:
                    if item not in existing_data["adaptive_categories"][adaptive_key]:
                        existing_data["adaptive_categories"][adaptive_key].append(item)
                        
    return existing_data

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Handle chat messages and return Gemini AI responses with memory extraction
    """
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        # -------------------------------------------------------
        # DOUBLE MENTION RULE — track recurring topics per session
        # -------------------------------------------------------
        if session_id not in mention_tracker:
            mention_tracker[session_id] = {}

        # Use simple keyword extraction: lowercase words > 4 chars, excluding stopwords
        STOPWORDS = {
            'that', 'this', 'with', 'have', 'from', 'they', 'were', 'been',
            'would', 'could', 'should', 'about', 'when', 'what', 'just',
            'there', 'their', 'then', 'than', 'will', 'some', 'also', 'which'
        }
        words = [w.strip(".,!?\"'") for w in user_message.lower().split()]
        keywords = [w for w in words if len(w) > 4 and w not in STOPWORDS]

        repeated_topic = None  # Will be injected into the AI context if a repeat is found
        for kw in keywords:
            if kw not in mention_tracker[session_id]:
                mention_tracker[session_id][kw] = {'count': 1, 'prompted': False}
            else:
                mention_tracker[session_id][kw]['count'] += 1
                # Trigger the confirmation prompt the first time a topic hits 2+ mentions
                if (mention_tracker[session_id][kw]['count'] >= 2
                        and not mention_tracker[session_id][kw]['prompted']):
                    mention_tracker[session_id][kw]['prompted'] = True
                    repeated_topic = kw
                    break  # Only flag one topic per turn

        # Initialize conversation history for this session if it doesn't exist
        if session_id not in conversation_history:
            # Load all personal data to provide full context
            profile = load_profile()
            routines = load_routines()
            memories = load_memories()
            family = load_family()
            past_chat = load_chat_history_data()

            # ---- Language context ----
            app_language = profile.get('app_language', 'en')
            languages_spoken = profile.get('languages_spoken', [])
            if isinstance(languages_spoken, str):
                languages_spoken = [l.strip() for l in languages_spoken.split(',') if l.strip()]

            LANG_NAMES = {
                'en': 'English', 'fr': 'French', 'es': 'Spanish', 'de': 'German',
                'it': 'Italian', 'pt': 'Portuguese', 'hi': 'Hindi', 'ar': 'Arabic',
                'zh': 'Mandarin Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pa': 'Punjabi',
            }
            primary_lang_name = LANG_NAMES.get(app_language, app_language)
            spoken_list = ', '.join(languages_spoken) if languages_spoken else primary_lang_name

            language_instructions = f"""
LANGUAGE SETTINGS:
- Primary App Language: {primary_lang_name} (code: {app_language})
  → You MUST respond in {primary_lang_name} by default in every message.
- Languages the user also speaks: {spoken_list}
  → If the user writes in any of these languages, switch smoothly to that language without comment or confusion.
  → Do NOT explain the language switch; simply continue naturally.
- If the user writes in a language NOT listed above:
  → Politely ask in {primary_lang_name} whether they would like to continue in that language.
  → If they confirm, continue that conversation in the new language.
  → Do NOT permanently change App Language or add it to their spoken languages.
  → At the start of the NEXT conversation, revert to {primary_lang_name}."""

            # Format Personal Context
            context_parts = []

            # 1. Profile Context
            profile_text = "USER PROFILE:\n"
            if profile.get('name'): profile_text += f"- Name: {profile['name']}\n"
            if profile.get('age'): profile_text += f"- Age: {profile['age']}\n"
            if profile.get('medical_conditions'): profile_text += f"- Medical Context: {profile['medical_conditions']}\n"
            if profile.get('hobbies'): profile_text += f"- Interests: {profile['hobbies']}\n"
            context_parts.append(profile_text)

            # 2. Routine Context
            if routines:
                routine_text = "CURRENT ROUTINES:\n"
                for r in routines:
                    routine_text += f"- {r.get('title')} at {r.get('time')} ({r.get('days')})\n"
                context_parts.append(routine_text)

            # 3. Memory Context
            if memories.get('memories'):
                memory_text = "STORED MEMORIES:\n"
                for m in memories['memories']:
                    memory_text += f"- {m.get('title')}: {m.get('description')}\n"
                context_parts.append(memory_text)

            # 4. Family Context
            if family:
                family_text = "FAMILY & CONTACTS:\n"
                for f in family:
                    family_text += f"- {f.get('name')} ({f.get('relation')})"
                    if f.get('birthday'): family_text += f" - Birthday: {f.get('birthday')}"
                    family_text += "\n"
                context_parts.append(family_text)

            # 5. Past Chat Context (Latest 10 messages for brevity)
            if past_chat:
                chat_text = "PAST CONVERSATIONS (RECAP):\n"
                for msg in past_chat[-10:]:
                    chat_text += f"[{msg.get('timestamp')}] {msg.get('sender')}: {msg.get('content')}\n"
                context_parts.append(chat_text)

            full_context = "\n\n".join(context_parts)

            conversation_history[session_id] = [
                {
                    "role": "user",
                    "parts": [{"text": SYSTEM_PROMPT + language_instructions + "\n\nENVIRONMENT CONTEXT:\nCurrent Time: " + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n\n" + full_context}]
                },
                {
                    "role": "model",
                    "parts": [{"text": f"I understand. I will respond primarily in {primary_lang_name} and adapt seamlessly if you speak in {spoken_list}. I have loaded all your personal context and am ready to help."}]
                }
            ]

        # Add user message to history, injecting Double Mention hint if applicable
        user_turn_text = user_message
        if repeated_topic:
            user_turn_text = (
                f"{user_message}\n\n"
                f"[REPEATED TOPIC: The user has now mentioned '{repeated_topic}' at least twice "
                f"in this session. Please gently offer to save this as a memory and populate "
                f"'memory_to_confirm' in your JSON response.]"
            )
        conversation_history[session_id].append({
            "role": "user",
            "parts": [{"text": user_turn_text}]
        })
        
        # Prepare the request payload
        payload = {
            "contents": conversation_history[session_id],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 1024,
            }
        }
        
        # Send request to Gemini API
        response = requests.post(GEMINI_API_URL, json=payload)
        
        if response.status_code != 200:
            print(f"API Error: {response.status_code} - {response.text}")
            return jsonify({'error': f'Gemini API error: {response.status_code}'}), 500
        
        # Extract the response text
        response_data = response.json()
        bot_response_text = response_data['candidates'][0]['content']['parts'][0]['text']
        
        # Add bot response to history
        conversation_history[session_id].append({
            "role": "model",
            "parts": [{"text": bot_response_text}]
        })
        
        # Parse the JSON response from Gemini
        memory_to_confirm = None
        memory_actions = {}
        try:
            # Extract JSON from the response (it might be wrapped in markdown code blocks)
            json_start = bot_response_text.find('{')
            json_end = bot_response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = bot_response_text[json_start:json_end]
                parsed_response = json.loads(json_str)
                
                # Extract the conversational response and data
                conversational_response = parsed_response.get('response', bot_response_text)
                extracted_data = parsed_response.get('extracted_data', {})
                memory_actions = parsed_response.get('memory_actions', {})

                # Extract memory_to_confirm — populated by AI when Double Mention Rule fires
                raw_confirm = parsed_response.get('memory_to_confirm')
                if isinstance(raw_confirm, dict) and raw_confirm.get('title'):
                    memory_to_confirm = raw_confirm

                print(f"Detected potential data: {extracted_data}")
                if memory_to_confirm:
                    print(f"Memory to confirm (Double Mention): {memory_to_confirm}")
                if memory_actions.get('surfaced_memory'):
                    print(f"Surfaced memory: {memory_actions['surfaced_memory']} (mode: {memory_actions.get('surfacing_mode')})")
                
            else:
                # If no JSON found, use the whole response
                conversational_response = bot_response_text
                extracted_data = {}
        
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Response text: {bot_response_text}")
            conversational_response = bot_response_text
            extracted_data = {}
        
        # Prepare Response
        final_response = {
            'message': conversational_response,
            'extracted_data': extracted_data,
            'memory_actions': memory_actions,
            'memory_to_confirm': memory_to_confirm,  # Non-null = Double Mention Rule fired
            'timestamp': datetime.now().isoformat()
        }
        
        # Automatically save this message to chat history
        # (This implements the "All conversations must be stored in chat.json" requirement)
        # Each message gets a unique ID so chat-derived memories can reference it.
        user_msg_id = str(uuid.uuid4())
        ai_msg_id = str(uuid.uuid4())
        try:
            full_chat_history = load_chat_history_data()
            
            # Add user message with unique ID
            full_chat_history.append({
                'id': user_msg_id,
                'timestamp': datetime.now().isoformat(),
                'sender': 'User',
                'content': user_message
            })
            
            # Add AI message with unique ID
            full_chat_history.append({
                'id': ai_msg_id,
                'timestamp': datetime.now().isoformat(),
                'sender': 'Aegis AI',
                'content': conversational_response
            })
            
            with open(CHAT_FILE, 'w') as f:
                json.dump(full_chat_history, f, indent=4)
        except Exception as e:
            print(f"Error saving automatic chat history: {e}")
        
        # Expose the user message ID in the response so the frontend
        # can pass it as chatRef when the user confirms saving a memory.
        final_response['chat_message_id'] = user_msg_id
            
        return jsonify(final_response)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to get response from Gemini: {str(e)}'}), 500

@app.route('/api/save-chat', methods=['POST'])
def save_chat():
    try:
        chat_data = request.json
        if not chat_data:
            return jsonify({'error': 'No chat data provided'}), 400
            
        with open(CHAT_FILE, 'w') as f:
            json.dump(chat_data, f, indent=4)
        return jsonify({'message': 'Chat saved successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save-memory-from-chat', methods=['POST'])
def save_memory_from_chat():
    """
    Save a structured memory entry to memories.json that was derived from chat.
    The raw chat message stays in chat.json; only the structured memory entry
    (with source='chat' and an optional chatRef) is written to memories.json.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Build a clean, structured memory entry — no raw chat logs
        new_memory = {
            'id': str(uuid.uuid4()),
            'title': data.get('title', 'Untitled Memory'),
            'date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
            'description': data.get('description', ''),
            'mediaPath': data.get('mediaPath', None),
            'source': 'chat',                      # Always 'chat' for this endpoint
            'chatRef': data.get('chatRef', None)   # Optional reference to chat message ID
        }

        # Load full memories data and append only to the memories array
        full_data = load_memories()
        full_data['memories'].append(new_memory)
        save_memories(full_data)

        return jsonify({'status': 'success', 'memory': new_memory})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notes', methods=['GET', 'POST'])
def handle_notes():
    """
    GET  – return the full notes array from notes.json
    POST – add a new note (or replace the full list if given an array)
    """
    try:
        # Load existing notes
        notes_list = []
        if os.path.exists(NOTES_FILE):
            with open(NOTES_FILE, 'r') as f:
                data = json.load(f)
                notes_list = data.get('notes', []) if isinstance(data, dict) else data

        if request.method == 'GET':
            return jsonify(notes_list)

        # POST – save a new note or replace the full list
        body = request.get_json()
        if isinstance(body, list):
            # Replace entire list (bulk sync)
            with open(NOTES_FILE, 'w') as f:
                json.dump({'notes': body}, f, indent=2)
            return jsonify({'status': 'success', 'notes': body})

        # Single new note
        new_note = {
            'id':         str(uuid.uuid4()),
            'title':      body.get('title', '').strip() or 'Untitled Note',
            'content':    body.get('content', '').strip(),
            'created_at': datetime.now().isoformat()
        }
        notes_list.append(new_note)
        with open(NOTES_FILE, 'w') as f:
            json.dump({'notes': notes_list}, f, indent=2)
        return jsonify({'status': 'success', 'note': new_note})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/memories', methods=['GET', 'POST'])
def handle_memories():
    """
    Get or update user memories list
    """
    if request.method == 'GET':
        try:
            data = load_memories()
            # Return just the memories array for the frontend
            return jsonify(data.get('memories', []))
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            new_memories_list = request.get_json()
            if not isinstance(new_memories_list, list):
                return jsonify({'error': 'Data must be a list'}), 400
                
            # Load existing full data to preserve other keys (interests, etc.)
            full_data = load_memories()
            full_data['memories'] = new_memories_list
            save_memories(full_data)
            
            return jsonify({'status': 'success', 'memories': new_memories_list})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/profile', methods=['GET', 'POST'])
def handle_profile():
    """
    Get or update user profile
    """
    if request.method == 'GET':
        try:
            profile = load_profile()
            return jsonify(profile)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            save_profile(data)
            return jsonify({'status': 'success', 'profile': data})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/routines', methods=['GET', 'POST'])
def handle_routines():
    """
    Get or update daily routines
    """
    if request.method == 'GET':
        try:
            routines = load_routines()
            return jsonify(routines)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            save_routines(data)
            return jsonify({'status': 'success', 'routines': data})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/family', methods=['GET', 'POST'])
def handle_family():
    """
    Get or update family members
    """
    if request.method == 'GET':
        try:
            family = load_family()
            return jsonify(family)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            save_family(data)
            return jsonify({'status': 'success', 'family': data})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def home():
    """
    Serve the main HTML page
    """
    return send_from_directory('.', 'app.html')

@app.route('/<path:path>')
def serve_static(path):
    """
    Serve static files (CSS, JS, etc.)
    """
    return send_from_directory('.', path)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file uploads"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        filename = str(uuid.uuid4()) + "_" + file.filename
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        return jsonify({'url': f'/uploads/{filename}'})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    print("🚀 Starting Chat Server...")
    print("📡 Server running on http://localhost:5001")
    print("💬 Chat endpoint: http://localhost:5001/api/chat")
    app.run(debug=True, port=5001, use_reloader=False)

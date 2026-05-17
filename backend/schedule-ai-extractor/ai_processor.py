import json
from urllib import request, error

from config import DEEPSEEK_API_KEY, DEEPSEEK_API_URL, DEEPSEEK_MODEL

class ScheduleProcessor:
    @staticmethod
    def process_schedule_text(text_content):
        """Send PDF text to DeepSeek for extraction"""
        if not DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is missing")

        prompt = f"""
        Analyze this class schedule text and extract all course information.
        
        Return ONLY a JSON array with this structure for each class:
        [
            {{
                "course_name": "Course Name or Code",
                "course_code": "CS101",
                "time": "9:00 AM - 10:30 AM",
                "days": ["Monday"],
                "location": "Room 101",
                "instructor": "Prof. Name",
                "credits": 3,
                "description": "Brief course description if available"
            }}
        ]
        
        IMPORTANT RULES:
        - Return ONLY valid JSON array, no additional text
        - If course_name is not available, use the course_code as the course_name
        - If instructor is not found, use "TBA" instead of null
        - Days should be full day names
        - Time format: "HH:MM AM/PM - HH:MM AM/PM"
        - If a field is truly missing, set it to appropriate default (empty string for text, empty array for days, 0 for credits)
        
        Schedule Text:
        {text_content}
        """

        payload = {
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": "You extract structured schedule data. Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            DEEPSEEK_API_URL,
            method="POST",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            },
        )

        try:
            with request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"DeepSeek HTTP {exc.code}: {body}")
        except Exception as exc:
            raise RuntimeError(f"DeepSeek request failed: {exc}")

        parsed = json.loads(raw) if raw else {}
        if parsed.get("error"):
            raise RuntimeError(parsed["error"].get("message", "DeepSeek error"))

        return (
            parsed.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
    
    @staticmethod
    def parse_json_response(response_text):
        """Parse JSON response from DeepSeek"""
        try:
            # Try to find JSON in response (in case there's extra text)
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                parsed = json.loads(json_str)
                
                # Ensure parsed data is a list
                if not isinstance(parsed, list):
                    parsed = [parsed]
                
                # Clean up parsed data
                cleaned = []
                for item in parsed:
                    # Use course_code as course_name if name is missing
                    if not item.get('course_name') or item.get('course_name') == 'N/A':
                        item['course_name'] = item.get('course_code', 'Unknown Course')
                    
                    # Set default instructor
                    if not item.get('instructor') or item.get('instructor') == 'N/A':
                        item['instructor'] = 'TBA'
                    
                    cleaned.append(item)
                
                return cleaned
            
            return []
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            print(f"Response text: {response_text[:200]}")
            return []

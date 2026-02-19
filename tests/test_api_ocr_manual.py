import requests
import json
import os

# Configuration
BASE_URL = "http://localhost:8000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
OCR_URL = f"{BASE_URL}/api/nurse/ocr"
IMAGE_PATH = r"tests/data/english_rx.jpg"

# Credentials (from api/middleware/auth.py)
USERNAME = "nurse_001"
PASSWORD = "Nurse@2024!"

def run_test():
    print(f"🔹 1. Logging in as {USERNAME}...")
    try:
        login_payload = {
            "staff_id": USERNAME,
            "password": PASSWORD
        }
        session = requests.Session()
        resp = session.post(LOGIN_URL, json=login_payload)
        
        if resp.status_code != 200:
            print(f"❌ Login failed: {resp.status_code} - {resp.text}")
            return

        print("✅ Login successful")
        
        # Extract token
        # The API removes access_token from JSON body and puts it in cookie 'aira_access_token'
        # BUT the JWTBearer middleware expects Authorization header.
        # So we must grab the cookie and manually set the header if the server doesn't support cookie auth.
        
        token = None
        
        # Check cookies
        if 'aira_access_token' in resp.cookies:
            token = resp.cookies['aira_access_token']
            print("🔑 Found token in cookies")
        
        # Check body (just in case)
        try:
            data = resp.json()
            if 'token' in data and 'access_token' in data['token']:
                token = data['token']['access_token']
                print("🔑 Found token in response body")
        except:
            pass
            
        if not token:
            print("❌ Could not find access token in response or cookies.")
            print(f"Response headers: {resp.headers}")
            print(f"Response cookies: {resp.cookies}")
            print(f"Response body: {resp.text}")
            return

        # 2. Upload Image
        if not os.path.exists(IMAGE_PATH):
            print(f"❌ Image not found at {IMAGE_PATH}")
            return

        print(f"\n🔹 2. Sending OCR request using {IMAGE_PATH}...")
        
        files = {
            'image': ('english_rx.jpg', open(IMAGE_PATH, 'rb'), 'image/jpeg')
        }
        data = {
            'encounter_id': 'ENC-TEST-001',
            'patient_id': 'PT-TEST-001',
            'language_hint': 'en',
            'captured_by': 'nurse_001'
        }
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        # Note: requests handles multipart boundary automatically
        ocr_resp = requests.post(OCR_URL, headers=headers, data=data, files=files)
        
        print(f"Status: {ocr_resp.status_code}")
        try:
            print("Response:", json.dumps(ocr_resp.json(), indent=2))
        except:
            print("Response (raw):", ocr_resp.text)

    except Exception as e:
        print(f"❌ Test failed with exception: {e}")

if __name__ == "__main__":
    run_test()

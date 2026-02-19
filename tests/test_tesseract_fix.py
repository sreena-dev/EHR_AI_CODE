import os
import shutil
import pytesseract
from PIL import Image, ImageDraw, ImageFont

# Robust Tesseract path discovery
possible_paths = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe'),
    os.path.expandvars(r'%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe'),
]

# Check if tesseract is in PATH
if not shutil.which("tesseract"):
    found = False
    for p in possible_paths:
        if os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            print(f"Set tesseract cmd to: {p}")
            found = True
            break
    if not found:
        print("WARNING: Tesseract not found in common locations. OCR might fail.")

# Create test image
img = Image.new('RGB', (200, 50), color='white')
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("arial.ttf", 20)
except:
    font = ImageFont.load_default()
d.text((10, 10), "Test 123", fill=(0, 0, 0), font=font)

# Test OCR
try:
    # Explicitly cast to str to satisfy static analysis (linter thinks it might be a dict)
    text = str(pytesseract.image_to_string(img, lang='eng'))
    print("✅ TESSERACT WORKING!")
    print(f"Detected: '{text.strip()}'")
    
    # Test Tamil language pack availability
    langs = pytesseract.get_languages()
    print(f"\nAvailable languages: {', '.join(langs[:10])}")
    if 'tam' in langs:
        print("✅ Tamil language pack installed")
    else:
        print("⚠️  Tamil language pack MISSING - install from https://github.com/tesseract-ocr/tessdata")
        
except Exception as e:
    print(f"❌ FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
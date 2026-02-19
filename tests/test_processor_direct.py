import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.getcwd())

from services.ocr.processor import PrescriptionOCRProcessor, LanguageMode

async def main():
    print("🔹 Testing PrescriptionOCRProcessor directly...")
    
    # Use the preserved temp file from the API failure
    image_path = Path(r"C:\Users\Asus\AppData\Local\Temp\aira_ocr_1nx7ccb7\ocr_ENC-TEST-001_english_rx.jpg")
    if not image_path.exists():
        print(f"❌ Image not found: {image_path}")
        # Fallback to local test data if temp is gone
        image_path = Path(r"tests/data/english_rx.jpg")
        print(f"⚠️  Falling back to: {image_path}")

    try:
        processor = PrescriptionOCRProcessor(language_mode=LanguageMode.ENGLISH)
        print("✅ Processor initialized")
        
        print(f"🔹 Processing {image_path}...")
        result = await processor.process_prescription(
            image_path=image_path,
            encounter_id="TEST-001"
        )
        
        print("\n✅ OCR SUCCESS!")
        print(f"Detected Language: {result.language_detected}")
        print(f"Confidence: {result.confidence.mean:.2f}%")
        print(f"Raw Text Preview: {result.raw_text[:100]}...")
        
    except Exception as e:
        print(f"\n❌ OCR FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import sys
import os
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))

from services.ocr.paddle_ocr import PaddleOCRService
from services.ocr.config import LanguageMode

async def main():
    try:
        service = PaddleOCRService(lang='en')
        
        image_path = Path("tests/data/image.png")
        if not image_path.exists():
            print(f"Error: {image_path} not found")
            return

        print(f"Processing {image_path} with PaddleOCR...")
        
        # Test Text Extraction
        text, conf = service.extract_text(str(image_path))
        print("\n--- Extracted Text Preview ---")
        print(text[:500] + "..." if len(text) > 500 else text)
        print(f"\nConfidence: {conf.mean:.2f}%")
        
        # Test Table Extraction
        print("\n--- Extracting Lab Results (PPStructure) ---")
        results = service.extract_lab_results(str(image_path))
        
        if results:
            print(f"Found {len(results)} lab results:")
            for res in results:
                print(f"  - {res.test_name}: {res.result_value} {res.unit or ''} [{res.reference_range or ''}] -> {res.interpretation or 'N/A'}")
        else:
            print("No structured lab results found.")
            
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

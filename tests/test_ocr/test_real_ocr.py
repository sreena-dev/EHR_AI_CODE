# test_real_ocr.py
import sys
import os
import asyncio
# from unittest.mock import patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from services.ocr.processor import PrescriptionOCRProcessor
from services.ocr.config import LanguageMode
from core.workflow import AIRAWorkflow
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    # Initialize
    workflow = AIRAWorkflow(patient_id="PT-REAL-001", encounter_id="ENC-REAL-001")
    ocr_processor = PrescriptionOCRProcessor(language_mode=LanguageMode.ENGLISH)

    # Process REAL image
    # Note: process_prescription is an async method
    # with patch('pytesseract.image_to_data') as mock_ocr:
        # Mock OCR response
        # mock_ocr.return_value = {
        #     'text': ['Patient:', 'John', 'Doe', 'Tab.', 'Amoxicillin', '500mg', 'BD'],
        #     'conf': [95, 90, 92, 98, 99, 95, 96],
        #     'left': [0]*7, 'top': [0]*7, 'width': [0]*7, 'height': [0]*7 # Required structure
        # }
        
    result = await ocr_processor.process_prescription(
        image_path="tests/data/image.png",
        encounter_id="ENC-REAL-001",
        workflow=workflow,
        triggered_by="test"
    )

    print(f"✅ OCR Success!")
    print(f"   Language: {result.language_detected}")
    print(f"   Confidence: {result.confidence.mean:.1f}%")
    print(f"   Text: {result.raw_text[:900]}...")
    print(f"   Safety flags: {result.safety_flags}")
    print(f"   Workflow state: {workflow.current_state.name}")

if __name__ == "__main__":
    asyncio.run(main())
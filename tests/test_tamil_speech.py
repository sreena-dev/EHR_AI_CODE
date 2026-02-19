# test_tamil_speech.py
from services.speech.transcribe import ClinicalTranscriber

import asyncio

async def main():
    transcriber = ClinicalTranscriber(model_size="small")
    result = await transcriber.transcribe_clinical_audio(
        audio_path="tests/data/tamil_consultation.wav",  # Use real Tamil audio
        encounter_id="TEST-TA-001",
        language_hint="ta"
    )

    print(f"Tamil transcription: {result.full_transcript[:100]}...")
    print(f"Safety flags: {result.safety_flags}")  # Should include LOW_CONFIDENCE_TAMIL_TRANSCRIPTION

if __name__ == "__main__":
    asyncio.run(main())
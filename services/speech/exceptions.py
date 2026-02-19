class TranscriptionError(Exception):
    def __init__(self, message: str, encounter_id: str):
        super().__init__(message)
        self.encounter_id = encounter_id

class LowConfidenceError(TranscriptionError):
    def __init__(self, message: str, confidence: float, language: str, encounter_id: str):
        super().__init__(message, encounter_id)
        self.confidence = confidence
        self.language = language

class LanguagePackMissingError(Exception):
    def __init__(self, message: str, language: str):
        super().__init__(message)
        self.language = language

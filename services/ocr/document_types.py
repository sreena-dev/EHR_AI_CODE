"""
Document type detection and classification for clinical documents.
Supports prescriptions, lab reports, and mixed documents.
"""
from enum import Enum
from typing import List, Tuple
import re

class DocumentType(Enum):
    """Supported clinical document types"""
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    UNKNOWN = "unknown"
    MIXED = "mixed"

class DocumentTypeDetector:
    """
    Detects document type using multi-modal analysis:
    1. Text content analysis (keywords, structure, weighted scoring)
    2. Layout analysis (tables, numeric columns)
    3. Strong indicator override (definitive lab keywords)
    """
    
    # Prescription indicators (medication-focused)
    # Removed ambiguous keywords (mg, ml, patient, date) that also appear in lab reports
    PRESCRIPTION_KEYWORDS = [
        r'\btab\b', r'\bcap\b', r'\bsyr\b', r'\binj\b', r'\btablet\b', r'\bcapsule\b',
        r'\bsyrup\b', r'\binjection\b',
        r'\bod\b', r'\bbd\b', r'\btds\b', r'\bqds\b', r'\bsos\b', r'\bdaily\b',
        r'\bmedication\b', r'\bmedicine\b', r'\bprescribed\b', r'\bRx\b',
        r'\bdoctor\b', r'\bdr\.\b', r'\bphysician\b',
        r'\bdosage\b', r'\bfrequency\b', r'\bduration\b',
    ]
    
    # Lab report indicators — OCR-tolerant patterns
    LAB_REPORT_KEYWORDS = [
        r'\btest\b', r'\bresult\b', r'\bvalue\b', r'\breference\b', r'\brange\b',
        r'\bnormal\b', r'\babnormal\b', r'\bpositive\b', r'\bnegative\b',
        r'\bh[ae]+moglobin\b', r'\bhba\s*1?\s*c\b', r'\bgl[uo]cose\b', r'\bcreatinine\b',
        r'\bcho?lesterol\b', r'\btriglycerides\b', r'\bcbc\b', r'\blft\b', r'\brft\b',
        r'\bpathology\b', r'\bbiochemistry\b', r'\bmicrobiology\b', r'\bradiology\b',
        r'\bunit\b', r'\breport\b',
        r'\bspecimen\b', r'\bfasting\b', r'\bpost\s*prandial\b', r'\burine\b',
        r'\bserum\b', r'\bblood\b', r'\bplasma\b',
    ]
    
    # Strong lab indicators — definitive signals worth 3× weight
    STRONG_LAB_INDICATORS = [
        r'\bgl[uo]cose\b', r'\bcho?lesterol\b', r'\bcreatinine\b',
        r'\bh[ae]+moglobin\b', r'\bhba\s*1?\s*c\b', r'\btriglycerides\b',
        r'\bpathology\b', r'\bbiochemistry\b', r'\bhaematology\b', r'\bhematology\b',
        r'\bspecimen\b', r'\breference\s+range\b', r'\bbiological\s+reference\b',
        r'\bcbc\b', r'\blft\b', r'\brft\b',
        r'\bfasting\b', r'\bpost\s*prandial\b',
        r'\bmg[/\\]d?l\b', r'\bmmol[/\\]l\b', r'\bU[/\\]L\b', r'\bIU[/\\]L\b',
    ]
    
    # Table indicators (strong lab report signal)
    TABLE_INDICATORS = [
        r'\|.*\|',  # Pipe-delimited tables
        r'[0-9]+\.[0-9]+\s+[0-9]+\.[0-9]+',  # Numeric columns
        r'\bmg/dl\b', r'\bmmol/l\b', r'\bg/l\b',  # Lab units
        r'\bU/L\b', r'\bIU/L\b', r'\bcells/mm3\b'
    ]
    
    # Structural lab report pattern: "Word  Number  Unit"
    LAB_VALUE_PATTERN = re.compile(
        r'[A-Za-z]+\s*[:\-]?\s*\d+\.?\d*\s*(?:mg|g|ml|mmol|U|IU|%|cells)',
        re.IGNORECASE
    )
    
    def detect_from_text(self, text: str, confidence_threshold: float = 0.6) -> Tuple[DocumentType, float]:
        """
        Detect document type from extracted text.
        Returns: (document_type, confidence_score)
        """
        text_lower = text.lower()
        
        # Count keyword matches
        prescription_score = sum(1 for pattern in self.PRESCRIPTION_KEYWORDS 
                               if re.search(pattern, text_lower))
        lab_score = sum(1 for pattern in self.LAB_REPORT_KEYWORDS 
                      if re.search(pattern, text_lower))
        table_score = sum(1 for pattern in self.TABLE_INDICATORS 
                        if re.search(pattern, text_lower))
        
        # Strong lab indicators get 3× weight
        strong_lab_count = sum(1 for pattern in self.STRONG_LAB_INDICATORS
                             if re.search(pattern, text_lower))
        lab_score += strong_lab_count * 2  # Already counted once in LAB_REPORT_KEYWORDS overlap
        
        # Boost lab score for table presence
        if table_score > 0:
            lab_score += table_score * 2
        
        # Structural pattern: count lines with "TestName Number Unit" format
        lab_value_matches = len(self.LAB_VALUE_PATTERN.findall(text))
        if lab_value_matches >= 2:
            lab_score += lab_value_matches * 2
        
        total_score = prescription_score + lab_score
        
        if total_score == 0:
            return DocumentType.UNKNOWN, 0.0
        
        prescription_conf = prescription_score / total_score
        lab_conf = lab_score / total_score
        
        # Decision logic — lab reports need lower threshold since they're more critical
        if strong_lab_count >= 3:
            # Strong override: 3+ definitive lab terms = definitely a lab report
            return DocumentType.LAB_REPORT, min(lab_conf + 0.2, 1.0)
        elif lab_conf > 0.45 and lab_score > prescription_score:
            return DocumentType.LAB_REPORT, lab_conf
        elif prescription_conf > confidence_threshold and lab_conf < 0.3:
            return DocumentType.PRESCRIPTION, prescription_conf
        elif lab_conf > confidence_threshold and prescription_conf < 0.3:
            return DocumentType.LAB_REPORT, lab_conf
        elif prescription_conf > 0.4 and lab_conf > 0.4:
            # Tie-breaker: if lab value patterns found, lean lab report
            if lab_value_matches >= 2:
                return DocumentType.LAB_REPORT, lab_conf
            return DocumentType.MIXED, max(prescription_conf, lab_conf)
        else:
            return DocumentType.UNKNOWN, max(prescription_conf, lab_conf)
    
    def detect_from_image(self, image_path: str) -> DocumentType:
        """
        Detect document type from image layout (stub for future enhancement).
        Currently delegates to text-based detection after OCR.
        """
        return DocumentType.UNKNOWN
    
    def get_expected_fields(self, document_type: DocumentType) -> List[str]:
        """Return expected clinical fields for document type"""
        fields = {
            DocumentType.PRESCRIPTION: [
                "patient_name", "doctor_name", "medications", "dosage", 
                "frequency", "duration", "diagnosis"
            ],
            DocumentType.LAB_REPORT: [
                "patient_name", "test_date", "tests", "results", 
                "reference_ranges", "interpretation"
            ],
            DocumentType.DISCHARGE_SUMMARY: [
                "admission_date", "discharge_date", "diagnosis", 
                "procedures", "medications", "follow_up"
            ]
        }
        return fields.get(document_type, [])
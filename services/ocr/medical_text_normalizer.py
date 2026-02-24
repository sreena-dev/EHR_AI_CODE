"""
Medical-domain-aware OCR text normalizer.

Sits between raw OCR output and downstream parsers to fix common
OCR errors in medical documents (lab reports, prescriptions).

Uses fuzzy matching against a medical terminology dictionary,
unit normalization, and context-aware character confusion fixes.
No external NLP dependencies — uses only stdlib difflib.
"""
import re
import logging
from difflib import get_close_matches
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class MedicalTextNormalizer:
    """
    Post-processes raw OCR text to correct medical-domain errors.
    
    Pipeline:
      1. Character-level confusion fixes (0/O, 1/l/I, etc.)
      2. Unit normalization (mgt→mg, mgrdl→mg/dl)
      3. Medical term fuzzy correction (Gtucose→Glucose)
      4. Line reconstruction (merge fragmented lines)
      5. Lab report structural cleanup
    """

    # ─── Medical Terminology Dictionary ───────────────────────────────
    # Common lab tests, clinical terms, and medication names.
    # All stored lowercase for matching; original casing restored contextually.
    MEDICAL_TERMS: Dict[str, str] = {
        # Biochemistry / Blood tests
        "glucose": "Glucose",
        "blood glucose": "Blood Glucose",
        "fasting": "Fasting",
        "post prandial": "Post Prandial",
        "postprandial": "Post Prandial",
        "random": "Random",
        "glycosylated": "Glycosylated",
        "hemoglobin": "Hemoglobin",
        "haemoglobin": "Haemoglobin",
        "hba1c": "HbA1c",
        "cholesterol": "Cholesterol",
        "total cholesterol": "Total Cholesterol",
        "hdl cholesterol": "HDL Cholesterol",
        "ldl cholesterol": "LDL Cholesterol",
        "vldl cholesterol": "VLDL Cholesterol",
        "triglycerides": "Triglycerides",
        "creatinine": "Creatinine",
        "urea": "Urea",
        "blood urea nitrogen": "Blood Urea Nitrogen",
        "bun": "BUN",
        "uric acid": "Uric Acid",
        "bilirubin": "Bilirubin",
        "total bilirubin": "Total Bilirubin",
        "direct bilirubin": "Direct Bilirubin",
        "indirect bilirubin": "Indirect Bilirubin",
        "albumin": "Albumin",
        "globulin": "Globulin",
        "total protein": "Total Protein",
        "sgot": "SGOT",
        "sgpt": "SGPT",
        "ast": "AST",
        "alt": "ALT",
        "alkaline phosphatase": "Alkaline Phosphatase",
        "alp": "ALP",
        "ggt": "GGT",
        "gamma gt": "Gamma GT",
        "calcium": "Calcium",
        "phosphorus": "Phosphorus",
        "sodium": "Sodium",
        "potassium": "Potassium",
        "chloride": "Chloride",
        "bicarbonate": "Bicarbonate",
        "magnesium": "Magnesium",
        "iron": "Iron",
        "ferritin": "Ferritin",
        "tibc": "TIBC",
        "transferrin": "Transferrin",
        "vitamin d": "Vitamin D",
        "vitamin b12": "Vitamin B12",
        "folate": "Folate",
        "folic acid": "Folic Acid",
        "thyroid": "Thyroid",
        "tsh": "TSH",
        "t3": "T3",
        "t4": "T4",
        "free t3": "Free T3",
        "free t4": "Free T4",
        "prolactin": "Prolactin",
        "cortisol": "Cortisol",
        "testosterone": "Testosterone",
        "estrogen": "Estrogen",
        "progesterone": "Progesterone",
        "insulin": "Insulin",
        "c-peptide": "C-Peptide",
        "amylase": "Amylase",
        "lipase": "Lipase",
        "troponin": "Troponin",
        "ck-mb": "CK-MB",
        "cpk": "CPK",
        "ldh": "LDH",
        "d-dimer": "D-Dimer",
        "fibrinogen": "Fibrinogen",
        "esr": "ESR",
        "crp": "CRP",
        "hsCRP": "hsCRP",
        "psa": "PSA",
        "cea": "CEA",
        "afp": "AFP",

        # Hematology / CBC
        "complete blood count": "Complete Blood Count",
        "cbc": "CBC",
        "wbc": "WBC",
        "rbc": "RBC",
        "platelet": "Platelet",
        "platelets": "Platelets",
        "platelet count": "Platelet Count",
        "hematocrit": "Hematocrit",
        "haematocrit": "Haematocrit",
        "pcv": "PCV",
        "mcv": "MCV",
        "mch": "MCH",
        "mchc": "MCHC",
        "rdw": "RDW",
        "neutrophil": "Neutrophil",
        "neutrophils": "Neutrophils",
        "lymphocyte": "Lymphocyte",
        "lymphocytes": "Lymphocytes",
        "monocyte": "Monocyte",
        "monocytes": "Monocytes",
        "eosinophil": "Eosinophil",
        "eosinophils": "Eosinophils",
        "basophil": "Basophil",
        "basophils": "Basophils",
        "reticulocyte": "Reticulocyte",

        # Urinalysis
        "urine": "Urine",
        "sugar urine": "Sugar Urine",
        "protein urine": "Protein Urine",
        "specific gravity": "Specific Gravity",
        "ph": "pH",
        "ketones": "Ketones",
        "blood in urine": "Blood in Urine",
        "pus cells": "Pus Cells",
        "epithelial cells": "Epithelial Cells",
        "cast": "Cast",
        "crystals": "Crystals",
        "bacteria": "Bacteria",
        "not detected": "Not Detected",
        "detected": "Detected",

        # Clinical Pathology
        "clinical pathology": "Clinical Pathology",
        "biochemistry": "Biochemistry",
        "haematology": "Haematology",
        "hematology": "Hematology",
        "microbiology": "Microbiology",
        "serology": "Serology",
        "immunology": "Immunology",
        "pathology": "Pathology",

        # Report sections
        "test name": "Test Name",
        "result": "Result",
        "value": "Value",
        "unit": "Unit",
        "reference range": "Reference Range",
        "biological reference": "Biological Reference",
        "normal range": "Normal Range",
        "specimen": "Specimen",
        "collected": "Collected",
        "received": "Received",
        "reported": "Reported",
        "department": "Department",
        "patient": "Patient",
        "physician": "Physician",
        "doctor": "Doctor",

        # Common Medications (Indian Market)
        "paracetamol": "Paracetamol",
        "amoxicillin": "Amoxicillin",
        "metformin": "Metformin",
        "atorvastatin": "Atorvastatin",
        "pantoprazole": "Pantoprazole",
        "amlodipine": "Amlodipine",
        "losartan": "Losartan",
        "azithromycin": "Azithromycin",
        "diclofenac": "Diclofenac",
        "ibuprofen": "Ibuprofen",
        "cetirizine": "Cetirizine",
        "levocetirizine": "Levocetirizine",
        "montelukast": "Montelukast",
        "omeprazole": "Omeprazole",
        "rabeprazole": "Rabeprazole",
        "telmisartan": "Telmisartan",
        "glimepiride": "Glimepiride",
        "vildagliptin": "Vildagliptin",
        "teneligliptin": "Teneligliptin",
        "sitagliptin": "Sitagliptin",
        "metoprolol": "Metoprolol",
        "bisoprolol": "Bisoprolol",
        "clopidogrel": "Clopidogrel",
        "aspirin": "Aspirin",
        "rosuvastatin": "Rosuvastatin",
        "furosemide": "Furosemide",
        "spironolactone": "Spironolactone",
        "thyroxine": "Thyroxine",
        "levothyroxine": "Levothyroxine",
        "prednisolone": "Prednisolone",
        "dexamethasone": "Dexamethasone",
        "ciprofloxacin": "Ciprofloxacin",
        "ofloxacin": "Ofloxacin",
        "norfloxacin": "Norfloxacin",
        "cefixime": "Cefixime",
        "cefpodoxime": "Cefpodoxime",
        "amoxiclav": "Amoxiclav",
        "augmentin": "Augmentin",
        "calpol": "Calpol",
        "dolo": "Dolo",
        "pan 40": "Pan 40",
        "limcee": "Limcee",
        "shelcal": "Shelcal",
        "evion": "Evion",
        "multivitamin": "Multivitamin",

        # Common dosage forms/freq
        "tablet": "Tablet",
        "capsule": "Capsule",
        "syrup": "Syrup",
        "injection": "Injection",
        "ointment": "Ointment",
        "drops": "Drops",
        "dosage": "Dosage",
        "frequency": "Frequency",
        "duration": "Duration",
        "diagnosis": "Diagnosis",
        "prescription": "Prescription",
        "od": "OD",
        "bd": "BD",
        "tds": "TDS",
        "tid": "TID",
        "qid": "QID",
        "stat": "STAT",
        "sos": "SOS",
        "hs": "HS",
        "ac": "AC",
        "pc": "PC",

        # Common Indian lab report terms
        "blood": "Blood",
        "serum": "Serum",
        "plasma": "Plasma",
        "whole blood": "Whole Blood",
        "sample": "Sample",
        "report": "Report",
        "end of report": "End of Report",
    }

    # ─── Unit Correction Rules ────────────────────────────────────────
    # (pattern, replacement) — applied sequentially
    UNIT_CORRECTIONS: List[Tuple[str, str]] = [
        # mg/dl variations
        (r'\bmgt\b', 'mg'),
        (r'\bmgr?dl\b', 'mg/dl'),
        (r'\bmg[\s/]*d[lI1]\b', 'mg/dl'),
        (r'\bmg[\s/]*d[lI1]\b', 'mg/dl'),
        (r'\bm[gq]/d[Il1]\b', 'mg/dl'),
        (r'\bmg[/\\]d[Il1]\b', 'mg/dl'),
        # g/dl
        (r'\bg[\s/]*d[lI1]\b', 'g/dl'),
        (r'\bg[/\\]d[Il1]\b', 'g/dl'),
        # mmol/l
        (r'\bmmol[\s/]*[lI1]\b', 'mmol/L'),
        (r'\bmmol[/\\][Il1]\b', 'mmol/L'),
        # U/L and IU/L
        (r'\bU[\s/]*[lI1]\b', 'U/L'),
        (r'\bIU[\s/]*[lI1]\b', 'IU/L'),
        # cells/mm3
        (r'\bcells[\s/]*mm\s*3\b', 'cells/mm3'),
        # mcg  
        (r'\bmcq\b', 'mcg'),
        (r'\bm[ce]g\b', 'mcg'),
        # ml
        (r'\bm[lI1]\b', 'ml'),
        # percentage
        (r'\b(\d+\.?\d*)\s*[%]\s*', r'\1%'),
        
        # Clinical Frequency Normalization
        (r'\b1\s*-\s*0\s*-\s*1\b', 'BD'),
        (r'\b1\s*-\s*1\s*-\s*1\b', 'TDS'),
        (r'\b1\s*-\s*0\s*-\s*0\b', 'OD (Morning)'),
        (r'\b0\s*-\s*0\s*-\s*1\b', 'OD (Night)'),
        (r'\b0\s*-\s*1\s*-\s*0\b', 'OD (Afternoon)'),
        (r'\b1\s*-\s*1\s*-\s*0\b', 'BD (Morning-Afternoon)'),
    ]

    # ─── OCR Character Confusion Patterns ─────────────────────────────
    # Context-sensitive: only applied within word boundaries for medical terms
    CHAR_CONFUSIONS: Dict[str, List[str]] = {
        'l': ['1', 'I', '|'],
        'I': ['1', 'l', '|'],
        'O': ['0', 'Q'],
        '0': ['O', 'o'],
        'S': ['5', '$'],
        'B': ['8', '3'],
        'G': ['6'],
        'g': ['q', '9'],
        'D': ['0'],
    }

    def __init__(self, similarity_threshold: float = 0.65):
        """
        Args:
            similarity_threshold: Minimum similarity ratio for fuzzy matching.
                Lower = more aggressive correction (more false positives).
                Recommended: 0.6-0.75
        """
        self.similarity_threshold = similarity_threshold
        # Precompute lowercase lookup
        self._term_lookup = {k.lower(): v for k, v in self.MEDICAL_TERMS.items()}
        self._term_keys = list(self._term_lookup.keys())

    def normalize(self, raw_text: str) -> Tuple[str, Dict]:
        """
        Full normalization pipeline.
        
        Returns:
            (normalized_text, correction_metadata)
            
        correction_metadata keys:
            - corrections_made: int — total number of corrections
            - term_corrections: list — [{original, corrected, similarity}]
            - unit_corrections: int — number of unit fixes
            - lines_merged: int — number of lines merged
        """
        if not raw_text or not raw_text.strip():
            return raw_text, {"corrections_made": 0}

        metadata = {
            "corrections_made": 0,
            "term_corrections": [],
            "unit_corrections": 0,
            "lines_merged": 0,
        }

        text = raw_text

        # Step 1: Reconstruct fragmented lines FIRST (before word-level processing)
        text, merge_count = self._reconstruct_lines(text)
        metadata["lines_merged"] = merge_count
        metadata["corrections_made"] += merge_count

        # Step 2: Fix obvious character confusions in a context-aware manner
        text = self._fix_char_confusions(text)

        # Step 3: Normalize units
        text, unit_count = self._normalize_units(text)
        metadata["unit_corrections"] = unit_count
        metadata["corrections_made"] += unit_count

        # Step 4: Fix medical terms using fuzzy matching
        text, term_corrections = self._correct_medical_terms(text)
        metadata["term_corrections"] = term_corrections
        metadata["corrections_made"] += len(term_corrections)

        # Step 5: Clean up whitespace and formatting
        text = self._cleanup_formatting(text)

        if metadata["corrections_made"] > 0:
            logger.info(
                f"Medical normalizer applied {metadata['corrections_made']} corrections "
                f"({len(term_corrections)} terms, {unit_count} units, {merge_count} line merges)"
            )

        return text, metadata

    def normalize_line(self, line: str) -> str:
        """
        Normalize a single OCR line (for use during PaddleOCR per-line processing).
        Lighter weight than full normalize() — skips line reconstruction.
        """
        if not line or not line.strip():
            return ""
        line = self._fix_char_confusions(line)
        line, _ = self._normalize_units(line)
        line, _ = self._correct_medical_terms(line)
        return line.strip()

    # ─── Internal Pipeline Steps ──────────────────────────────────────

    def _fix_char_confusions(self, text: str) -> str:
        """
        Context-aware character confusion fixes.
        Only applies substitutions when the result matches a known medical term.
        """
        # Process line-by-line to preserve newlines
        result_lines = []
        for line in text.split('\n'):
            words = line.split()
            fixed_words = []

            for word in words:
                # Skip pure numbers and very short words
                stripped = word.strip('.,;:!?()[]{}')
                if not stripped or stripped.replace('.', '').replace('-', '').isdigit():
                    fixed_words.append(word)
                    continue

                # Try to match after character substitution
                lower = stripped.lower()
                if lower in self._term_lookup:
                    fixed_words.append(word)
                    continue

                # Try single character substitutions
                best_match = self._try_char_substitutions(stripped)
                if best_match:
                    # Preserve surrounding punctuation
                    prefix = word[:word.index(stripped[0])] if stripped[0] in word else ''
                    suffix = word[word.rindex(stripped[-1]) + 1:] if stripped[-1] in word else ''
                    fixed_words.append(prefix + best_match + suffix)
                else:
                    fixed_words.append(word)

            result_lines.append(' '.join(fixed_words))

        return '\n'.join(result_lines)

    def _try_char_substitutions(self, word: str) -> Optional[str]:
        """Try character substitutions to match known medical terms."""
        lower = word.lower()

        # Generate candidate words by substituting confused characters
        for i, char in enumerate(lower):
            if char in self.CHAR_CONFUSIONS:
                for replacement in self.CHAR_CONFUSIONS[char]:
                    candidate = lower[:i] + replacement.lower() + lower[i+1:]
                    if candidate in self._term_lookup:
                        return self._term_lookup[candidate]

        return None

    def _normalize_units(self, text: str) -> Tuple[str, int]:
        """Fix garbled medical units."""
        count = 0
        for pattern, replacement in self.UNIT_CORRECTIONS:
            new_text, n = re.subn(pattern, replacement, text, flags=re.IGNORECASE)
            count += n
            text = new_text
        return text, count

    def _correct_medical_terms(self, text: str) -> Tuple[str, List[Dict]]:
        """
        Fuzzy-match words and multi-word phrases against medical dictionary.
        Uses difflib.get_close_matches for fast approximate matching.
        """
        corrections = []
        
        # First pass: multi-word phrases (2-3 word combinations)
        text, phrase_corrections = self._correct_phrases(text)
        corrections.extend(phrase_corrections)

        # Second pass: individual words (process line-by-line to preserve newlines)
        result_lines = []
        for line in text.split('\n'):
            words = line.split()
            corrected_words = []

            for word in words:
                stripped = word.strip('.,;:!?()[]{}*')
                if not stripped or len(stripped) < 3:
                    corrected_words.append(word)
                    continue

                # Skip numbers and already-correct terms
                if stripped.replace('.', '').replace('-', '').isdigit():
                    corrected_words.append(word)
                    continue

                lower = stripped.lower()
                if lower in self._term_lookup:
                    corrected_words.append(word)
                    continue

                # Fuzzy match against dictionary
                matches = get_close_matches(
                    lower,
                    self._term_keys,
                    n=1,
                    cutoff=self.similarity_threshold
                )

                if matches:
                    correct_term = self._term_lookup[matches[0]]
                    # Preserve surrounding punctuation
                    prefix = word[:len(word) - len(word.lstrip('.,;:!?()[]{}*'))]
                    suffix = word[len(word.rstrip('.,;:!?()[]{}*')):]
                    corrected_word = prefix + correct_term + suffix

                    # Only correct if it actually changed
                    if corrected_word != word:
                        corrections.append({
                            "original": stripped,
                            "corrected": correct_term,
                            "similarity": round(
                                1.0 - (len(set(lower) ^ set(matches[0])) / max(len(lower), len(matches[0]))),
                                2
                            )
                        })
                        corrected_words.append(corrected_word)
                        continue

                corrected_words.append(word)
            
            result_lines.append(' '.join(corrected_words))

        return '\n'.join(result_lines), corrections

    def _correct_phrases(self, text: str) -> Tuple[str, List[Dict]]:
        """Correct multi-word medical phrases."""
        corrections = []
        
        # Build list of multi-word terms
        multi_word_terms = {k: v for k, v in self._term_lookup.items() if ' ' in k}
        
        # Process line-by-line to preserve newlines
        result_lines = []
        for text_line in text.split('\n'):
            text_words = text_line.split()
            
            for term_lower, correct_form in multi_word_terms.items():
                words = term_lower.split()
                n_words = len(words)
                
                i = 0
                new_text_words = []
                while i < len(text_words):
                    if i + n_words <= len(text_words):
                        # Extract candidate phrase
                        candidate = ' '.join(w.strip('.,;:!?()[]{}*').lower() for w in text_words[i:i+n_words])
                        
                        # Length similarity check: reject if candidate length differs too much
                        len_ratio = len(candidate) / len(term_lower) if len(term_lower) > 0 else 0
                        if 0.7 <= len_ratio <= 1.4:
                            # Also check individual word similarity to prevent
                            # false matches like 'Glucose Cholesterol' -> 'HDL Cholesterol'
                            candidate_words = candidate.split()
                            term_words = term_lower.split()
                            words_similar = all(
                                get_close_matches(cw, [tw], n=1, cutoff=0.6)
                                for cw, tw in zip(candidate_words, term_words)
                            )
                            
                            if words_similar:
                                # Check fuzzy match with higher threshold for phrases
                                matches = get_close_matches(
                                    candidate, [term_lower], n=1, cutoff=max(self.similarity_threshold, 0.75)
                                )
                                
                                if matches:
                                    corrections.append({
                                        "original": ' '.join(text_words[i:i+n_words]),
                                        "corrected": correct_form,
                                        "similarity": 0.8
                                    })
                                    new_text_words.append(correct_form)
                                    i += n_words
                                    continue
                    
                    new_text_words.append(text_words[i])
                    i += 1
                
                text_words = new_text_words  # Refresh for next term
            
            result_lines.append(' '.join(text_words))

        return '\n'.join(result_lines), corrections

    def _reconstruct_lines(self, text: str) -> Tuple[str, int]:
        """
        Merge fragmented OCR lines that logically belong together.
        
        Heuristics:
        - A line with only a number/value merges with the previous line
        - A line starting with a unit merges with the previous line
        - A line starting with lowercase merges with the previous
        """
        lines = text.split('\n')
        if len(lines) <= 1:
            return text, 0

        merged = [lines[0]]
        merge_count = 0

        for i in range(1, len(lines)):
            line = lines[i].strip()
            if not line:
                merged.append('')
                continue

            prev = merged[-1].strip() if merged else ''

            should_merge = False

            # Rule 1: Line is just a number/value — merge with previous
            if re.match(r'^[\d.]+\s*(%|mg|g|ml|U|IU)?[/\\]?[a-zA-Z]*$', line):
                should_merge = True

            # Rule 2: Line starts with a unit (mg/dl, %, etc.)
            elif re.match(r'^(mg|g|ml|mmol|U|IU|cells)[/\\]', line, re.IGNORECASE):
                should_merge = True

            # Rule 3: Previous line ends with a hyphen or dash
            elif prev.endswith('-') or prev.endswith('–'):
                should_merge = True

            # Rule 4: Line starts with lowercase (continuation)
            elif line[0].islower() and prev and not prev.endswith('.'):
                should_merge = True

            if should_merge and merged:
                separator = ' ' if not merged[-1].endswith('-') else ''
                merged[-1] = merged[-1].rstrip('-–') + separator + line
                merge_count += 1
            else:
                merged.append(lines[i])

        return '\n'.join(merged), merge_count

    def _cleanup_formatting(self, text: str) -> str:
        """Final whitespace and formatting cleanup."""
        # Collapse multiple spaces
        text = re.sub(r'[ \t]+', ' ', text)
        # Fix spacing around colons (common in lab reports)
        text = re.sub(r'\s*:\s*', ': ', text)
        # Fix spacing around hyphens in ranges (e.g., "70 - 100")
        text = re.sub(r'(\d)\s*-\s*(\d)', r'\1 - \2', text)
        # Remove excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Trim lines
        text = '\n'.join(line.strip() for line in text.split('\n'))
        return text.strip()


# ─── Convenience Functions ────────────────────────────────────────────

_default_normalizer: Optional[MedicalTextNormalizer] = None

def get_normalizer() -> MedicalTextNormalizer:
    """Get or create the singleton normalizer instance."""
    global _default_normalizer
    if _default_normalizer is None:
        _default_normalizer = MedicalTextNormalizer()
    return _default_normalizer

def normalize_medical_text(text: str) -> Tuple[str, Dict]:
    """Convenience function for one-shot normalization."""
    return get_normalizer().normalize(text)

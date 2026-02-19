"""
Tests for the Medical Text Normalizer.
Validates fuzzy term correction, unit normalization, line reconstruction,
and end-to-end pipeline using real garbled OCR output from lab reports.
"""
import pytest
from services.ocr.medical_text_normalizer import MedicalTextNormalizer, normalize_medical_text


@pytest.fixture
def normalizer():
    return MedicalTextNormalizer(similarity_threshold=0.65)


class TestMedicalTermCorrection:
    """Test fuzzy matching of garbled medical terms."""

    @pytest.mark.parametrize("garbled,expected", [
        ("Gtucose", "Glucose"),
        ("Glucase", "Glucose"),
        ("HOLESTEROL", "Cholesterol"),
        ("Chlesterol", "Cholesterol"),
        ("Haemoglobin", "Haemoglobin"),  # Already correct — should not change
        ("Hemoglobin", "Hemoglobin"),    # Already correct
        ("Creatinine", "Creatinine"),    # Already correct
        ("Patholoqy", "Pathology"),      # q→g confusion
        ("Biocemistry", "Biochemistry"),
        ("Specinen", "Specimen"),
    ])
    def test_term_correction(self, normalizer, garbled, expected):
        result, meta = normalizer.normalize(garbled)
        assert expected.lower() in result.lower(), (
            f"Expected '{expected}' in normalized output, got '{result}'"
        )

    def test_correct_terms_unchanged(self, normalizer):
        """Already-correct medical terms should pass through unchanged."""
        correct_text = "Glucose Cholesterol Hemoglobin Creatinine CBC"
        result, meta = normalizer.normalize(correct_text)
        # The words should still be present (may have different casing)
        for word in ["Glucose", "Cholesterol", "Hemoglobin", "Creatinine", "CBC"]:
            assert word.lower() in result.lower()

    def test_numbers_not_corrupted(self, normalizer):
        """Numeric values must never be altered."""
        text = "Glucose: 100 mg/dl reference 70-100"
        result, _ = normalizer.normalize(text)
        assert "100" in result
        assert "70" in result


class TestUnitNormalization:
    """Test correction of garbled medical units."""

    @pytest.mark.parametrize("garbled,expected", [
        ("100 mgt", "100 mg"),
        ("100 mgrdl", "100 mg/dl"),
        ("5.42 %", "5.42%"),
    ])
    def test_unit_correction(self, normalizer, garbled, expected):
        result, meta = normalizer.normalize(garbled)
        assert expected in result, (
            f"Expected '{expected}' in '{result}'"
        )
        assert meta["unit_corrections"] > 0


class TestLineReconstruction:
    """Test merging of fragmented OCR lines."""

    def test_number_line_merges_with_previous(self, normalizer):
        text = "Glucose Fasting\n100\nmg/dl"
        result, meta = normalizer.normalize(text)
        # The number should merge with the previous line
        assert meta["lines_merged"] > 0

    def test_unit_line_merges_with_previous(self, normalizer):
        text = "Glucose: 100\nmg/dl"
        result, meta = normalizer.normalize(text)
        assert meta["lines_merged"] > 0

    def test_standalone_lines_preserved(self, normalizer):
        """Lines that are clearly separate should not be merged."""
        text = "Glucose Fasting: 100 mg/dl\nCholesterol Total: 200 mg/dl"
        result, meta = normalizer.normalize(text)
        assert "\n" in result  # Lines should stay separate


class TestEndToEnd:
    """Test with real garbled OCR output from user's sample."""

    SAMPLE_OCR_TEXT = """
BLOOD Gtucose - Fasting OCHEMISTR
ar 100 mgt
bioop GLUCOSE POST PRaNDIAL
a 106. 189 mgrdl
burcosyiaren HB (HBA IC)
. 42 39%
HOLESTEROL TOTAL* ve Upto 203 mad
OL - CHOLESTEROL*
upte 190 mgidt
CLINICAL PATHOLOGY
SUGAR URINE - FASTIN: Hot detest
SUGAR URINE - POST PRANDIAL ut
"""

    def test_full_normalization(self, normalizer):
        """The normalizer should significantly improve the garbled text."""
        result, meta = normalizer.normalize(self.SAMPLE_OCR_TEXT)

        # Should have made corrections
        assert meta["corrections_made"] > 0

        # Key medical terms should be corrected
        result_lower = result.lower()
        assert "glucose" in result_lower, f"'glucose' not found in: {result}"
        assert "cholesterol" in result_lower, f"'cholesterol' not found in: {result}"
        assert "clinical pathology" in result_lower, f"'clinical pathology' not found in: {result}"

    def test_normalization_metadata_populated(self, normalizer):
        """Metadata should report what was corrected."""
        _, meta = normalizer.normalize(self.SAMPLE_OCR_TEXT)
        assert "term_corrections" in meta
        assert "unit_corrections" in meta
        assert "lines_merged" in meta
        assert isinstance(meta["corrections_made"], int)

    def test_normalized_text_parseable(self, normalizer):
        """After normalization, the lab report parser should extract more fields."""
        from services.ocr.lab_report_parser import LabReportParser

        # Parse garbled text
        parser = LabReportParser()
        raw_results = parser.parse_lab_report(self.SAMPLE_OCR_TEXT)

        # Parse normalized text
        normalized, _ = normalizer.normalize(self.SAMPLE_OCR_TEXT)
        normalized_results = parser.parse_lab_report(normalized)

        # Normalized should extract at least as many results
        assert len(normalized_results) >= len(raw_results), (
            f"Normalized ({len(normalized_results)}) should extract >= raw ({len(raw_results)}) results"
        )


class TestNormalizeLine:
    """Test the lightweight per-line normalization."""

    def test_single_line_normalization(self, normalizer):
        line = "Gtucose Fasting 100 mgrdl"
        result = normalizer.normalize_line(line)
        assert "glucose" in result.lower()
        assert "mg/dl" in result

    def test_empty_line(self, normalizer):
        assert normalizer.normalize_line("") == ""
        assert normalizer.normalize_line("   ") == ""


class TestConvenienceFunction:
    """Test the module-level convenience function."""

    def test_normalize_medical_text(self):
        text = "Gtucose: 100 mgrdl"
        result, meta = normalize_medical_text(text)
        assert "glucose" in result.lower()
        assert meta["corrections_made"] > 0

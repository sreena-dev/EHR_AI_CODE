"""
Specialized parser for lab report tables and structured data.
Extracts tests, results, reference ranges, and interpretations.
"""
import re
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

@dataclass
class LabTestResult:
    """Structured lab test result"""
    test_name: str
    result_value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    interpretation: Optional[str] = None  # "High", "Low", "Normal"
    confidence: float = 1.0

class LabReportParser:
    """
    Parses lab report text into structured test results.
    Handles tables, free-text results, and reference ranges.
    """
    
    # Common lab test patterns — OCR-tolerant
    # Pattern: (regex, test_name_group, value_group, unit_group, range_group)
    TEST_PATTERNS = [
        # "Test Name : 123.4 mg/dl 70-100" (colon-separated with unit and range)
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\s*[:\-]\s*([0-9]+\.?[0-9]*)\s+([a-zA-Z/%]+(?:[/\\][a-zA-Z0-9]+)?)\s+([0-9]+\.?[0-9]*\s*[\-–]\s*[0-9]+\.?[0-9]*)', 1, 2, 3, 4),
        # "Test Name  123.4  mg/dl  (70-100)"
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\s{2,}([0-9]+\.?[0-9]*)\s+([a-zA-Z/%]+(?:[/\\][a-zA-Z0-9]+)?)\s+\(?([0-9]+\.?[0-9]*\s*[\-–]\s*[0-9]+\.?[0-9]*)\)?', 1, 2, 3, 4),
        # "Test Name : 123.4 unit" (no range)
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\s*[:\-]\s*([0-9]+\.?[0-9]*)\s*([a-zA-Z/%]+(?:[/\\][a-zA-Z0-9]+)?)', 1, 2, 3, None),
        # "Test Name  123.4  unit" (space-separated, no colon)
        (r'^([A-Z][a-zA-Z\s\-/()]+?)\s{2,}([0-9]+\.?[0-9]*)\s+([a-zA-Z/%]+(?:[/\\][a-zA-Z0-9]+)?)$', 1, 2, 3, None),
        # "Test Name : 123.4" (no unit, no range — minimal)
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\s*[:\-]\s*([0-9]+\.?[0-9]*)', 1, 2, None, None),
        # "Test Name*  123.4" (asterisk annotation common in lab reports)
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\*?\s{2,}([0-9]+\.?[0-9]*)', 1, 2, None, None),
        # Qualitative results: "Test Name : Not Detected / Positive / Negative"
        (r'([A-Za-z][A-Za-z\s\-/()]+?)\s*[:\-]\s*(Not\s+Detected|Detected|Positive|Negative|Nil|Trace|Normal)', 1, 2, None, None),
    ]
    
    # Interpretation keywords
    HIGH_INDICATORS = ['high', 'elevated', '↑', 'H', 'abnormal high']
    LOW_INDICATORS = ['low', 'decreased', '↓', 'L', 'abnormal low']
    
    def parse_lab_report(self, text: str) -> List[LabTestResult]:
        """Extract structured test results from lab report text"""
        results = []
        
        # Split into lines for line-by-line analysis
        lines = text.split('\n')
        
        # First pass: Table detection using alignment heuristics
        table_sections = self._detect_table_sections(lines)
        
        for section in table_sections:
            table_results = self._parse_table_section(section)
            results.extend(table_results)
        
        # Second pass: Free-text extraction for missed tests
        if not results:  # Fallback if table parsing failed
            results = self._parse_free_text(text)
        
        # Third pass: Interpretation assignment
        results = self._assign_interpretations(results, text)
        
        return results
    
    def _detect_table_sections(self, lines: List[str]) -> List[List[str]]:
        """Detect table-like sections using alignment heuristics"""
        sections = []
        current_section = []
        in_table = False
        
        for line in lines:
            line = line.strip()
            if not line:
                if in_table and current_section:
                    sections.append(current_section)
                    current_section = []
                in_table = False
                continue
            
            # Heuristics for table detection
            has_numbers = bool(re.search(r'\d+\.\d+|\d+', line))
            has_units = bool(re.search(
                r'\bmg[/\\]?d?l?\b|\bmmol[/\\]?l?\b|\bg[/\\]?d?l?\b|'
                r'\bU[/\\]?L\b|\bIU[/\\]?L\b|\bcells[/\\]?mm|\b%\b|'
                r'\bmg\b|\bml\b|\bmcg\b',
                line, re.IGNORECASE
            ))
            has_colon_or_tab = ':' in line or '\t' in line
            has_multi_space = bool(re.search(r'\s{2,}', line))  # Double-space often separates columns
            has_qualitative = bool(re.search(
                r'\b(Not\s+Detected|Detected|Positive|Negative|Nil|Normal|Abnormal)\b',
                line, re.IGNORECASE
            ))
            
            if (has_numbers or has_qualitative) and (has_units or has_colon_or_tab or has_multi_space):
                in_table = True
                current_section.append(line)
            elif in_table:
                # End of table section
                sections.append(current_section)
                current_section = []
                in_table = False
        
        if current_section:
            sections.append(current_section)
        
        return sections
    
    def _parse_table_section(self, lines: List[str]) -> List[LabTestResult]:
        """Parse a detected table section into structured results"""
        results = []
        
        for line in lines:
            # Try each pattern
            for pattern, name_group, value_group, unit_group, range_group in self.TEST_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    test_name = match.group(name_group).strip() if match.group(name_group) else "Unknown Test"
                    result_value = match.group(value_group).strip() if match.group(value_group) else ""
                    unit = match.group(unit_group).strip() if unit_group and match.group(unit_group) else None
                    reference_range = match.group(range_group).strip() if range_group and match.group(range_group) else None
                    
                    # Skip non-clinical values (page numbers, dates)
                    if result_value and (self._is_clinical_value(result_value) or self._is_qualitative_result(result_value)):
                        results.append(LabTestResult(
                            test_name=self._normalize_test_name(test_name),
                            result_value=result_value,
                            unit=unit,
                            reference_range=reference_range,
                            confidence=0.85
                        ))
                    break  # Stop at first match
        
        return results
    
    def _parse_free_text(self, text: str) -> List[LabTestResult]:
        """Fallback parser for free-text lab reports"""
        results = []
        
        # Simple pattern: "Test: Value Unit"
        pattern = r'(\w+[\w\s]+?):\s*([0-9.]+)\s*([a-zA-Z/]+)?'
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        for match in matches:
            test_name = match.group(1).strip()
            value = match.group(2).strip()
            unit = match.group(3).strip() if match.group(3) else None
            
            if self._is_clinical_value(value):
                results.append(LabTestResult(
                    test_name=test_name,
                    result_value=value,
                    unit=unit,
                    confidence=0.7
                ))
        
        return results
    
    def _assign_interpretations(self, results: List[LabTestResult], full_text: str) -> List[LabTestResult]:
        """Assign clinical interpretations (High/Low/Normal) based on context"""
        full_lower = full_text.lower()
        
        for result in results:
            # Check if test name appears near interpretation keywords
            test_lower = result.test_name.lower()
            
            # Find test location in text
            test_idx = full_lower.find(test_lower)
            if test_idx != -1:
                # Check nearby context (100 chars before/after)
                context_start = max(0, test_idx - 100)
                context_end = min(len(full_lower), test_idx + 100)
                context = full_lower[context_start:context_end]
                
                if any(ind in context for ind in self.HIGH_INDICATORS):
                    result.interpretation = "High"
                elif any(ind in context for ind in self.LOW_INDICATORS):
                    result.interpretation = "Low"
                elif "normal" in context:
                    result.interpretation = "Normal"
        
        return results
    
    def _is_clinical_value(self, value: str) -> bool:
        """Filter out non-clinical numeric values (page numbers, dates)"""
        try:
            num = float(value)
            # Clinical values typically between 0.01 and 10000
            return 0.01 <= num <= 10000
        except (ValueError, TypeError):
            return False
    
    def _is_qualitative_result(self, value: str) -> bool:
        """Check if value is a valid qualitative lab result."""
        qualitative = {
            'not detected', 'detected', 'positive', 'negative',
            'nil', 'trace', 'normal', 'abnormal', 'reactive', 'non-reactive'
        }
        return value.strip().lower() in qualitative

    # Common Indian lab test name aliases
    TEST_NAME_ALIASES = {
        'fbs': 'Fasting Blood Sugar',
        'ppbs': 'Post Prandial Blood Sugar',
        'rbs': 'Random Blood Sugar',
        'blood glucose fasting': 'Fasting Blood Glucose',
        'blood glucose post prandial': 'Post Prandial Blood Glucose',
        'blood glucose random': 'Random Blood Glucose',
        'glycosylated hb': 'HbA1c',
        'glycosylated hemoglobin': 'HbA1c',
        'glycosylated haemoglobin': 'HbA1c',
        'hba1c': 'HbA1c',
        'hba ic': 'HbA1c',
        'hba lc': 'HbA1c',
        'total cholesterol': 'Total Cholesterol',
        'hdl cholesterol': 'HDL Cholesterol',
        'ldl cholesterol': 'LDL Cholesterol',
        'vldl cholesterol': 'VLDL Cholesterol',
        'sugar urine fasting': 'Sugar Urine - Fasting',
        'sugar urine post prandial': 'Sugar Urine - Post Prandial',
    }

    def _normalize_test_name(self, name: str) -> str:
        """Normalize test name using aliases."""
        clean = re.sub(r'[\s\-]+', ' ', name.strip()).lower()
        if clean in self.TEST_NAME_ALIASES:
            return self.TEST_NAME_ALIASES[clean]
        return name.strip()
    
    def generate_summary(self, results: List[LabTestResult]) -> Dict[str, Any]:
        """Generate clinical summary of lab results"""
        abnormal_count = sum(1 for r in results if r.interpretation in ["High", "Low"])
        
        return {
            "total_tests": len(results),
            "abnormal_results": abnormal_count,
            "critical_findings": self._detect_critical_findings(results),
            "requires_review": abnormal_count > 0
        }
    
    def _detect_critical_findings(self, results: List[LabTestResult]) -> List[str]:
        """Detect clinically critical abnormalities"""
        critical = []
        
        for result in results:
            try:
                value = float(result.result_value)
                test_lower = result.test_name.lower()
                
                # Critical thresholds (simplified)
                if "potassium" in test_lower and (value < 2.5 or value > 6.0):
                    critical.append(f"Critical potassium: {value} {result.unit}")
                elif "sodium" in test_lower and (value < 120 or value > 160):
                    critical.append(f"Critical sodium: {value} {result.unit}")
                elif "creatinine" in test_lower and value > 5.0:
                    critical.append(f"Critical creatinine: {value} {result.unit}")
            except (ValueError, TypeError):
                continue
        
        return critical
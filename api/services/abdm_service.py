"""
ABDM Service Module
===================
Utility functions for ABHA validation, FHIR R4 Patient serialization,
and identity masking for ABDM compliance.
"""
import re
from datetime import datetime, date
from typing import Optional, Dict, Any


def validate_abha_number(abha_number: str) -> bool:
    """
    Validates a 14-digit ABHA number.
    Must be exactly 14 digits (ignoring hyphens).
    """
    if not abha_number:
        return False
        
    cleaned = abha_number.replace("-", "").strip()
    if not cleaned.isdigit() or len(cleaned) != 14:
        return False
        
    # NOTE: Actual ABDM implementations use specific checksum algorithms (often variations 
    # of Verhoeff or Luhn based on NHA docs) on the 14 digits. For this prototype, 
    # ensuring length and digit-only format is the primary validation pass.
    return True


def validate_abha_address(abha_address: str) -> bool:
    """
    Validates an ABHA Address (e.g., username@abdm).
    Should follow specific alphanumeric rules and end with an authorized suffix.
    """
    if not abha_address:
        return False
        
    pattern = r"^[a-zA-Z0-9.\-_]{3,50}@[a-zA-Z0-9]+$"
    return bool(re.match(pattern, abha_address.strip()))


def mask_id_number(id_number: str) -> str:
    """
    Masks an ID number, showing only the last 4 digits.
    Example: 123456789012 -> ********9012
    """
    if not id_number:
        return ""
        
    cleaned = id_number.strip()
    if len(cleaned) <= 4:
        return cleaned
        
    return "*" * (len(cleaned) - 4) + cleaned[-4:]


def format_fhir_date(d: Optional[date]) -> Optional[str]:
    """Format python date to FHIR YYYY-MM-DD"""
    if not d:
        return None
    return d.strftime("%Y-%m-%d")


def serialize_fhir_patient(patient_model) -> Dict[str, Any]:
    """
    Converts a SQLAlchemy Patient model to a FHIR R4 Patient resource
    compliant with ABDM profiles (NRCeS).
    """
    
    # 1. Base Resource Profile
    fhir_patient = {
        "resourceType": "Patient",
        "meta": {
            "profile": [
                "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
            ]
        },
        "id": patient_model.id,
        "identifier": [],
        "name": [],
        "telecom": [],
    }
    
    # 2. Identifiers (PID and ABHA)
    # Internal MRN (PID)
    fhir_patient["identifier"].append({
        "type": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                    "code": "MR",
                    "display": "Medical record number"
                }
            ]
        },
        "system": "https://health.aira.com/patient",
        "value": patient_model.id
    })
    
    # ABHA Health ID Number (System: ndhm.gov.in)
    if getattr(patient_model, "abha_number", None):
        fhir_patient["identifier"].append({
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "MR",
                        "display": "Medical record number"
                    }
                ]
            },
            "system": "https://healthid.ndhm.gov.in",
            "value": patient_model.abha_number
        })
        
    # ABHA Address (PHR Address)
    if getattr(patient_model, "abha_address", None):
        fhir_patient["identifier"].append({
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "PUAN",
                        "display": "Public User Account Number"
                    }
                ]
            },
            "system": "https://healthid.ndhm.gov.in",
            "value": patient_model.abha_address
        })

    # 3. Name Elements
    if patient_model.name:
        parts = patient_model.name.strip().split(" ")
        family = parts[-1] if len(parts) > 1 else ""
        given = parts[:-1] if len(parts) > 1 else parts
        
        name_obj = {
            "use": "official",
            "text": patient_model.name
        }
        if family:
            name_obj["family"] = family
        if given:
            name_obj["given"] = given
            
        fhir_patient["name"].append(name_obj)
        
    # Father Name Tracking (Extension or direct map to contacts based on exact ABDM IG)
    if getattr(patient_model, "father_name", None):
        if "contact" not in fhir_patient:
            fhir_patient["contact"] = []
        fhir_patient["contact"].append({
            "relationship": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0131",
                            "code": "FTH"
                        }
                    ]
                }
            ],
            "name": {
                "text": patient_model.father_name
            }
        })
        
    # Emergency Contact
    if patient_model.emergency_contact_name:
        if "contact" not in fhir_patient:
            fhir_patient["contact"] = []
        fhir_patient["contact"].append({
            "relationship": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0131",
                            "code": "C"  # Emergency Contact
                        }
                    ]
                }
            ],
            "name": {
                "text": patient_model.emergency_contact_name
            },
            "telecom": [
                {
                    "system": "phone",
                    "value": patient_model.emergency_contact_phone,
                    "use": "mobile"
                }
            ] if patient_model.emergency_contact_phone else []
        })

    # 4. Telecom (Phone / Email)
    if patient_model.phone:
        fhir_patient["telecom"].append({
            "system": "phone",
            "value": patient_model.phone,
            "use": "mobile"
        })
        
    if getattr(patient_model, "email", None):
        fhir_patient["telecom"].append({
            "system": "email",
            "value": patient_model.email,
            "use": "home"
        })

    # 5. Demographics
    if patient_model.gender:
        # Map M/F/O/U to FHIR administrative genders
        g_map = {"M": "male", "F": "female", "O": "other", "U": "unknown"}
        fhir_patient["gender"] = g_map.get(patient_model.gender.upper(), "unknown")
        
    if getattr(patient_model, "dob", None):
        fhir_patient["birthDate"] = format_fhir_date(patient_model.dob)

    # 6. Address Mapping
    if patient_model.address or getattr(patient_model, "district", None) or getattr(patient_model, "state", None) or getattr(patient_model, "pincode", None):
        fhir_address = {
            "use": "home",
            "type": "physical",
        }
        
        if patient_model.address:
            fhir_address["text"] = patient_model.address
            fhir_address["line"] = [patient_model.address]
            
        if getattr(patient_model, "district", None):
            fhir_address["district"] = patient_model.district
            
        if getattr(patient_model, "state", None):
            fhir_address["state"] = patient_model.state
            
        if getattr(patient_model, "pincode", None):
            fhir_address["postalCode"] = patient_model.pincode
            
        # Hardcoding country as IN (India) for ABDM context
        fhir_address["country"] = "IN"
            
        fhir_patient["address"] = [fhir_address]

    # Clean empty lists
    if not fhir_patient["telecom"]: del fhir_patient["telecom"]
    if not fhir_patient["identifier"]: del fhir_patient["identifier"]

    return fhir_patient

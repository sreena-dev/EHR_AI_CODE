
try:
    print("Attempting to import PaddleOCR...")
    from paddleocr import PaddleOCR
    print("SUCCESS: Imported PaddleOCR")
except Exception as e:
    print(f"FAILURE: Importing PaddleOCR failed: {e}")

try:
    print("Attempting to import PPStructureV3 from package...")
    from paddleocr import PPStructureV3
    print("SUCCESS: Imported PPStructureV3 from package")
except Exception as e:
    print(f"FAILURE: Importing PPStructureV3 from package failed: {e}")

try:
    print("Attempting to import PPStructureV3 from internal module...")
    from paddleocr._pipelines.pp_structurev3 import PPStructureV3
    print("SUCCESS: Imported PPStructureV3 from internal module")
except Exception as e:
    print(f"FAILURE: Importing PPStructureV3 from internal module failed: {e}")

try:
    print("Attempting to import PPStructure (v2 fallback)...")
    from paddleocr import PPStructure
    print("SUCCESS: Imported PPStructure (v2)")
except Exception as e:
    print(f"FAILURE: Importing PPStructure (v2) failed: {e}")

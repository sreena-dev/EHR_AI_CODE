"""Test PaddleOCR 3.x predict() result structure and text extraction"""
import os, sys
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from paddleocr import PaddleOCR

abs_path = os.path.abspath('tests/data/english_rx.jpg')
print(f'Test image: {abs_path} ({os.path.getsize(abs_path)} bytes)')

# Test with default det params (no custom thresholds)
p = PaddleOCR(lang='en', device='cpu', use_textline_orientation=True, enable_mkldnn=False)
print('Engine created (default det params)')
sys.stdout.flush()

for res in p.predict(abs_path):
    r = res.json['res']
    det_params = r.get('text_det_params', {})
    texts = r.get('rec_texts', [])
    scores = r.get('rec_scores', [])
    
    print(f'\ntext_det_params: {det_params}')
    print(f'text_type: {r.get("text_type")}')
    print(f'doc_preprocessor_res: {r.get("doc_preprocessor_res")}')
    print(f'\nrec_texts count: {len(texts)}')
    print(f'rec_scores count: {len(scores)}')
    print(f'dt_polys count: {len(r.get("dt_polys", []))}')
    
    if texts:
        print('\n--- Extracted Texts ---')
        for i in range(min(10, len(texts))):
            t = texts[i]
            s = scores[i]
            print(f'  [{i}] score={s:.3f}: {t}')
    else:
        print('\nNO TEXT DETECTED!')
        print('This means the detection model found no text regions.')
        print('Checking all result keys...')
        for k, v in r.items():
            if isinstance(v, list):
                print(f'  {k}: list len={len(v)}')
            elif isinstance(v, dict):
                print(f'  {k}: dict keys={list(v.keys())[:10]}')
            else:
                print(f'  {k}: {type(v).__name__} = {str(v)[:100]}')
    break

print('\n=== Done ===')

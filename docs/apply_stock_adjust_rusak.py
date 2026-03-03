#!/usr/bin/env python3
import json, sys, urllib.request, urllib.error
from pathlib import Path

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'
PAYLOAD_FILE = Path(__file__).with_name('waserda_stock_adjust_rusak_by_name.json')


def norm(s: str) -> str:
    return ' '.join((s or '').strip().lower().split())

with PAYLOAD_FILE.open('r', encoding='utf-8') as f:
    payload = json.load(f).get('requests', [])

# load products
with urllib.request.urlopen(f'{BASE_URL}/stock/products?all=true', timeout=15) as r:
    products = json.loads(r.read().decode('utf-8'))

name_map = {norm(p.get('name', '')): p for p in products}

ok = 0
failed = 0
for item in payload:
    pname = item.get('productName', '')
    p = name_map.get(norm(pname))
    if not p:
      print(f'[MISS] Product not found by name: {pname}')
      failed += 1
      continue

    body = json.dumps({
      'productId': p['id'],
      'qty': int(item.get('qty', 0)),
      'note': item.get('note', 'STOCK_ADJUST')
    }).encode('utf-8')

    req = urllib.request.Request(
      f'{BASE_URL}/stock/adjust',
      data=body,
      method='POST',
      headers={'Content-Type': 'application/json'},
    )
    try:
      with urllib.request.urlopen(req, timeout=15) as r:
        _ = r.read()
      print(f"[OK] {pname} -> qty {item.get('qty')} (id={p['id']})")
      ok += 1
    except urllib.error.HTTPError as e:
      msg = e.read().decode('utf-8', errors='ignore')
      print(f'[FAIL] {pname}: HTTP {e.code} {msg}')
      failed += 1
    except Exception as e:
      print(f'[FAIL] {pname}: {e}')
      failed += 1

print(f'\nDone. success={ok} failed={failed}')

"""Decode the public synthetic front/back/repeat for a browser acceptance run.
Usage: python3 scripts/make-photo-fixtures.py /absolute/local/output-directory
No real cards, network calls, Google writes or third-party dependencies.
"""
import base64
import hashlib
import json
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit(__doc__)
output = Path(sys.argv[1]).expanduser().resolve()
output.mkdir(parents=True, exist_ok=True)
fixtures = json.loads((Path(__file__).resolve().parents[1] / 'tests/fixtures/photo-cards.json').read_text())
for item in fixtures['files']:
    data = base64.b64decode(item['base64'], validate=True)
    if hashlib.sha256(data).hexdigest() != item['sha256']:
        raise SystemExit('Fixture hash mismatch; no upload permitted.')
    (output / item['name']).write_bytes(data)
    print(item['name'], item['sha256'])
(output / 'fictional-front-repeat.png').write_bytes((output / 'fictional-front.png').read_bytes())

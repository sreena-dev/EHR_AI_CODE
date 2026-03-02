import sqlite3

conn = sqlite3.connect("data/ehr.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("ENCOUNTERS ({} total):".format(c.execute("SELECT COUNT(*) FROM encounter").fetchone()[0]))
for r in c.execute("SELECT id, patient_id, status, type, doctor_id, created_at FROM encounter ORDER BY created_at DESC"):
    print(f"  {r['id']} | pid={r['patient_id']} | status={r['status']} | type={r['type']} | doc={r['doctor_id']} | {r['created_at']}")

print("\nPATIENTS ({} total):".format(c.execute("SELECT COUNT(*) FROM patient").fetchone()[0]))
for r in c.execute("SELECT id, name, age, gender FROM patient"):
    print(f"  {r['id']} | {r['name']} | {r['age']} | {r['gender']}")

print("\nOCR ({} total):".format(c.execute("SELECT COUNT(*) FROM ocr_result").fetchone()[0]))
conn.close()

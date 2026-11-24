import json
import sys
from datetime import date

# يضمن ظهور العربية في الترمنال على ويندوز
try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

# قراءة الملف اللي نزّله الموقع (لازم يكون في نفس الفولدر)
try:
    with open("tasks.json", encoding="utf-8") as f:
        tasks = json.load(f)
except FileNotFoundError:
    print("لم يتم العثور على ملف tasks.json")
    print("اضغط زر التصدير في الموقع وضع الملف بجانب report.py")
    sys.exit(1)

today = date.today().isoformat()
stats = {}

for t in tasks:
    subject = t.get("subject", "بدون مادة")
    s = stats.setdefault(subject, {"total": 0, "done": 0, "late": 0})
    s["total"] += 1
    if t.get("done"):
        s["done"] += 1
    elif t.get("date", "9999-99-99") < today:
        s["late"] += 1

lines = [f"تقرير مُنظِّم الدراسة الذكي - {today}", "=" * 40]

for subject, s in stats.items():
    percent = round(s["done"] / s["total"] * 100) if s["total"] else 0
    lines.append(
        f"{subject}: {s['done']}/{s['total']} منجز ({percent}%) | متأخر: {s['late']}"
    )

total = sum(s["total"] for s in stats.values())
done = sum(s["done"] for s in stats.values())
lines.append("=" * 40)
lines.append(f"الإجمالي: {done} من {total} مهمة منجزة")

report = "\n".join(lines)
print(report)

with open("report.txt", "w", encoding="utf-8") as f:
    f.write(report)

print("\nتم حفظ التقرير في report.txt")

# diagnostic.py — run this from your backend folder:
#   python diagnostic.py

import sys, os

print("=" * 60)
print("ThermoPlot Export Router Diagnostic")
print("=" * 60)

# 1. Clear pycache
import shutil
cache_path = os.path.join("dashboard", "__pycache__")
if os.path.exists(cache_path):
    shutil.rmtree(cache_path)
    print(f"✅ Cleared {cache_path}")
else:
    print(f"ℹ️  No __pycache__ found at {cache_path}")

# 2. Check file exists
export_path = os.path.join("dashboard", "export.py")
if not os.path.exists(export_path):
    print(f"❌ MISSING: {export_path} does not exist!")
    sys.exit(1)

size = os.path.getsize(export_path)
print(f"✅ File exists: {export_path} ({size:,} bytes)")

if size < 5000:
    print("⚠️  WARNING: File is very small — may be the OLD version (should be ~40KB)")

# 3. Check for lazy import pattern (new version)
with open(export_path, encoding="utf-8", errors="replace") as f:
    content = f.read()

if "def _import_numpy" in content or "def _np():" in content:
    print("✅ New lazy-import version detected")
elif "import numpy as np" in content[:500]:
    print("❌ OLD version detected — top-level numpy import still present")
    print("   You need to replace dashboard/export.py with the new file")
    sys.exit(1)

# 4. Check for module-level reportlab imports (old version marker)
first_200_lines = "\n".join(content.split("\n")[:200])
if "from reportlab" in first_200_lines and "def " not in first_200_lines.split("from reportlab")[0].split("\n")[-1]:
    print("❌ OLD version — reportlab imported at module level (will crash on import)")
else:
    print("✅ No dangerous top-level reportlab imports")

# 5. Try the actual import
print("\nAttempting import of dashboard.export ...")
sys.path.insert(0, os.getcwd())

try:
    # Force reload in case Python cached the broken version
    if "dashboard.export" in sys.modules:
        del sys.modules["dashboard.export"]
    if "dashboard" in sys.modules:
        del sys.modules["dashboard"]

    from dashboard.export import router as export_router
    routes = [r.path for r in export_router.routes]
    print(f"✅ Import SUCCESS")
    print(f"   Routes registered: {routes}")
    if routes:
        print("\n🎉 Export router is working correctly!")
        print("   Restart your server and it should work.")
    else:
        print("⚠️  Router imported but NO routes found — check router definition")

except ImportError as e:
    print(f"❌ ImportError: {e}")
    print("\nMissing package. Install it:")
    pkg = str(e).split("'")[1] if "'" in str(e) else str(e)
    pip_name = {
        "reportlab": "reportlab",
        "openpyxl": "openpyxl",
        "docx": "python-docx",
        "numpy": "numpy",
        "matplotlib": "matplotlib",
        "sqlalchemy": "sqlalchemy",
        "fastapi": "fastapi",
    }.get(pkg.split(".")[0], pkg)
    print(f"   pip install {pip_name}")

except Exception as e:
    import traceback
    print(f"❌ Error during import:")
    traceback.print_exc()

print("=" * 60)
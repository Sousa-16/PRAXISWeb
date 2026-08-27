import ast
from pathlib import Path

PKG = Path(__file__).resolve().parents[1] / "app"


def _imports(name: str) -> set[str]:
    src = ast.parse((PKG / name).read_text())
    found = set()
    for node in ast.walk(src):
        if isinstance(node, ast.Import):
            found.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module.split(".")[0])
    return found


def test_serve_modules_do_not_import_praxis():
    for mod in ("policy.py", "encode.py", "constraints.py", "owners.py", "search.py", "models.py"):
        assert "praxis" not in _imports(mod), mod


def test_tables_and_main_do_not_import_praxis():
    for mod in ("tables.py", "main.py", "auth.py", "db.py", "fit_cache.py"):
        assert "praxis" not in _imports(mod), mod


def test_routers_do_not_import_praxis():
    routers = Path(__file__).resolve().parents[1] / "app" / "routers"
    for path in routers.glob("*.py"):
        if path.name == "__init__.py":
            continue
        src = ast.parse(path.read_text())
        found = set()
        for node in ast.walk(src):
            if isinstance(node, ast.Import):
                found.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                found.add(node.module.split(".")[0])
        assert "praxis" not in found, path.name

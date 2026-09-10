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
    for mod in ("policy.py", "encode.py", "constraints.py", "owners.py", "models.py", "rate_limit.py"):
        assert "praxis" not in _imports(mod), mod


def test_tables_and_main_do_not_import_praxis():
    for mod in ("tables.py", "main.py", "auth.py", "db.py", "fit_cache.py"):
        assert "praxis" not in _imports(mod), mod


def test_search_module_removed():
    assert not (PKG / "search.py").exists(), "Unused search.py should stay deleted"


def test_routers_directory_removed():
    """Dead parallel routers were deleted; live routes live in main.py only."""
    routers = Path(__file__).resolve().parents[1] / "app" / "routers"
    assert not routers.exists(), "Unused app/routers/ should stay deleted"

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.constraints import remaining_trees
from app.db import engine
from app.main import app
from app.models import Job
from app.owners import abandon_orphaned_jobs
from app.policy import freeze_policy, score_policy


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_sample_dataset_and_isolation(client):
    created = client.post("/v1/datasets/sample")
    assert created.status_code == 201
    did = created.json()["id"]
    assert created.json()["guessed_label"] == "class"
    with TestClient(app) as other:
        hidden = other.get(f"/v1/jobs/{did}")
        assert hidden.status_code == 404
    mine = client.get("/v1/me")
    assert mine.status_code == 200
    assert "Other visitors" in mine.json()["notice"]


def test_unknown_job_is_404(client):
    client.get("/v1/me")
    res = client.get("/v1/jobs/nope")
    assert res.status_code == 404
    assert "error" in res.json()


def test_delete_now(client):
    created = client.post("/v1/datasets/sample")
    did = created.json()["id"]
    client.delete("/v1/me/data")
    res = client.get(f"/v1/jobs/{did}")
    assert res.status_code == 404


STUMP = {
    "id": 0,
    "bases": ["income"],
    "paths": [
        [{"name": "income <= 50000.0", "true": True}],
        [{"name": "income <= 50000.0", "true": False}],
    ],
    "leaf_labels": ["no", "yes"],
    "rules": ["IF income <= 50000.0 THEN no"],
}
OTHER = {
    "id": 1,
    "bases": ["income", "region"],
    "paths": [
        [{"name": "income <= 50000.0", "true": True}],
        [{"name": "income <= 50000.0", "true": False}],
    ],
    "leaf_labels": ["yes", "no"],
    "rules": [],
}
JOB = {
    "label": "approved",
    "class_names": ["no", "yes"],
    "original_columns": ["income", "region"],
    "column_kinds": {"income": "numeric", "region": "categorical"},
    "column_codes": {"region": {"south": 0, "west": 1}},
    "binarizer": {
        "type": "thresholds",
        "thresholds": [{"column": "income", "threshold": 50000.0, "name": "income <= 50000.0"}],
    },
    "trees": [STUMP, OTHER],
}


def test_remaining_and_score():
    assert remaining_trees(JOB["trees"], banned=["income"]) == []
    policy = freeze_policy(JOB, 0, banned=["region"])
    out = score_policy(policy, {"income": "42000", "region": "south"})
    assert out["prediction"] == "no"


def test_remaining_keep():
    assert [t["id"] for t in remaining_trees(JOB["trees"], keep=["region"])] == [1]


def test_me_notice_no_signin(client):
    res = client.get("/v1/me")
    assert res.status_code == 200
    notice = res.json()["notice"]
    assert "sign in" not in notice.lower()
    assert "this browser" in notice.lower()


def test_fit_params_defaults_and_clamp():
    from app.fit_params import FitParams, normalize_fit_params

    d = FitParams()
    assert d.lambda_reg == 0.01
    assert d.depth_budget == 5
    assert d.lookahead_k == 1
    tight = normalize_fit_params({"lookahead_k": 9, "depth_budget": 3})
    assert tight.depth_budget == 3
    assert tight.lookahead_k == 2
    wide = normalize_fit_params({"rashomon_mult": 0.5, "fit_rows": 10})
    assert wide.rashomon_mult == 0.2
    assert wide.fit_rows == 100


def test_create_job_accepts_params(client):
    created = client.post("/v1/datasets/sample")
    did = created.json()["id"]
    job = client.post(
        "/v1/jobs",
        json={
            "dataset_id": did,
            "label": "class",
            "params": {"depth_budget": 3, "rashomon_mult": 0.01, "lookahead_k": 1},
        },
    )
    assert job.status_code == 202
    body = job.json()
    assert body["params"]["depth_budget"] == 3
    assert body["params"]["rashomon_mult"] == 0.01
    assert body["params"]["lookahead_k"] == 1
    assert body["params"]["lambda_reg"] == 0.01


def test_me_exposes_fit_params(client):
    mine = client.get("/v1/me")
    assert mine.status_code == 200
    body = mine.json()
    assert isinstance(body["max_rows"], int) and body["max_rows"] > 0
    assert isinstance(body["max_upload_bytes"], int) and body["max_upload_bytes"] > 0
    fp = body["fit_params"]
    assert fp["defaults"]["fit_rows"] == 2000
    assert fp["bounds"]["depth_budget"]["max"] == 8


def test_score_policy_unit_only():
    policy = freeze_policy(JOB, 0, banned=["region"])
    out = score_policy(policy, {"income": "42000"})
    assert out["prediction"] == "no"
    assert out["n"] == 1


def test_timbertrek_export_shape():
    from app.timbertrek_export import build_timbertrek_doc

    result = {
        **JOB,
        "n_trees": 12345,
        "n_profiled": 2,
        "trees": [STUMP, OTHER],
    }
    doc = build_timbertrek_doc(result, banned=["region"], keep=[])
    assert set(doc.keys()) == {"trie", "featureMap", "treeMap"}
    assert doc["trie"]["f"] == "root"
    assert list(doc["treeMap"]) == ["1", "2"]
    first = doc["treeMap"]["1"]
    assert len(first) == 3
    assert first[0]["f"][0] not in (None,)
    assert len(first[0].get("c") or []) == 2
    for v in doc["featureMap"].values():
        assert len(v) == 3
    # One sunburst leaf per tree per unique feature-prefix (no duplicate t at same node).
    leaves = []

    def walk(n, path):
        if n.get("f") == "_":
            leaves.append((path, n.get("t")))
            return
        for c in n.get("c") or []:
            walk(c, path + (n.get("f"),))

    walk(doc["trie"], ())
    assert len(leaves) == len(set(leaves))
    assert {t for _, t in leaves} == {1, 2}
    mins = []

    def leafn(n):
        f = n.get("f")
        if isinstance(f, list) and f and f[0] in "+-":
            mins.append(f[1])
            return
        for c in n.get("c") or []:
            leafn(c)

    for entry in doc["treeMap"].values():
        leafn(entry[0])
    assert mins and min(mins) >= 2
    assert len(set(mins)) >= 2


def test_count_matching_uses_bases_index():
    from app.fit import FittedBundle, count_matching
    import numpy as np

    class FakeModel:
        def get_tree_paths(self, i):
            paths = {
                0: [[1], [ -1]],
                1: [[1, 2]],
                2: [[2]],
            }[i]
            preds = [0] * len(paths)
            return paths, preds

    bundle = FittedBundle(
        model=FakeModel(),
        bin_names=["income <= 1", "region <= 0"],
        class_names=["no", "yes"],
        Xb_te=np.zeros((1, 2), dtype=np.uint8),
        y_te=np.zeros(1, dtype=int),
        n_trees=3,
        min_objective=1,
        shell={},
        original_columns=["income", "region"],
    )
    all_ok = count_matching(bundle, [], [])
    assert all_ok["n_matching"] == 3
    no_income = count_matching(bundle, ["income"], [])
    assert no_income["n_matching"] == 1
    must_region = count_matching(bundle, [], ["region"])
    assert must_region["n_matching"] == 2


def test_base_name_prebinarized_headers():
    from app.trees import base_name

    droid = ["android.permission.INTERNET <= 0.5", "android.permission.CAMERA <= 0.5"]
    assert base_name("android.permission.INTERNET <= 0.5", droid) == "android.permission.INTERNET <= 0.5"
    assert base_name("income <= 30", ["income", "region"]) == "income"
    assert base_name("income <= 30") == "income"


def test_count_matching_prebinarized_column_names():
    from app.fit import FittedBundle, count_matching
    import numpy as np

    class FakeModel:
        def get_tree_paths(self, i):
            paths = {0: [[1], [-1]], 1: [[2]]}[i]
            return paths, [0] * len(paths)

    cols = ["age <= 0.5", "hours <= 0.5"]
    bundle = FittedBundle(
        model=FakeModel(),
        bin_names=cols,
        class_names=["no", "yes"],
        Xb_te=np.zeros((1, 2), dtype=np.uint8),
        y_te=np.zeros(1, dtype=int),
        n_trees=2,
        min_objective=1,
        shell={},
        original_columns=cols,
    )
    banned = count_matching(bundle, ["age <= 0.5"], [])
    assert banned["n_matching"] == 1
    stripped_miss = count_matching(bundle, ["age"], [])
    assert stripped_miss["n_matching"] == 2


def test_abandon_orphaned_jobs_from_prior_process():
    with Session(engine) as session:
        session.add(
            Job(
                id="stuck01",
                dataset_id="gone",
                label="approved",
                status="running",
                created_at=datetime.now(timezone.utc) - timedelta(hours=1),
            )
        )
        session.commit()
        n = abandon_orphaned_jobs(session)
        assert n >= 1
        stuck = session.get(Job, "stuck01")
        assert stuck is not None
        assert stuck.status == "failed"
        session.delete(stuck)
        session.commit()

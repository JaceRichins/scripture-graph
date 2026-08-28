"""JSON-schema validation of agent outputs + robust JSON extraction.

AI output is DATA, not trusted structure: everything is schema-validated
before use, malformed output triggers one repair retry, and a second failure
quarantines the artifact.
"""
from __future__ import annotations

import importlib.resources as res
import json
from functools import lru_cache

import jsonschema


class SchemaError(Exception):
    pass


@lru_cache(maxsize=None)
def load_schema(name: str) -> dict:
    text = res.files("scripturegraph").joinpath(f"assets/schemas/{name}.schema.json") \
        .read_text(encoding="utf-8")
    return json.loads(text)


def validate(obj, schema_name: str) -> None:
    schema = load_schema(schema_name)
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(obj), key=lambda e: e.json_path)
    if errors:
        msgs = "; ".join(f"{e.json_path}: {e.message}" for e in errors[:6])
        raise SchemaError(f"{schema_name} schema violation(s): {msgs}")


def extract_json(text: str):
    """Pull the first complete JSON object out of arbitrary model output.

    Handles markdown fences, leading prose, and trailing commentary. Raises
    SchemaError when no parseable object exists.
    """
    if not text:
        raise SchemaError("empty model output")
    # fast path: fenced block
    for fence in ("```json", "```"):
        if fence in text:
            start = text.find(fence) + len(fence)
            end = text.find("```", start)
            if end != -1:
                candidate = text[start:end].strip()
                if candidate.startswith("{"):
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break
    # brace scanner respecting strings/escapes
    i = text.find("{")
    while i != -1:
        depth = 0
        in_str = False
        esc = False
        for j in range(i, len(text)):
            c = text[j]
            if esc:
                esc = False
                continue
            if c == "\\":
                esc = in_str
                continue
            if c == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[i:j + 1])
                    except json.JSONDecodeError:
                        break
        i = text.find("{", i + 1)
    raise SchemaError("no valid JSON object found in model output")


def parse_and_validate(text: str, schema_name: str):
    obj = extract_json(text)
    validate(obj, schema_name)
    return obj

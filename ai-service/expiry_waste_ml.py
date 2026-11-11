"""Shim : run_expiry_waste délègue au package expiry."""
from __future__ import annotations


def run_expiry_waste(payload):
    from expiry.serve import run
    return run(payload)

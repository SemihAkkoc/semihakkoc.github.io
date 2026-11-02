#!/usr/bin/env python3
"""Storage server for the study log page (_pages/study.html).

Holds every day in one JSON file and merges changes from each device per day,
newest edit wins. It only listens on localhost; `tailscale serve` is what makes
it reachable, from inside the tailnet only, and tells it who is asking. Only the
accounts in --allow-user can read or write. Standard library only.
"""
import argparse
import datetime
import json
import os
import re
import shutil
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_ORIGINS = ["https://semihakkoc.github.io"]
COLORS = {"green", "yellow", "red"}
MAX_MINUTES = 24 * 60
MAX_BODY_BYTES = 2 * 1024 * 1024
KEEP_SNAPSHOTS = 30
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def clean_day(key, day, now_ms):
    """Returns a valid day, or None if the record is malformed."""
    if not isinstance(key, str) or not DATE_PATTERN.match(key) or not isinstance(day, dict):
        return None
    try:
        datetime.date.fromisoformat(key)
    except ValueError:
        return None

    minutes, color, updated = day.get("minutes"), day.get("color"), day.get("updated", 0)
    if type(minutes) is not int or not 0 <= minutes <= MAX_MINUTES:
        return None
    if color is not None and (not isinstance(color, str) or color not in COLORS):
        return None
    if type(updated) is not int or updated < 0:
        return None
    # A device with a fast clock must not be able to win every future edit
    return {"minutes": minutes, "color": color, "updated": min(updated, now_ms)}


class Store:
    """The data file. Deleted days stay as empty records so they cannot come back."""

    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.path = os.path.join(data_dir, "entries.json")
        self.snapshots = os.path.join(data_dir, "snapshots")
        self.lock = threading.Lock()
        os.makedirs(self.snapshots, mode=0o700, exist_ok=True)
        # An unreadable file raises here: better to stop than to overwrite it
        self.entries = self._read()

    def _read(self):
        if not os.path.exists(self.path):
            return {}
        with open(self.path, encoding="utf-8") as handle:
            return json.load(handle)["entries"]

    def _snapshot(self):
        """Keeps the first version of each day, for the last KEEP_SNAPSHOTS days."""
        if not os.path.exists(self.path):
            return
        name = "entries-" + datetime.date.today().isoformat() + ".json"
        target = os.path.join(self.snapshots, name)
        if not os.path.exists(target):
            shutil.copy2(self.path, target)
        for old in sorted(os.listdir(self.snapshots))[:-KEEP_SNAPSHOTS]:
            os.remove(os.path.join(self.snapshots, old))

    def _write(self):
        self._snapshot()
        temporary = self.path + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump({"version": 1, "entries": self.entries}, handle, indent=1, sort_keys=True)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self.path)
        directory = os.open(self.data_dir, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)

    def merge(self, changes):
        """Applies each change that is newer than what is stored; returns all days."""
        now_ms = int(time.time() * 1000)
        with self.lock:
            changed = False
            for key, day in changes.items():
                clean = clean_day(key, day, now_ms)
                if clean is None:
                    continue
                current = self.entries.get(key)
                if current is None or clean["updated"] > current.get("updated", 0):
                    self.entries[key] = clean
                    changed = True
            if changed:
                self._write()
            return dict(self.entries)


def make_handler(store, origins, users):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        timeout = 15

        def origin_allowed(self):
            # Browsers always send Origin on these requests; curl on the tailnet does not
            origin = self.headers.get("Origin")
            return origin is None or origin in origins

        def send_cors(self):
            origin = self.headers.get("Origin")
            if origin in origins:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

        def reply(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def refuse(self, status, message):
            # The request body was not read, so this connection cannot be reused
            self.close_connection = True
            self.reply(status, {"error": message})

        def do_OPTIONS(self):
            if not self.origin_allowed():
                self.refuse(403, "origin not allowed")
                return
            self.send_response(204)
            self.send_cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            # Chromium asks before a public page may call a private address
            if self.headers.get("Access-Control-Request-Private-Network"):
                self.send_header("Access-Control-Allow-Private-Network", "true")
            if self.headers.get("Access-Control-Request-Local-Network"):
                self.send_header("Access-Control-Allow-Local-Network", "true")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if not self.origin_allowed():
                self.refuse(403, "origin not allowed")
            elif self.path == "/api/health":
                self.reply(200, {"ok": True})
            else:
                self.refuse(404, "not found")

        def do_POST(self):
            if not self.origin_allowed():
                self.refuse(403, "origin not allowed")
                return
            if self.path != "/api/sync":
                self.refuse(404, "not found")
                return
            # Set by `tailscale serve` from the caller's tailnet identity. Only local
            # processes can reach this port directly, so it cannot be forged remotely.
            if self.headers.get("Tailscale-User-Login") not in users:
                self.refuse(403, "account not allowed")
                return
            # JSON forces a CORS preflight, which a form on another site cannot pass
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                self.refuse(415, "expected application/json")
                return
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                self.refuse(411, "missing length")
                return
            if not 0 <= length <= MAX_BODY_BYTES:
                self.refuse(413, "too large")
                return
            try:
                changes = json.loads(self.rfile.read(length).decode("utf-8"))["changes"]
                if not isinstance(changes, dict):
                    raise ValueError
            except (ValueError, KeyError, TypeError):
                self.reply(400, {"error": "expected {changes: {...}}"})
                return
            self.reply(200, {"entries": store.merge(changes)})

        def log_message(self, message, *args):
            sys.stderr.write("%s\n" % (message % args))

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--data", default=os.path.expanduser("~/.local/share/study-log"))
    parser.add_argument("--allow-origin", action="append", help="site allowed to use this server (repeatable)")
    parser.add_argument("--allow-user", action="append", required=True, help="Tailscale login allowed to use this server (repeatable)")
    args = parser.parse_args()

    store = Store(args.data)
    handler = make_handler(store, set(args.allow_origin or DEFAULT_ORIGINS), set(args.allow_user))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print("study log: serving %s on 127.0.0.1:%d" % (store.path, args.port), file=sys.stderr, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

"""SplitEase receipt endpoint — Vercel Python serverless function.

POST /api/receipt with JSON {"text": "..."} (pasted receipt text) and/or
{"imageBase64": "..."} (a receipt photo, raw base64 JPEG) and get back
{"merchant": str|null, "date": "YYYY-MM-DD"|null,
 "items": [{"name": str, "cents": int}], "totalCents": int} from Gemini
(gemini-3.5-flash-lite via the OpenAI-compatible endpoint).

The Gemini API key lives server-side only, in the GEMINI_API_KEY
environment variable. When no key is configured the function answers 501
and the app falls back to its on-device receipt parser for pasted text.
"""

import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
MODEL = "gemini-3.5-flash-lite"
MAX_ITEMS = 30

SYSTEM_PROMPT = (
    "You are SplitEase, a receipt reader for a shared-expense splitter. "
    "Read the receipt (text and/or photo) and reply with JSON ONLY — no "
    "markdown fences, no commentary. The JSON object must have: "
    "\"merchant\": the shop or restaurant name as printed, or null; "
    "\"date\": the receipt date as YYYY-MM-DD, or null; "
    "\"items\": an array of purchased items, each {\"name\": string, "
    "\"price\": number in the receipt currency (dollars and cents, e.g. "
    "12.50)} — leave out tax, tip, subtotal and total lines; "
    "\"total\": the grand total as a number, or null. "
    "Do not guess items that are not printed. If nothing readable is "
    "there, reply with empty items and a null total."
)


def _read_json(handler):
    try:
        length = int(handler.headers.get("Content-Length") or 0)
    except ValueError:
        length = 0
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        return None


def _send(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _extract_json(text):
    """Pull the first JSON object out of model output, tolerating fences."""
    try:
        return json.loads(text)
    except ValueError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except ValueError:
            return None
    return None


def _to_cents(value):
    """Dollars (float/str) -> integer cents, or None when not a number."""
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount < 0 or amount > 100000:
        return None
    return int(round(amount * 100))


def _validate_receipt(data):
    if not isinstance(data, dict):
        return None
    items = []
    for item in data.get("items") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        cents = _to_cents(item.get("price"))
        if not name or cents is None or cents <= 0:
            continue
        items.append({"name": name[:80], "cents": cents})
    items = items[:MAX_ITEMS]
    total = _to_cents(data.get("total"))
    if total is None:
        total = sum(i["cents"] for i in items)
    if not items and total <= 0:
        return None
    merchant = data.get("merchant")
    merchant = str(merchant).strip()[:80] if merchant else None
    date = data.get("date")
    date = str(date).strip()[:10] if date else None
    if date and not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        date = None
    return {"merchant": merchant, "date": date, "items": items, "totalCents": total}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = _read_json(self)
        if body is None:
            _send(self, 400, {"error": {"message": "Invalid JSON body"}})
            return

        text = str(body.get("text") or "").strip()[:4000]
        image_b64 = str(body.get("imageBase64") or "").strip()
        if not text and not image_b64:
            _send(self, 400, {"error": {"message": "Provide receipt text or a receipt photo"}})
            return

        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            _send(self, 501, {"error": {"message": "Hosted AI is not configured"}})
            return

        user_content = []
        if text:
            user_content.append(
                {"type": "text", "text": f"Receipt text:\n{text}"}
            )
        if image_b64:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                }
            )
            user_content.append(
                {"type": "text", "text": "Read the receipt in this photo."}
            )
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
        }
        request = urllib.request.Request(
            GEMINI_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                upstream = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode("utf-8"))
                message = detail.get("error", {}).get("message", "")
            except (ValueError, UnicodeDecodeError):
                message = ""
            _send(
                self,
                exc.code if 400 <= exc.code < 600 else 502,
                {"error": {"message": message or "Upstream request failed"}},
            )
            return
        except (urllib.error.URLError, TimeoutError, OSError):
            _send(self, 502, {"error": {"message": "Upstream request failed"}})
            return

        try:
            content = upstream["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            _send(self, 502, {"error": {"message": "Upstream returned an unexpected response"}})
            return

        data = _extract_json(content)
        receipt = _validate_receipt(data) if data is not None else None
        if receipt is None:
            _send(self, 502, {"error": {"message": "Could not read the receipt"}})
            return
        _send(self, 200, receipt)

    def do_GET(self):
        _send(self, 405, {"error": {"message": "Method not allowed"}})

    def log_message(self, *args):  # keep serverless logs clean
        pass

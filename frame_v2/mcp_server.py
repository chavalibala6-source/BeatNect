#!/usr/bin/env python3
"""
BeatNect Codebase MCP Server
Standard Model Context Protocol (MCP) server over Stdio JSON-RPC 2.0.
Exposes targeted tools for querying the database, searching code, inspecting outlines,
and testing track metadata to drastically reduce agent prompt context overhead.
"""

import sys
import os
import json
import re
import glob
import urllib.request
import subprocess
from pathlib import Path

# Add parent directory to path to import helpers from app.py if needed
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

try:
    import psycopg2
except ImportError:
    psycopg2 = None

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "notepad")
DB_USER = os.getenv("DB_USER", "notepad")
DB_PASSWORD = os.getenv("DB_PASSWORD", "notepad")

def get_db_connection():
    if not psycopg2:
        return None
    try:
        return psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=3
        )
    except Exception:
        return None

# Import or define regex fallback metadata extractor
try:
    from app import extract_metadata_from_filename
except Exception:
    FILENAME_TRACK_REGEXES = [
        re.compile(r"^(?:(?:\d{1,3})[.\s_-]+)?(?P<artist>[^-\n\t]+?)\s*[-–—]\s*(?P<title>[^(\[\n\t]+)(?:\s*[({\[](?:feat\.|ft\.|album:)?\s*(?P<extra>[^)\]}]+)[)\]}])?", re.IGNORECASE),
        re.compile(r"^(?P<artist>[^-\n\t]+?)\s*[-–—]\s*(?P<album>[^-\n\t]+?)\s*[-–—]\s*(?:(?:\d{1,3})[.\s_-]+)?(?P<title>[^.\n\t]+)", re.IGNORECASE)
    ]
    def extract_metadata_from_filename(filename):
        if not filename:
            return None, None, None
        clean_name = os.path.splitext(filename)[0].replace('_', ' ').strip()
        clean_name = re.sub(r'(?:[-_\s]*(?:SenSongsMp3|PenduJatt|Naasongs|SongsPK|PagalWorld|Mp3Mad|DJMaza)[\w.]*)+', '', clean_name, flags=re.IGNORECASE).strip()
        clean_name = re.sub(r'^(?:(?:\d{1,3})[.\s_-]+)+', '', clean_name).strip()
        clean_name = re.sub(r'\s*[-–—]\s*$', '', clean_name).strip()
        for pattern in FILENAME_TRACK_REGEXES:
            match = pattern.match(clean_name)
            if match:
                gd = match.groupdict()
                return gd.get('artist', '').strip() or None, gd.get('album', '').strip() or None, gd.get('title', '').strip() or clean_name
        return None, None, clean_name

# Tools implementations
def tool_query_tracks(args):
    query = (args.get("query") or "").strip().lower()
    artist_filter = (args.get("artist") or "").strip().lower()
    album_filter = (args.get("album") or "").strip().lower()
    limit = int(args.get("limit") or 50)

    # 1. Query live application API (zero pip dependencies)
    try:
        req = urllib.request.Request("http://localhost:5001/music_tracks?scope=all", headers={"User-Agent": "MCP"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                raw_data = json.loads(resp.read().decode())
                filtered = []
                for t in raw_data:
                    title = t.get("name") or ""
                    art = t.get("artist") or ""
                    alb = t.get("album") or ""
                    search_str = f"{title} {art} {alb}".lower()
                    if query and query not in search_str:
                        continue
                    if artist_filter and artist_filter not in art.lower():
                        continue
                    if album_filter and album_filter not in alb.lower():
                        continue
                    filtered.append(t)
                    if len(filtered) >= limit:
                        break
                return {"source": "flask_api", "total_found": len(filtered), "tracks": filtered}
    except Exception:
        pass

    conn = get_db_connection()
    if not conn:
        uploads_files_dir = BASE_DIR / "data" / "uploads" / "files"
        if not uploads_files_dir.exists():
            return {"error": "Database unavailable and upload directory not found"}
        files = list(uploads_files_dir.glob("*.*"))
        results = []
        for f in files[:limit]:
            art, alb, tit = extract_metadata_from_filename(f.name)
            results.append({"filename": f.name, "artist": art, "album": alb, "title": tit, "size": f.stat().st_size})
        return {"source": "filesystem_fallback", "count": len(results), "tracks": results}

    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, original_name, storage_name, size, mime, uploaded_at, artwork_url, artist, album, doc_name, created_at
                FROM music_tracks
                ORDER BY COALESCE(created_at, uploaded_at) DESC
            """)
            rows = cur.fetchall()

    filtered = []
    for r in rows:
        track_id, orig_name, storage, size, mime, up_at, art_url, artist, album, doc, cr_at = r
        if not artist or not album:
            fb_art, fb_alb, _ = extract_metadata_from_filename(orig_name or "")
            artist = artist or fb_art or "Unknown Artist"
            album = album or fb_alb or "Single / Unknown Album"

        text_to_search = f"{orig_name} {artist} {album} {doc}".lower()
        if query and query not in text_to_search:
            continue
        if artist_filter and artist_filter not in (artist or "").lower():
            continue
        if album_filter and album_filter not in (album or "").lower():
            continue

        filtered.append({
            "id": track_id,
            "title": orig_name,
            "artist": artist,
            "album": album,
            "size_bytes": size,
            "doc_name": doc,
            "artwork_url": art_url,
            "created_at": (cr_at or up_at).isoformat() if (cr_at or up_at) else None
        })
        if len(filtered) >= limit:
            break

    return {"total_found": len(filtered), "tracks": filtered}

def tool_extract_track_metadata(args):
    filename = args.get("filename")
    if not filename:
        return {"error": "filename parameter required"}
    artist, album, title = extract_metadata_from_filename(filename)
    return {
        "input_filename": filename,
        "extracted_artist": artist,
        "extracted_album": album,
        "extracted_title": title
    }

def tool_get_code_outline(args):
    filepath = args.get("filepath", "app.py")
    target = BASE_DIR / filepath
    if not target.exists():
        target = BASE_DIR / "templates" / filepath
    if not target.exists():
        return {"error": f"File {filepath} not found in {BASE_DIR}"}

    results = []
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    if target.suffix == ".py":
        for i, line in enumerate(lines, 1):
            line_str = line.strip()
            if line_str.startswith("@app.route"):
                route_line = line_str
                fn_line = lines[i].strip() if i < len(lines) else ""
                results.append({"line": i, "type": "route", "signature": f"{route_line} -> {fn_line}"})
            elif line_str.startswith("def ") or line_str.startswith("class "):
                sig = line_str.split(":")[0]
                results.append({"line": i, "type": "def", "signature": sig})
    elif target.suffix == ".html":
        for i, line in enumerate(lines, 1):
            line_str = line.strip()
            if re.match(r"<(div|section|nav|main|aside|header|footer)\s+.*id=[\"'][^\"']+[\"']", line_str):
                results.append({"line": i, "type": "html_section", "signature": line_str[:120]})
            elif line_str.startswith("function ") or line_str.startswith("async function "):
                results.append({"line": i, "type": "js_function", "signature": line_str.split("{")[0].strip()})
    else:
        results.append({"total_lines": len(lines), "size_bytes": target.stat().st_size})

    return {"filepath": str(target.relative_to(BASE_DIR)), "total_elements": len(results), "elements": results[:150]}

def tool_search_code(args):
    pattern = args.get("pattern")
    file_pattern = args.get("file_pattern", "*")
    if not pattern:
        return {"error": "pattern parameter required"}

    regex = re.compile(pattern, re.IGNORECASE)
    matches = []
    search_files = [f for f in BASE_DIR.rglob(file_pattern) if f.is_file() and not any(part.startswith(".") for part in f.parts)]

    for fpath in search_files:
        if fpath.suffix in [".pyc", ".png", ".jpg", ".pem", ".deb", ".tar", ".zip", ".sql"]:
            continue
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                for line_idx, line in enumerate(f, 1):
                    if regex.search(line):
                        matches.append({
                            "file": str(fpath.relative_to(BASE_DIR)),
                            "line": line_idx,
                            "content": line.strip()[:200]
                        })
                        if len(matches) >= 50:
                            break
        except Exception:
            continue
        if len(matches) >= 50:
            break

    return {"pattern": pattern, "total_matches": len(matches), "matches": matches}

def tool_inspect_db_schema(args):
    conn = get_db_connection()
    table_filter = args.get("table_name")

    if not conn:
        try:
            if table_filter:
                cmd = ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "notepad", "-d", "notepad", "-P", "pager=off", "-c", f"\\d {table_filter}"]
                res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True, timeout=3)
                if res.returncode == 0:
                    return {"table": table_filter, "schema_output": res.stdout.strip()}
            else:
                cmd = ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "notepad", "-d", "notepad", "-P", "pager=off", "-t", "-c", "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"]
                res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True, timeout=3)
                if res.returncode == 0:
                    tables = [line.strip() for line in res.stdout.splitlines() if line.strip()]
                    return {"tables": tables}
        except Exception:
            pass
        return {"error": "Database unavailable"}

    with conn:
        with conn.cursor() as cur:
            if table_filter:
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table_filter,))
                cols = cur.fetchall()
                cur.execute("""
                    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = %s
                """, (table_filter,))
                indexes = cur.fetchall()
                return {
                    "table": table_filter,
                    "columns": [{"name": c[0], "type": c[1], "nullable": c[2], "default": c[3]} for c in cols],
                    "indexes": [{"name": idx[0], "def": idx[1]} for idx in indexes]
                }
            else:
                cur.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                tables = [r[0] for r in cur.fetchall()]
                return {"tables": tables}

def tool_get_system_status(args):
    db_ok = False
    db_track_count = 0
    conn = get_db_connection()
    if conn:
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM music_tracks")
                    db_track_count = cur.fetchone()[0]
                    db_ok = True
        except Exception:
            pass
    else:
        try:
            req = urllib.request.Request("http://localhost:5001/music_tracks?scope=all", headers={"User-Agent": "MCP"})
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    db_track_count = len(data)
                    db_ok = True
        except Exception:
            pass

    uploads_dir = BASE_DIR / "data" / "uploads"
    uploads_count = len(list((uploads_dir / "files").glob("*.*"))) if (uploads_dir / "files").exists() else 0
    artwork_count = len(list((uploads_dir / "artwork").glob("*.*"))) if (uploads_dir / "artwork").exists() else 0

    return {
        "database_connected": db_ok,
        "database_track_count": db_track_count,
        "disk_audio_files": uploads_count,
        "disk_artwork_files": artwork_count,
        "server_root": str(BASE_DIR)
    }

TOOLS = [
    {
        "name": "query_tracks",
        "description": "Query music tracks from the BeatNect library with instant filtering (by search term, artist, or album).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query matching title, artist, or album"},
                "artist": {"type": "string", "description": "Filter tracks by artist name"},
                "album": {"type": "string", "description": "Filter tracks by album name"},
                "limit": {"type": "integer", "description": "Maximum tracks to return (default: 50)"}
            }
        }
    },
    {
        "name": "extract_track_metadata",
        "description": "Extract and test smart regex fallback metadata on an audio filename.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Audio filename to test (e.g. '01 - Coldplay - Yellow.mp3')"}
            },
            "required": ["filename"]
        }
    },
    {
        "name": "get_code_outline",
        "description": "Get high-level outline of routes, functions, or DOM sections without loading large files into prompt context.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "filepath": {"type": "string", "description": "Relative file path (e.g. 'app.py' or 'index.html')"}
            }
        }
    },
    {
        "name": "search_code",
        "description": "Fast regex search across BeatNect codebase files.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Regex pattern or keyword to search"},
                "file_pattern": {"type": "string", "description": "Glob filter (e.g. '*.py' or '*.js' or '*.css')"}
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "inspect_db_schema",
        "description": "Inspect PostgreSQL tables, columns, constraints, and indexes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "Table name (e.g. 'music_tracks' or 'documents')"}
            }
        }
    },
    {
        "name": "get_system_status",
        "description": "Check database status, track count, and storage health.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

TOOL_HANDLERS = {
    "query_tracks": tool_query_tracks,
    "extract_track_metadata": tool_extract_track_metadata,
    "get_code_outline": tool_get_code_outline,
    "search_code": tool_search_code,
    "inspect_db_schema": tool_inspect_db_schema,
    "get_system_status": tool_get_system_status
}

def send_response(response_dict):
    body = json.dumps(response_dict)
    sys.stdout.write(body + "\n")
    sys.stdout.flush()

def handle_message(msg):
    msg_id = msg.get("id")
    method = msg.get("method")
    params = msg.get("params", {})

    if method == "initialize":
        send_response({
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "beatnect-codebase-mcp",
                    "version": "1.0.0"
                }
            }
        })
    elif method == "notifications/initialized" or method == "initialized":
        # No reply needed for notifications
        pass
    elif method == "ping":
        send_response({"jsonrpc": "2.0", "id": msg_id, "result": {}})
    elif method == "tools/list":
        send_response({
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": TOOLS
            }
        })
    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            send_response({
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Tool '{tool_name}' not found"
                }
            })
            return

        try:
            res_data = handler(arguments)
            send_response({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(res_data, indent=2)
                        }
                    ]
                }
            })
        except Exception as e:
            send_response({
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps({"error": str(e)}, indent=2)
                        }
                    ],
                    "isError": True
                }
            })
    else:
        if msg_id is not None:
            send_response({
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found"
                }
            })

def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line_str = line.strip()
            if not line_str:
                continue
            msg = json.loads(line_str)
            handle_message(msg)
        except (KeyboardInterrupt, SystemExit):
            break
        except Exception as ex:
            sys.stderr.write(f"Error handling message: {ex}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()

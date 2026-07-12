#!/usr/bin/env python
"""Project management CLI for "Brew & Borrow".

One entry point for running the services, doing scoped git commits per service,
and pulling the live Render PostgreSQL database down to a local dump file.

Zero third-party dependencies — only the Python standard library.

    python cli.py --help

Commands
    frontend            Run the Vite dev server (port 5173)
    backend             Run the Flask dev server (port 5000)
    dev                 Run frontend + backend together (Ctrl+C stops both)
    db upgrade          Apply database migrations (flask db upgrade)
    db pull             Dump the live Render Postgres DB to backend/backups/
    git frontend -m ""  Stage only frontend paths, commit and push
    git backend  -m ""  Stage only backend paths, commit and push
    git database -m ""  Stage only DB/migration paths, commit and push
    git all      -m ""  Stage ALL changes (git add -A), commit and push
"""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
BACKUPS = BACKEND / "backups"

# ANSI colors used across CLI output and the --help text.
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def enable_ansi_colors():
    """On Windows, turn on virtual-terminal processing so ANSI colors render
    in the classic console. No-op elsewhere and harmless if already enabled."""
    if os.name != "nt":
        return
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004, STD_OUTPUT_HANDLE = -11
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

# Path scopes for the per-service git commands. Kept explicit so a commit never
# accidentally grabs another service's changes. The actual *.db files are
# gitignored, so the "database" scope tracks migrations (the DB's schema face).
FRONTEND_PATHS = [
    "src", "public", "index.html", "vite.config.js",
    "package.json", "package-lock.json", "eslint.config.js",
]
BACKEND_PATHS = [
    "backend/app", "backend/wsgi.py", "backend/requirements.txt",
    "backend/tests",
]
DATABASE_PATHS = ["backend/migrations"]

GIT_SCOPES = {
    "frontend": FRONTEND_PATHS,
    "backend": BACKEND_PATHS,
    "database": DATABASE_PATHS,
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def run(cmd, cwd=None, check=True):
    """Print, then run a command. Exit the CLI on failure when check=True."""
    printable = " ".join(str(c) for c in cmd)
    print(f"\033[36m$ {printable}\033[0m  (cwd={cwd or ROOT})")
    result = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and result.returncode != 0:
        die(f"command failed (exit {result.returncode}): {printable}")
    return result.returncode


def die(msg, code=1):
    print(f"\033[31merror:\033[0m {msg}", file=sys.stderr)
    sys.exit(code)


def load_env():
    """Load KEY=VALUE lines from root .env and backend/.flaskenv into os.environ
    without overwriting anything already set. Minimal parser — no dotenv dep."""
    for path in (ROOT / ".env", BACKEND / ".flaskenv"):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def which(name):
    """Locate an executable, tolerating Windows .cmd/.exe wrappers (e.g. npm)."""
    return shutil.which(name)


def venv_bin(name):
    """Resolve a backend-venv executable (flask, pg_dump), preferring the
    project's venv and falling back to whatever is on PATH."""
    scripts = BACKEND / "venv" / ("Scripts" if os.name == "nt" else "bin")
    for candidate in (scripts / f"{name}.exe", scripts / name):
        if candidate.exists():
            return str(candidate)
    found = which(name)
    return found or name


# --------------------------------------------------------------------------- #
# Service run commands
# --------------------------------------------------------------------------- #
def cmd_frontend(_args):
    npm = which("npm") or ("npm.cmd" if os.name == "nt" else "npm")
    run([npm, "run", "dev"], cwd=ROOT)


def _flask_cmd(*extra):
    flask = venv_bin("flask")
    if flask == "flask" and not which("flask"):
        print("\033[33mhint:\033[0m backend/venv not found and 'flask' is not on "
              "PATH — create the venv (python -m venv backend/venv) and "
              "pip install -r backend/requirements.txt.", file=sys.stderr)
    return [flask, *extra]


def cmd_backend(_args):
    run(_flask_cmd("run"), cwd=BACKEND)


def cmd_dev(_args):
    """Run frontend and backend concurrently; Ctrl+C terminates both."""
    npm = which("npm") or ("npm.cmd" if os.name == "nt" else "npm")
    procs = []
    try:
        print("\033[36m$ starting backend (flask run) + frontend (npm run dev)\033[0m")
        procs.append(subprocess.Popen(_flask_cmd("run"), cwd=str(BACKEND)))
        procs.append(subprocess.Popen([npm, "run", "dev"], cwd=str(ROOT)))
        # Block until either process exits, then fall through to cleanup.
        while True:
            for p in procs:
                if p.poll() is not None:
                    print(f"\033[33mone service exited (code {p.returncode}); "
                          "shutting down the other.\033[0m")
                    return
            try:
                procs[0].wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
    except KeyboardInterrupt:
        print("\n\033[33mstopping services...\033[0m")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()


# --------------------------------------------------------------------------- #
# Database commands
# --------------------------------------------------------------------------- #
def cmd_db_upgrade(_args):
    run(_flask_cmd("db", "upgrade"), cwd=BACKEND)


def cmd_db_pull(_args):
    load_env()
    url = os.environ.get("RENDER_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        die("RENDER_DATABASE_URL is not set. Put the Render *External* Database "
            "URL in a .env file at the repo root (RENDER_DATABASE_URL=...) or "
            "export it in your shell, then re-run 'python cli.py db pull'.")
    # SQLAlchemy/Render style rewrite so the URL is a valid libpq connection URI.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    pg_dump = venv_bin("pg_dump")
    if pg_dump == "pg_dump" and not which("pg_dump"):
        die("pg_dump not found. Install the PostgreSQL client tools (its major "
            "version should match Render's Postgres) and ensure pg_dump is on PATH.")

    BACKUPS.mkdir(parents=True, exist_ok=True)
    outfile = BACKUPS / f"render_{datetime.now():%Y%m%d_%H%M%S}.sql"
    run([pg_dump, "--no-owner", "--no-privileges", "-f", str(outfile), url],
        cwd=BACKEND)
    print(f"\033[32msaved:\033[0m {outfile}")
    print("This is a plain-SQL dump. To load it into a local Postgres later:\n"
          f"    psql \"<local-db-url>\" -f \"{outfile}\"")


# --------------------------------------------------------------------------- #
# Scoped git commands
# --------------------------------------------------------------------------- #
def current_branch():
    out = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=str(ROOT), capture_output=True, text=True,
    )
    return out.stdout.strip() or "master"


def cmd_git(args):
    if not args.message:
        die("a commit message is required, e.g. "
            f"python cli.py git {args.service} -m \"your message\"")

    if args.service == "all":
        # Stage everything (new, modified, deleted) across the whole repo.
        run(["git", "add", "-A"], cwd=ROOT)
    else:
        # Only stage paths that exist so a missing optional file (e.g. a config
        # that isn't present in this repo yet) doesn't abort the whole commit.
        scope = [p for p in GIT_SCOPES[args.service] if (ROOT / p).exists()]
        if not scope:
            print(f"\033[33mno matching paths on disk for '{args.service}'.\033[0m")
            return
        run(["git", "add", "--", *scope], cwd=ROOT)

    staged = subprocess.run(
        ["git", "diff", "--cached", "--quiet"], cwd=str(ROOT)
    ).returncode
    if staged == 0:
        print(f"\033[33mnothing to commit for '{args.service}'.\033[0m")
        return

    run(["git", "commit", "-m", args.message], cwd=ROOT)
    run(["git", "push", "origin", current_branch()], cwd=ROOT)
    print(f"\033[32mpushed {args.service} changes.\033[0m")


# --------------------------------------------------------------------------- #
# argparse wiring
# --------------------------------------------------------------------------- #
def build_parser():
    def cmd(name, desc):
        return f"  {GREEN}{name:<31}{RESET}{DIM}{desc}{RESET}\n"

    parser = argparse.ArgumentParser(
        prog="cli.py",
        description=f"{BOLD}{CYAN}Manage the Brew & Borrow frontend, backend, and database.{RESET}",
        epilog=(
            f"{BOLD}{CYAN}How it works:{RESET}\n"
            f"  In PowerShell you can use the shortcut {YELLOW}bb{RESET} instead of "
            f"{YELLOW}python cli.py{RESET}.\n"
            "  Every command below works with either one.\n"
            "\n"
            f"{BOLD}{CYAN}Examples:{RESET}\n"
            + cmd("bb dev", "Run frontend + backend together")
            + cmd("bb frontend", "Run only the frontend (port 5173)")
            + cmd("bb backend", "Run only the backend  (port 5000)")
            + cmd("bb db upgrade", "Apply database migrations")
            + cmd("bb db pull", "Dump the live Render DB to backend/backups/")
            + "\n"
            + f"  {BOLD}{YELLOW}Commit + push (message in quotes is required):{RESET}\n"
            + cmd('bb git all      -m "message"', "Stage ALL changes, commit and push (auto-deploy)")
            + cmd('bb git frontend -m "message"', "Commit only frontend files")
            + cmd('bb git backend  -m "message"', "Commit only backend files")
            + cmd('bb git database -m "message"', "Commit only migration files")
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("frontend", help="Run the Vite dev server (port 5173)").set_defaults(func=cmd_frontend)
    sub.add_parser("backend", help="Run the Flask dev server (port 5000)").set_defaults(func=cmd_backend)
    sub.add_parser("dev", help="Run frontend + backend together").set_defaults(func=cmd_dev)

    db = sub.add_parser("db", help="Database migration / dump commands")
    db_sub = db.add_subparsers(dest="db_command", required=True)
    db_sub.add_parser("upgrade", help="Apply migrations (flask db upgrade)").set_defaults(func=cmd_db_upgrade)
    db_sub.add_parser("pull", help="Dump the live Render Postgres DB to backend/backups/").set_defaults(func=cmd_db_pull)

    git = sub.add_parser("git", help="Scoped commit + push for one service")
    git.add_argument("service", choices=[*GIT_SCOPES, "all"],
                     help="Which service's paths to commit ('all' = every change)")
    git.add_argument("-m", "--message", help="Commit message (required)")
    git.set_defaults(func=cmd_git)

    return parser


def main(argv=None):
    enable_ansi_colors()
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

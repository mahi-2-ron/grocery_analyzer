import argparse
import subprocess
import sys
import time
from datetime import datetime

def _run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "").strip() or f"Command failed: {' '.join(cmd)}")
    return (p.stdout or "").strip()

def _has_changes() -> bool:
    out = _run(["git", "status", "--porcelain"]) 
    return bool(out)

def _current_branch() -> str:
    return _run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).strip()

def _commit_and_push(message: str | None, remote: str, branch: str, push: bool) -> None:
    if _has_changes():
        _run(["git", "add", "-A"])
        msg = message or f"auto: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        _run(["git", "commit", "-m", msg])
    if push:
        _run(["git", "push", remote, branch])

def _watch_loop(
    message: str | None,
    remote: str,
    branch: str,
    push: bool,
    interval_seconds: float,
    debounce_seconds: float,
) -> None:
    last_change_seen_at: float | None = None
    while True:
        changed = _has_changes()
        now = time.time()

        if changed:
            last_change_seen_at = now
        else:
            if last_change_seen_at is not None and (now - last_change_seen_at) >= debounce_seconds:
                _commit_and_push(message=message, remote=remote, branch=branch, push=push)
                last_change_seen_at = None

        time.sleep(interval_seconds)

def main() -> int:
    parser = argparse.ArgumentParser(prog="autopush", description="Stage, commit (if needed), and push current repo.")
    parser.add_argument("-m", "--message", help="Commit message. If omitted, a timestamped message is used.")
    parser.add_argument("-r", "--remote", default="origin", help="Git remote name (default: origin)")
    parser.add_argument("-b", "--branch", help="Branch to push. If omitted, uses current branch.")
    parser.add_argument("--no-push", action="store_true", help="Do everything except push")
    parser.add_argument("--once", action="store_true", help="Run once and exit (default: watch for changes and auto-push)")
    parser.add_argument("--interval", type=float, default=2.0, help="Watch poll interval in seconds (default: 2.0)")
    parser.add_argument("--debounce", type=float, default=3.0, help="Seconds changes must be stable before committing (default: 3.0)")

    args = parser.parse_args()

    try:
        branch = args.branch or _current_branch()
        if args.once:
            _commit_and_push(message=args.message, remote=args.remote, branch=branch, push=(not args.no_push))
        else:
            _watch_loop(
                message=args.message,
                remote=args.remote,
                branch=branch,
                push=(not args.no_push),
                interval_seconds=args.interval,
                debounce_seconds=args.debounce,
            )
        print("OK")
        return 0
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())

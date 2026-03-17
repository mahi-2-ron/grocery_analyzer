import argparse
import subprocess
import sys
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

def main() -> int:
    parser = argparse.ArgumentParser(prog="autopush", description="Stage, commit (if needed), and push current repo.")
    parser.add_argument("-m", "--message", help="Commit message. If omitted, a timestamped message is used.")
    parser.add_argument("-r", "--remote", default="origin", help="Git remote name (default: origin)")
    parser.add_argument("-b", "--branch", help="Branch to push. If omitted, uses current branch.")
    parser.add_argument("--no-push", action="store_true", help="Do everything except push")

    args = parser.parse_args()

    try:
        if _has_changes():
            _run(["git", "add", "-A"])
            msg = args.message or f"auto: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            _run(["git", "commit", "-m", msg])
        branch = args.branch or _current_branch()
        if not args.no_push:
            _run(["git", "push", args.remote, branch])
        print("OK")
        return 0
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())

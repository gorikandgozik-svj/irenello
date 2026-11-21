"""Create a standalone SKERRY project or bundle its local scripts into one HTML file."""
import argparse
from pathlib import Path
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
commands = parser.add_subparsers(dest="command", required=True)
create = commands.add_parser("new")
create.add_argument("directory", type=Path)
create.add_argument("--template", choices=("empty","landscape","foundry","elevation","geometry"), default="empty")
build = commands.add_parser("build")
build.add_argument("directory", type=Path)
build.add_argument("output", type=Path)
args = parser.parse_args()
project = args.directory.resolve()
if args.command == "new":
    project.mkdir(parents=True, exist_ok=True)
    if any(project.iterdir()):
        parser.error("Choose an empty directory.")
    for source in sorted((ROOT / "examples" / args.template).iterdir()):
        shutil.copyfile(source, project / source.name)
    shutil.copyfile(ROOT / "SkerrySDK.js", project / "SkerrySDK.js")
    index = project / "index.html"
    index.write_text(index.read_text(encoding="utf8").replace("../../SkerrySDK.js", "SkerrySDK.js"), encoding="utf8")
else:
    index = project / "index.html"
    def embed(match):
        path = (project / match[1]).resolve()
        if not path.is_relative_to(project) or path == args.output.resolve():
            parser.error("Script must be a project source file.")
        script = re.sub(r"</script", lambda m: r"<\/script", path.read_text(encoding="utf8"), flags=re.I)
        return "<script>" + script + "</script>"
    if args.output.resolve() == index:
        parser.error("Choose a separate output file.")
    result = re.sub(r'<script src="([^"]+)"></script>', embed, index.read_text(encoding="utf8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf8", dir=args.output.parent, delete=False) as temp:
        temp.write(result)
    Path(temp.name).replace(args.output)

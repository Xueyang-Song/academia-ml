from __future__ import annotations

import os
import platform
import subprocess
import sys
import textwrap
import venv
from pathlib import Path


BASE_REQUIREMENTS = [
    "jupyter_server>=2.17.0",
    "jupyterlab>=4.4.7",
    "ipykernel>=6.29.5",
    "nbformat>=5.10.4",
    "nbclient>=0.10.2",
    "nbconvert>=7.16.6",
    "pandas>=2.2.3",
    "numpy>=2.1.3",
    "scikit-learn>=1.7.1",
    "matplotlib>=3.10.6",
    "seaborn>=0.13.2",
]


def python_executable(venv_dir: Path) -> Path:
    if platform.system().lower().startswith("win"):
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def run(cmd: list[str], cwd: Path) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd), check=True)


def main(project_root: Path) -> None:
    runtime_root = project_root / ".academiaml" / "runtime"
    venv_dir = runtime_root / "venv"
    kernels_prefix = runtime_root / "jupyter"
    requirements_path = runtime_root / "requirements.txt"
    requirements_text = "\n".join(BASE_REQUIREMENTS) + "\n"
    requirements_stamp = runtime_root / "requirements.stamp"

    runtime_root.mkdir(parents=True, exist_ok=True)
    requirements_path.write_text(requirements_text, encoding="utf-8")

    if not venv_dir.exists():
        print("creating venv", venv_dir)
        venv.create(venv_dir, with_pip=True)

    py = python_executable(venv_dir)
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    installed_requirements = requirements_stamp.read_text(encoding="utf-8") if requirements_stamp.exists() else ""
    if installed_requirements != requirements_text:
        run([str(py), "-m", "pip", "install", "--upgrade", "pip"], project_root)
        run([str(py), "-m", "pip", "install", "-r", str(requirements_path)], project_root)
        requirements_stamp.write_text(requirements_text, encoding="utf-8")
    else:
        print("runtime requirements already installed")
    run(
        [
            str(py),
            "-m",
            "ipykernel",
            "install",
            "--prefix",
            str(kernels_prefix),
            "--name",
            "academiaml",
            "--display-name",
            "Python (AcademiaML)",
        ],
        project_root,
    )
    print(
        textwrap.dedent(
            f"""
            bootstrap complete
            project_root={project_root}
            python={py}
            kernels_prefix={kernels_prefix}
            """
        ).strip()
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python scripts/bootstrap_runtime.py <project-path>")
    main(Path(sys.argv[1]).resolve())

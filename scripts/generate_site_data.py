#!/usr/bin/env python3
"""Generate static site data and copy assets for Gorontalo jemaah site."""

from __future__ import annotations

import csv
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
DATA_DIR = PUBLIC_DIR / "data"
ASSETS_DIR = PUBLIC_DIR / "assets"

SOURCE_ROOT = Path("/content/drive/MyDrive/misc/codex")


@dataclass(frozen=True)
class KloterConfig:
    code: str
    label: str
    csv_path: Path
    visa_dir: Path
    kartu_dir: Path
    foto_dir: Path


KLOTERS = [
    KloterConfig(
        code="28",
        label="Kloter 28",
        csv_path=SOURCE_ROOT / "pramancodex.csv",
        visa_dir=SOURCE_ROOT / "visa_mofa_output" / "output",
        kartu_dir=SOURCE_ROOT / "kartu_jemaah_output" / "pramancodex",
        foto_dir=SOURCE_ROOT / "kartu_jemaah_output" / "pramancodex_foto",
    ),
    KloterConfig(
        code="30",
        label="Kloter 30",
        csv_path=SOURCE_ROOT / "visa_mofa_output" / "praman30.csv",
        visa_dir=SOURCE_ROOT / "visa_mofa_output" / "output30",
        kartu_dir=SOURCE_ROOT / "kartu_jemaah_output" / "praman30",
        foto_dir=SOURCE_ROOT / "kartu_jemaah_output" / "praman30_foto",
    ),
]


DISPLAY_FIELDS = [
    ("No. Porsi", "noPorsi"),
    ("Nama", "nama"),
    ("Embarkasi", "embarkasi"),
    ("Kloter", "kloter"),
    ("Rombongan", "rombongan"),
    ("Regu Kloter", "reguKloter"),
    ("Umur", "umur"),
    ("No. Paspor", "noPaspor"),
    ("No. Visa", "noVisa"),
    ("Status Jemaah", "statusJemaah"),
    ("Kab/Kota", "kabKota"),
    ("J. Kelamin", "jenisKelamin"),
    ("Ket", "ket"),
    ("Kloter Pra", "kloterPra"),
    ("Syarikah", "syarikah"),
]


def clean(value: str | None) -> str:
    return (value or "").strip()


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def sanitize_filename(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r'[\\/:*?"<>|]+', "", value)
    return value or "unknown"


def build_file_index(root: Path, pattern: str) -> dict[str, Path]:
    index: dict[str, Path] = {}
    for path in root.rglob(pattern):
        if not path.is_file():
            continue
        match = re.match(r"^(\d+)\s+", path.name)
        if match and match.group(1) not in index:
            index[match.group(1)] = path
    return index


def copy_asset(source: Path | None, destination: Path) -> str | None:
    if source is None or not source.exists():
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return "/" + destination.relative_to(PUBLIC_DIR).as_posix()


def build_person_record(
    row: dict[str, str],
    kloter: KloterConfig,
    visa_index: dict[str, Path],
    kartu_index: dict[str, Path],
    foto_index: dict[str, Path],
) -> dict[str, object]:
    nomor_porsi = clean(row.get("No. Porsi"))
    nama = clean(row.get("Nama"))
    slug = slugify(f"{nomor_porsi}-{nama}")

    asset_base = ASSETS_DIR / f"kloter-{kloter.code}" / slug
    visa_url = copy_asset(visa_index.get(nomor_porsi), asset_base / "visa.pdf")
    kartu_url = copy_asset(kartu_index.get(nomor_porsi), asset_base / "kartu.pdf")
    foto_url = copy_asset(foto_index.get(nomor_porsi), asset_base / "foto.jpg")

    fields = {}
    for source_name, key in DISPLAY_FIELDS:
        fields[key] = clean(row.get(source_name))

    return {
        "id": slug,
        "slug": slug,
        "kloterCode": kloter.code,
        "kloterLabel": kloter.label,
        "noPorsi": nomor_porsi,
        "nama": nama,
        "rombongan": clean(row.get("Rombongan")),
        "reguKloter": clean(row.get("Regu Kloter")),
        "statusJemaah": clean(row.get("Status Jemaah")),
        "kabKota": clean(row.get("Kab/Kota")),
        "jenisKelamin": clean(row.get("J. Kelamin")),
        "umur": clean(row.get("Umur")),
        "noPaspor": clean(row.get("No. Paspor")),
        "noVisa": clean(row.get("No. Visa")),
        "assets": {
            "foto": foto_url,
            "kartu": kartu_url,
            "visa": visa_url,
        },
        "fields": fields,
    }


def sort_people(items: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(
        items,
        key=lambda item: (
            int(str(item["rombongan"]) or 0),
            int(str(item["reguKloter"]) or 0),
            str(item["nama"]),
        ),
    )


def build_summary(people: list[dict[str, object]], label: str, code: str) -> dict[str, object]:
    rombongan = sorted({str(item["rombongan"]) for item in people if str(item["rombongan"]).isdigit()}, key=int)
    regu = sorted({str(item["reguKloter"]) for item in people if str(item["reguKloter"]).isdigit()}, key=int)
    kabkota = sorted({str(item["kabKota"]) for item in people if str(item["kabKota"])})
    status = sorted({str(item["statusJemaah"]) for item in people if str(item["statusJemaah"])})
    return {
        "code": code,
        "label": label,
        "count": len(people),
        "rombongan": rombongan,
        "reguKloter": regu,
        "kabKota": kabkota,
        "statusJemaah": status,
    }


def generate() -> None:
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    if ASSETS_DIR.exists():
        shutil.rmtree(ASSETS_DIR)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    all_people: list[dict[str, object]] = []
    kloter_summaries: list[dict[str, object]] = []

    for kloter in KLOTERS:
        visa_index = build_file_index(kloter.visa_dir, "*.pdf")
        kartu_index = build_file_index(kloter.kartu_dir, "*.pdf")
        foto_index = build_file_index(kloter.foto_dir, "*.jpg")

        people: list[dict[str, object]] = []
        with kloter.csv_path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                nomor_porsi = clean(row.get("No. Porsi"))
                nama = clean(row.get("Nama"))
                if not nomor_porsi.isdigit() or not nama or nama == "-":
                    continue
                people.append(
                    build_person_record(
                        row=row,
                        kloter=kloter,
                        visa_index=visa_index,
                        kartu_index=kartu_index,
                        foto_index=foto_index,
                    )
                )

        people = sort_people(people)
        kloter_payload = {
            "summary": build_summary(people, kloter.label, kloter.code),
            "people": people,
        }
        (DATA_DIR / f"kloter-{kloter.code}.json").write_text(
            json.dumps(kloter_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        all_people.extend(people)
        kloter_summaries.append(kloter_payload["summary"])

    site_payload = {
        "site": {
            "title": "Identitas Jemaah Gorontalo",
            "organization": "Kantor Kementerian Haji dan Umrah Provinsi Gorontalo",
        },
        "kloters": kloter_summaries,
        "totalPeople": len(all_people),
    }
    (DATA_DIR / "site.json").write_text(
        json.dumps(site_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    generate()

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
ENRICHMENT_CSV = PROJECT_ROOT / "totalpelunasan - Sheet1.csv"
OFFICER_CONTACTS_CSV = SOURCE_ROOT / "KONTAK PETUGAS - Sheet1.csv"
ACCOMMODATION_CSV_BY_KLOTER = {
    "28": Path(
        "/content/drive/MyDrive/misc/akomodasi/FINAL_KLOTER_28/01_alokasi_final/alokasi_kamar_kloter_28_revisi_usulgabung.csv"
    ),
    "30": Path(
        "/content/drive/MyDrive/misc/akomodasi/FINAL_KLOTER_30/01_alokasi_final/alokasi_kamar_kloter_30_revisi_usulgabung.csv"
    ),
}


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

GORONTALO_KAB_KOTA = {
    "KOTA GORONTALO",
    "KAB. GORONTALO",
    "KAB. GORONTALO UTARA",
    "KAB. BOALEMO",
    "KAB. BONE BOLANGO",
    "KAB. POHUWATO",
}


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


def is_gorontalo_row(row: dict[str, str]) -> bool:
    return clean(row.get("Kab/Kota")) in GORONTALO_KAB_KOTA


def load_enrichment_data(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return {
            clean(row.get("No. Porsi")): row
            for row in reader
            if clean(row.get("No. Porsi")).isdigit()
        }


def normalize_phone_number(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    if not digits or digits == "0":
        return ""
    if digits.startswith("62"):
        return digits
    if digits.startswith("0"):
        return digits
    return f"0{digits}"


def normalize_officer_role(value: str, kloter_code: str) -> str:
    role = clean(value).strip("()")
    role = re.sub(rf"\s*{re.escape(kloter_code)}\s*$", "", role).strip()
    return role or clean(value) or "Petugas"


def load_officer_contacts(path: Path) -> dict[str, list[dict[str, str]]]:
    if not path.exists():
        return {}

    contacts: dict[str, list[dict[str, str]]] = {}
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            kloter_code = clean(row.get("KLOTER"))
            phone_number = normalize_phone_number(clean(row.get("NOMOR HP")))
            if not kloter_code or not phone_number:
                continue

            contacts.setdefault(kloter_code, []).append(
                {
                    "nama": clean(row.get("NAMA")),
                    "jenisTugas": clean(row.get("JENIS TUGAS")),
                    "label": normalize_officer_role(clean(row.get("JENIS TUGAS")), kloter_code),
                    "kloter": kloter_code,
                    "nomorHp": phone_number,
                }
            )

    return contacts


def load_accommodation_data(path: Path | None, kloter_code: str) -> dict[str, dict[str, str]]:
    if path is None or not path.exists():
        return {}

    accommodation: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            nomor_porsi = clean(row.get("Nomor Porsi"))
            if not nomor_porsi:
                continue

            accommodation[nomor_porsi] = {
                "source": f"Alokasi kamar final Kloter {kloter_code}",
                "locationType": "Asrama Haji",
                "namaHotel": clean(row.get("Nama Hotel")),
                "lantai": clean(row.get("Lantai")),
                "nomorKamar": clean(row.get("Nomor Kamar")),
                "posisiBed": clean(row.get("Posisi Bed")),
            }

    return accommodation


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


def sync_person_asset_dir(asset_base: Path, expected_files: set[str]) -> None:
    if not asset_base.exists():
        return

    for child in asset_base.iterdir():
        if child.is_file() and child.name not in expected_files:
            child.unlink()

    if not any(asset_base.iterdir()):
        asset_base.rmdir()


def prune_kloter_asset_dir(kloter_dir: Path, expected_slugs: set[str]) -> None:
    if not kloter_dir.exists():
        return

    for child in kloter_dir.iterdir():
        if child.is_dir() and child.name not in expected_slugs:
            shutil.rmtree(child)


def build_person_record(
    row: dict[str, str],
    kloter: KloterConfig,
    visa_index: dict[str, Path],
    kartu_index: dict[str, Path],
    foto_index: dict[str, Path],
    enrichment_data: dict[str, dict[str, str]],
    accommodation_data: dict[str, dict[str, str]],
) -> dict[str, object]:
    nomor_porsi = clean(row.get("No. Porsi"))
    nama = clean(row.get("Nama"))
    slug = slugify(f"{nomor_porsi}-{nama}")
    enrichment_row = enrichment_data.get(nomor_porsi, {})
    no_hp = clean(enrichment_row.get("No. HP"))
    nama_desa = clean(enrichment_row.get("Nama Desa"))

    asset_base = ASSETS_DIR / f"kloter-{kloter.code}" / slug
    visa_url = copy_asset(visa_index.get(nomor_porsi), asset_base / "visa.pdf")
    kartu_url = copy_asset(kartu_index.get(nomor_porsi), asset_base / "kartu.pdf")
    foto_url = copy_asset(foto_index.get(nomor_porsi), asset_base / "foto.jpg")
    sync_person_asset_dir(
        asset_base,
        {
            name
            for name, url in {
                "visa.pdf": visa_url,
                "kartu.pdf": kartu_url,
                "foto.jpg": foto_url,
            }.items()
            if url
        },
    )

    fields = {}
    for source_name, key in DISPLAY_FIELDS:
        fields[key] = clean(row.get(source_name))
    fields["noHp"] = no_hp
    fields["namaDesa"] = nama_desa

    person = {
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
        "noHp": no_hp,
        "namaDesa": nama_desa,
        "assets": {
            "foto": foto_url,
            "kartu": kartu_url,
            "visa": visa_url,
        },
        "fields": fields,
    }
    if nomor_porsi in accommodation_data:
        person["accommodation"] = accommodation_data[nomor_porsi]

    return person


def sort_people(items: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(
        items,
        key=lambda item: (
            int(str(item["rombongan"]) or 0),
            int(str(item["reguKloter"]) or 0),
            str(item["nama"]),
        ),
    )


def build_summary(
    people: list[dict[str, object]],
    label: str,
    code: str,
    officer_contacts: list[dict[str, str]],
) -> dict[str, object]:
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
        "officerContacts": officer_contacts,
    }


def generate() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    all_people: list[dict[str, object]] = []
    kloter_summaries: list[dict[str, object]] = []
    enrichment_data = load_enrichment_data(ENRICHMENT_CSV)
    officer_contacts = load_officer_contacts(OFFICER_CONTACTS_CSV)

    for kloter in KLOTERS:
        visa_index = build_file_index(kloter.visa_dir, "*.pdf")
        kartu_index = build_file_index(kloter.kartu_dir, "*.pdf")
        foto_index = build_file_index(kloter.foto_dir, "*.jpg")
        accommodation_data = load_accommodation_data(ACCOMMODATION_CSV_BY_KLOTER.get(kloter.code), kloter.code)

        people: list[dict[str, object]] = []
        expected_slugs: set[str] = set()
        with kloter.csv_path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                nomor_porsi = clean(row.get("No. Porsi"))
                nama = clean(row.get("Nama"))
                if not nomor_porsi.isdigit() or not nama or nama == "-" or not is_gorontalo_row(row):
                    continue
                person = build_person_record(
                    row=row,
                    kloter=kloter,
                    visa_index=visa_index,
                    kartu_index=kartu_index,
                    foto_index=foto_index,
                    enrichment_data=enrichment_data,
                    accommodation_data=accommodation_data,
                )
                people.append(person)
                expected_slugs.add(str(person["slug"]))

        people = sort_people(people)
        prune_kloter_asset_dir(ASSETS_DIR / f"kloter-{kloter.code}", expected_slugs)
        kloter_payload = {
            "summary": build_summary(
                people,
                kloter.label,
                kloter.code,
                officer_contacts.get(kloter.code, []),
            ),
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

"""Download the Google Fonts faces the cabinet actually uses and vendor them.

Writes woff2 files into web/cabinet/public/fonts/ and generates src/fonts.css with
matching @font-face rules (unicode-range preserved, so browsers still pull only the
subsets a page needs).
"""
import os
import re
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ROOT = os.path.join("web", "cabinet")
OUT_DIR = os.path.join(ROOT, "public", "fonts")
CSS_OUT = os.path.join(ROOT, "src", "fonts.css")

# Only the subsets the cabinet needs: UI is ru/en.
KEEP = {"latin", "cyrillic"}

FAMILIES = [
    ("Inter", "wght@400;500;600;700"),
    ("Manrope", "wght@700;800"),
    ("JetBrains+Mono", "wght@400;500"),
]


def get(url: str) -> bytes:
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA})
    ).read()


os.makedirs(OUT_DIR, exist_ok=True)
faces = []

for family, axis in FAMILIES:
    css = get(f"https://fonts.googleapis.com/css2?family={family}:{axis}&display=swap").decode()
    for subset, body in re.findall(r"/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        if subset not in KEEP:
            continue
        name = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", body).group(1)
        urange = re.search(r"unicode-range:\s*([^;]+);", body).group(1).strip()
        src = re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1)

        slug = name.lower().replace(" ", "-")
        filename = f"{slug}-{weight}-{subset}.woff2"
        data = get(src)
        with open(os.path.join(OUT_DIR, filename), "wb") as fh:
            fh.write(data)
        faces.append((name, weight, subset, urange, filename, len(data)))
        print(f"{filename:34s} {len(data)/1024:6.1f} KB")

header = """/*
 * Локальные шрифты кабинета.
 *
 * Раньше Inter и Manrope тянулись через @import в index.css. Браузер узнавал о них
 * только после загрузки и разбора бандла стилей, то есть цепочкой
 * HTML -> index-*.css -> fonts.googleapis.com -> fonts.gstatic.com. До конца этой
 * цепочки заголовки рисовались системным шрифтом и потом подменялись — заметный
 * рывок на первом заходе. Плюс внешняя зависимость от Google Fonts, которая в РФ
 * ненадёжна (та же причина, по которой telegram-web-app.js грузится отложенно).
 *
 * Теперь файлы лежат в public/fonts и отдаются с того же домена. unicode-range
 * сохранён, поэтому страница по-прежнему качает только нужные подмножества.
 * Критичные начертания дополнительно прогреваются через <link rel="preload">
 * в index.html — правя список файлов здесь, не забыть про него.
 *
 * Файл сгенерирован scripts/fetch-fonts.py, руками не править.
 */
"""

with open(CSS_OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(header)
    for name, weight, subset, urange, filename, _ in faces:
        fh.write(
            f"\n@font-face {{\n"
            f"  font-family: '{name}';\n"
            f"  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            f"  font-display: swap;\n"
            f"  src: url('/cabinet/fonts/{filename}') format('woff2');\n"
            f"  unicode-range: {urange};\n"
            f"}}\n"
        )

total = sum(f[5] for f in faces)
print(f"\nfaces: {len(faces)}, total {total/1024:.0f} KB -> {OUT_DIR}")
print(f"css:   {CSS_OUT}")

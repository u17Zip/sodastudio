"""Build the static catalog from folders. Python standard library only."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'
IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}


def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        raise ValueError(f'Cannot read {path.relative_to(ROOT)}: {exc}') from exc


def text(value, field, path):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{path}: {field} must be a non-empty string')
    return value.strip()


def order(value, path):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f'{path}: order must be a number')
    return value


def build():
    site = read_json(ROOT / 'site.json')
    text(site.get('name'), 'name', 'site.json')
    categories = []
    for folder in sorted((ROOT / 'catalog').iterdir()):
        if not folder.is_dir() or folder.name.startswith('.'):
            continue
        meta_path = folder / 'category.json'
        meta = read_json(meta_path) if meta_path.exists() else {'name': folder.name}
        if meta.get('hidden', False):
            continue
        category = {'id': folder.name, 'name': text(meta.get('name'), 'name', meta_path),
                    'order': order(meta.get('order', 100), meta_path), 'products': []}
        for product_dir in sorted(folder.iterdir()):
            if not product_dir.is_dir() or product_dir.name.startswith('.'):
                continue
            info_path = product_dir / 'product.json'
            if not info_path.exists():
                raise ValueError(f'Missing product.json in {product_dir.relative_to(ROOT)}')
            info = read_json(info_path)
            if info.get('hidden', False):
                continue
            name = text(info.get('name'), 'name', info_path)
            for key in ('retail_price', 'wholesale_price'):
                val = info.get(key)
                if val is not None and (isinstance(val, bool) or not isinstance(val, (int, float)) or val < 0):
                    raise ValueError(f'{info_path}: {key} must be a positive number, zero or null')
            sizes = info.get('sizes', [])
            if not isinstance(sizes, list) or any(not isinstance(s, str) for s in sizes):
                raise ValueError(f'{info_path}: sizes must be an array of strings')
            if not isinstance(info.get('color', ''), str):
                raise ValueError(f'{info_path}: color must be a string')
            photos = product_dir / 'photos'
            images = sorted((p for p in photos.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_TYPES),
                            key=lambda p: p.name.casefold()) if photos.exists() else []
            category['products'].append({
                'id': product_dir.name, 'name': name,
                'retail_price': info.get('retail_price'), 'wholesale_price': info.get('wholesale_price'),
                'sizes': sizes, 'color': info.get('color', ''),
                'order': order(info.get('order', 100), info_path),
                'images': [p.relative_to(ROOT).as_posix() for p in images]
            })
        category['products'].sort(key=lambda p: (p['order'], p['id']))
        categories.append(category)
    categories.sort(key=lambda c: (c['order'], c['id']))
    # Validate before replacing the previous build.
    payload = json.dumps({'site': site, 'categories': categories}, ensure_ascii=False, indent=2, allow_nan=False)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copy2(ROOT / 'index.html', OUT / 'index.html')
    shutil.copytree(ROOT / 'assets', OUT / 'assets')
    for category in categories:
        for product in category['products']:
            for image in product['images']:
                target = OUT / image
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / image, target)
    (OUT / 'catalog.json').write_text(payload, encoding='utf-8')
    (OUT / '.nojekyll').touch()
    print(f"Built {len(categories)} categories, {sum(len(c['products']) for c in categories)} products in dist/")


if __name__ == '__main__':
    build()

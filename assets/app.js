'use strict';
const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};
let catalog;
const formatPrice = value => value == null ? '—' : new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: catalog.site.currency || 'RUB', maximumFractionDigits: 2
}).format(value);

function productCard(product) {
  const card = node('article', 'product-card');
  const photo = node('div', 'photo');
  let current = 0;
  const counter = node('span');
  counter.setAttribute('aria-live', 'polite');
  function showPhoto() {
    const src = product.images[current];
    if (!src) {
      photo.replaceChildren(node('span', '', 'Фото будет добавлено'));
      return;
    }
    const image = node('img');
    image.alt = `${product.name} — фото ${current + 1}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      if (photo.contains(image)) photo.replaceChildren(node('span', '', 'Не удалось загрузить фото'));
    }, { once: true });
    image.src = src.split('/').map(encodeURIComponent).join('/');
    photo.replaceChildren(image);
    counter.textContent = `${current + 1} / ${product.images.length}`;
  }
  showPhoto();
  card.append(photo);
  if (product.images.length > 1) {
        // Свайпы по фотографии; вертикальная прокрутка и масштабирование доступны.
    photo.style.touchAction = 'pan-y pinch-zoom';

    let swipe = null;
    const resetSwipe = () => { swipe = null; };

    photo.addEventListener('pointerdown', event => {
      if (!event.isPrimary) {
        resetSwipe();
        return;
      }

      if (event.pointerType !== 'touch' &&
          event.pointerType !== 'pen') return;

      swipe = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };

      photo.setPointerCapture(event.pointerId);
    });

    photo.addEventListener('pointermove', event => {
      if (!swipe || swipe.id !== event.pointerId) return;

      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;

      // Если пользователь прокручивает страницу, отменяем листание.
      if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
        resetSwipe();
      }
    });

    photo.addEventListener('pointerup', event => {
      if (!swipe || swipe.id !== event.pointerId) return;

      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      resetSwipe();

      // Короткие касания и диагональные движения не переключают фото.
      if (Math.abs(dx) < 40 ||
          Math.abs(dx) <= Math.abs(dy) * 1.25) return;

      const direction = dx < 0 ? 1 : -1;
      current = (
        current + direction + product.images.length
      ) % product.images.length;

      showPhoto();
    });

    photo.addEventListener('pointercancel', resetSwipe);
    photo.addEventListener('lostpointercapture', resetSwipe);
    const controls = node('div', 'photo-controls');
    const previous = node('button', '', '←');
    const next = node('button', '', '→');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', `Предыдущее фото: ${product.name}`);
    next.setAttribute('aria-label', `Следующее фото: ${product.name}`);
    previous.onclick = () => { current = (current - 1 + product.images.length) % product.images.length; showPhoto(); };
    next.onclick = () => { current = (current + 1) % product.images.length; showPhoto(); };
    controls.append(previous, counter, next);
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `Фотографии: ${product.name}`);
    card.append(controls);
  }
  card.append(node('h2', '', product.name));
  const details = node('dl', 'details');
  const rows = [
    ['Розничная цена', formatPrice(product.retail_price), 'price'],
    ['Оптовая цена', formatPrice(product.wholesale_price), 'price'],
    ['Размеры', product.sizes, ''],
    ['Цвет', product.color || '—', '']
  ];
  rows.forEach(([label, value, className]) => {
    const row = node('div', `detail ${className}`);
    const dd = node('dd');
    if (Array.isArray(value) && value.length) {
      dd.className = 'sizes';
      value.forEach(size => dd.append(node('span', 'size', size)));
    } else dd.textContent = Array.isArray(value) ? '—' : value;
    row.append(node('dt', '', label), dd);
    details.append(row);
  });
  card.append(details);
  return card;
}

function render() {
  if (!catalog) return;
  if (location.hash === '#main') return;
  let id = '';
  try { id = decodeURIComponent(location.hash.replace(/^#category\//, '')); } catch (_) { /* Invalid URL: home. */ }
  const category = location.hash.startsWith('#category/') ? catalog.categories.find(c => c.id === id) : null;
  $('home').hidden = !!category;
  $('category').hidden = !category;
  document.querySelectorAll('#navigation a').forEach(link => {
    const active = category ? link.dataset.category === category.id : link.hash === '#home';
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${catalog.site.name} — ${category ? category.name : 'каталог одежды'}`;
  if (category) {
    $('category-title').textContent = category.name;
    $('count').textContent = `Товаров: ${category.products.length}`;
    $('products').replaceChildren(...category.products.map(productCard));
    if (!category.products.length) $('products').append(node('p', '', 'Товары скоро появятся.'));
  }
}

async function start() {
  try {
    const response = await fetch('catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = await response.json();
    const site = catalog.site;
    $('brand-name').textContent = site.name;
    $('brand-description').textContent = site.description;
    const phone = node(site.phone ? 'a' : 'span', '', site.phone || 'Номер телефона — будет добавлен');
    if (site.phone) phone.href = 'tel:' + site.phone.replace(/[^+\d]/g, '');
    $('phone').replaceChildren(phone);
    (site.socials || []).forEach(social => {
      const active = /^https?:\/\//i.test(social.url);
      const link = node(active ? 'a' : 'span', '', social.name);
      if (active) { link.href = social.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      else link.title = 'Ссылка будет добавлена';
      $('socials').append(link);
    });
    (site.addresses || []).forEach(address => $('addresses').append(node('p', '', address)));
    $('copyright').textContent = `© ${new Date().getFullYear()} ${site.name}`;
    catalog.categories.forEach(category => {
      const link = node('a', '', category.name);
      link.href = '#category/' + encodeURIComponent(category.id);
      link.dataset.category = category.id;
      $('navigation').append(link);
    });
    $('status').hidden = true;
    if (location.hash === '#main') $('home').hidden = false;
    render();
  } finally { /* The caller displays startup errors. */ }
}
window.addEventListener('hashchange', () => {
  render();
  if (location.hash !== '#main') {
    $('main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
});
start().catch(error => {
  console.error(error);
  $('status').hidden = false;
  $('status').textContent = 'Не удалось загрузить каталог. Обновите страницу. Если вы владелец сайта, проверьте сборку во вкладке Actions на GitHub. Для локального просмотра смотрите README.md.';
});

// Parts BoomBot still needs beyond what was salvaged, with estimated prices
// (USD, typical 2026 listings) and live store search links.

export const STORES = [
  { id: 'amazon', name: 'Amazon', url: q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { id: 'aliexpress', name: 'AliExpress', url: q => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}` },
  { id: 'jumia', name: 'Jumia NG', url: q => `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(q)}` },
  { id: 'alibaba', name: 'Alibaba (bulk)', url: q => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}` },
];

export const REQUIRED = [
  { id: 'switch', name: 'Slide power switch', qty: 'pack of 10', price: [1, 7], query: 'SPDT slide switch 3 pin',
    why: 'Turns BoomBot on and off. The car\'s switch stayed in its old shell.' },
  { id: 'cap', name: '1000 µF 10 V capacitor', qty: '1', price: [1, 6], query: '1000uF 10V electrolytic capacitor',
    why: 'Stops motor noise from crackling through the speaker.' },
  { id: 'jst', name: 'JST-PH 2.0 connectors', qty: 'kit', price: [2, 10], query: 'JST PH 2.0 connector kit',
    why: 'Plug-in connectors, so the battery and boards come apart for repairs.' },
  { id: 'wire', name: '22 AWG silicone wire', qty: 'red + black', price: [2, 9], query: '22AWG silicone wire red black',
    why: 'Carries power from the 1800 mAh cell to both boards.' },
  { id: 'screws', name: 'M2/M3 screws + heat-set inserts', qty: 'kit', price: [3, 14], query: 'M2 M3 screw heat set insert kit',
    why: 'Fixes the boards and motors to the printed base.' },
];

export const OPTIONAL = [
  { id: 'esp32', name: 'ESP32 dev board', short: 'ESP32 brain', price: [4, 12], query: 'ESP32 dev board',
    why: 'Phone-app control, custom moves and Wi-Fi.' },
  { id: 'sonar', name: 'HC-SR04 distance sensor', short: 'Distance sensor', price: [1, 4], query: 'HC-SR04 ultrasonic sensor',
    why: 'Stops BoomBot before it hits a wall.' },
  { id: 'pi', name: 'Raspberry Pi Zero 2 W', short: 'Pi Zero 2 W', price: [15, 25], query: 'Raspberry Pi Zero 2 W',
    why: 'A bigger brain for a voice assistant or a camera.' },
];

export const FILAMENT = { name: 'PLA filament', query: 'PLA filament 1kg', perKg: [18, 25],
  why: 'Prints the shell and base plate. You only use part of a 1 kg spool.' };

export const money = ([a, b]) => `$${Math.round(a)}–${Math.round(b)}`;

export function costs(grams, optional) {
  const sum = list => list.reduce((s, i) => [s[0] + i.price[0], s[1] + i.price[1]], [0, 0]);
  const parts = sum(REQUIRED);
  const filament = [grams / 1000 * FILAMENT.perKg[0], grams / 1000 * FILAMENT.perKg[1]];
  const upgrades = sum(OPTIONAL.filter(o => optional.has(o.id)));
  return { parts, filament, upgrades, total: [parts[0] + filament[0] + upgrades[0], parts[1] + filament[1] + upgrades[1]] };
}

function row(item, priceText, sub) {
  const links = STORES.map(s => `<a href="${s.url(item.query)}" target="_blank" rel="noopener">${s.name}</a>`).join('');
  return `<div class="row"><div class="info"><div class="name">${item.name}<span>${sub}</span></div>
    <div class="why">${item.why}</div><div class="stores">${links}</div></div><div class="price">${priceText}</div></div>`;
}

// Full shopping list as an HTML sheet (readable on phones and desktops, with real links)
export function sheetHTML(grams, optional, salvagedCount) {
  const c = costs(grams, optional);
  const chosen = OPTIONAL.filter(o => optional.has(o.id));
  return `
  <div class="sheet-head"><div><b>BoomBot shopping list</b><span>Estimated prices in USD. Tap a store for live prices.</span></div>
    <button id="sheet-close" aria-label="Close">✕</button></div>
  <div class="group free"><div class="label">Salvaged from your two devices</div>
    <div class="row"><div class="info"><div class="name">${salvagedCount} parts<span>motors, wheels, gearboxes, receiver, watch, driver, light ring, battery…</span></div></div><div class="price free">Free</div></div></div>
  <div class="group"><div class="label">Required</div>
    ${REQUIRED.map(i => row(i, money(i.price), i.qty)).join('')}
    ${row(FILAMENT, money(c.filament), `~${Math.round(grams)} g of a 1 kg spool`)}</div>
  ${chosen.length ? `<div class="group"><div class="label">Upgrades you picked</div>${chosen.map(i => row(i, money(i.price), '')).join('')}</div>` : ''}
  <div class="total"><span>Estimated total</span><b>${money(c.total)}</b></div>
  <p class="note">Small parts are usually sold in packs, so ranges reflect pack prices. Jumia links show local prices in naira.</p>`;
}

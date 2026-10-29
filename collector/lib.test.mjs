import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRubles, parsePrices, parseBenefits, parseAmounts, cleanModel, mergeModels, validateModels, diffModels, decideChange, diffDetails, historyToDelete, formatRub, CHANGE,
} from './lib.mjs';

test('разбор цен в разных записях', () => {
  assert.deepEqual(parseRubles('2 199 000 ₽'), [2199000]);
  assert.deepEqual(parseRubles('2199000 руб.'), [2199000]);
  assert.deepEqual(parseRubles('от 2,199 млн ₽'), [2199000]);
  assert.deepEqual(parseRubles('выгода до 300 тыс. ₽'), [300000]);
  assert.deepEqual(parseRubles('от 1 899 000 ₽'), [1899000]);
  assert.deepEqual(parseRubles('2 499 000 ₽ 2 299 000 ₽'), [2499000, 2299000]);
  assert.deepEqual(parseRubles('Tiggo 7'), []);
});

test('одна модель — одна строка', () => {
  const rows = mergeModels([
    { model: 'T7 ', price: 2299000, max_benefit: 100000 },
    { model: 't7', price: 2199000, max_benefit: 300000 },
    { model: 'T4', price: '-', max_benefit: '-' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 2199000);
  assert.equal(rows[0].max_benefit, 300000);
});

test('подозрительные цифры', () => {
  assert.equal(validateModels([{ model: 'A', price: 1000, max_benefit: '-' }]).length, 1);
  assert.equal(validateModels([{ model: 'A', price: 2000000, max_benefit: 3000000 }]).length, 1);
  assert.equal(validateModels([{ model: 'A', price: 2000000, max_benefit: 300000 }]).length, 0);
});

test('сравнение с прошлым сбором', () => {
  const prev = [
    { model: 'T7', price: 2199000, max_benefit: 300000 },
    { model: 'A8', price: 1500000, max_benefit: '-' },
  ];
  const curr = [
    { model: 't7', price: 2299000, max_benefit: 300000 },
    { model: 'Tiggo 9', price: 3499000, max_benefit: 400000 },
  ];
  assert.deepEqual(diffModels(prev, curr), [
    't7: 2 199 000 ₽/300 000 ₽ → 2 299 000 ₽/300 000 ₽',
    'Новая модель: Tiggo 9 3 499 000 ₽/400 000 ₽',
    'Модель пропала: A8',
  ]);
});

test('статусы сайта', () => {
  const site = { status: 'ok', models: [{ model: 'T7', price: 1, max_benefit: '-' }] };
  assert.equal(decideChange(site, null).change, CHANGE.first);
  assert.equal(decideChange(site, site).change, CHANGE.same);
  assert.equal(decideChange({ status: 'access_error', models: [] }, site).change, CHANGE.error);
});

test('чистка истории: старое удаляем, самое свежее оставляем', () => {
  assert.deepEqual(historyToDelete(['2026-01-01', '2026-06-01', '2026-10-01'], '2026-10-29'), [
    '2026-01-01', '2026-06-01',
  ]);
  assert.deepEqual(historyToDelete(['2025-01-01'], '2026-10-29'), []);
});

test('формат рублей', () => {
  assert.equal(formatRub(2199000), '2 199 000 ₽');
  assert.equal(formatRub('-'), '-');
});

test('чистка названия модели', () => {
  assert.equal(cleanModel('TENET\u00a0T8 - от 2\u00a0899\u00a0000\u00a0₽*', 'Tenet'), 'T8');
  assert.equal(cleanModel('TENET T7 от 2 625 000 ₽*', 'Tenet'), 'T7');
  assert.equal(cleanModel('Tiggo 8 Pro Max', 'Chery'), 'Tiggo 8 Pro Max');
  assert.equal(cleanModel('Chery Tiggo 4 2 199 000 ₽', 'Chery'), 'Tiggo 4');
  assert.equal(cleanModel(' T4L ', 'Tenet'), 'T4L');
  assert.equal(cleanModel('Ли Л6 | Li L6', 'Li'), 'L6');
  assert.equal(cleanModel('TANK 300', 'TANK'), '300');
  assert.equal(cleanModel('Л9 Ливис I L9 Livis', 'Li'), 'L9 Livis');
  assert.equal(cleanModel('Ли Л6 | Li L6¹', 'Li'), 'L6');
});

test('выгоды: только то, что названо выгодой', () => {
  assert.deepEqual(parseBenefits('ВЫГОДА ПО ТРЕЙД-ИН ДО 100 000 РУБ.'), [100000]);
  assert.deepEqual(parseBenefits('TENET T4L С ЕЖЕМЕСЯЧНЫМ ПЛАТЕЖОМ ОТ 16 000,0 ₽**'), []);
  assert.deepEqual(parseBenefits('Выгода в лизинг до 500 000 ₽'), []);
  assert.deepEqual(
    parseBenefits('Ваши уникальные преимущества:\nВыгода по трейд-ин - 200 000 ₽**\nПрограмма выгодный кредит - 50 000 ₽***'),
    [200000, 50000],
  );
  assert.deepEqual(parseBenefits('Цена 2 199 000 ₽'), []);
  assert.deepEqual(parseBenefits('Максимальная выгода\nдо 100 000 ₽'), [100000]);
  assert.deepEqual(parseBenefits('Выгода по программе «TENET Легко» - 145 000**'), [145000]);
  assert.deepEqual(
    parseBenefits('Цена на модель TANK 400 в комплектации Премиум 2026 года выпуска с учетом прямой выгоды в 250 000 рублей, с учетом выгоды по трейд-ин в 250 000 рублей, с учетом дополнительной выгоды по лояльному трейд-ин в 200 000 рублей при сдаче. Ставка 5%'),
    [250000, 250000, 200000],
  );
  assert.deepEqual(parseBenefits('с учетом максимальной выгоды от 4 099 000'), []);
});

test('изменения списком для приложения', () => {
  const d = diffDetails(
    [{ model: 'T7', price: 2199000, max_benefit: 300000 }, { model: 'A8', price: 1, max_benefit: '-' }],
    [{ model: 'T7', price: 2299000, max_benefit: 300000 }, { model: 'T9', price: 3, max_benefit: '-' }],
  );
  assert.deepEqual(d.map((x) => x.type), ['changed', 'new', 'gone']);
  assert.equal(d[0].was.price, 2199000);
  assert.equal(d[0].now.price, 2299000);
});

test('цена: берём суммы после «от», а не из сносок', () => {
  assert.deepEqual(parsePrices('от 4 099 000 ₽ *Цена с учетом выгоды по трейд-ин в 200 000 рублей, 2026 года'), [4099000]);
  assert.deepEqual(parsePrices('2 625 000 ₽'), [2625000]);
  assert.deepEqual(parsePrices('ОТ 2 199 000 ₽*'), [2199000]);
});

test('все суммы как выгоды (benefit_all)', () => {
  assert.deepEqual(parseAmounts('Для комплектации Про / Pro - 980 000 рублей Для комплектации Макс / Max - 1 027 000 рублей'), [980000, 1027000]);
  assert.deepEqual(parseAmounts('автомобили 2025 года, 300 000 ₽'), [300000]);
});

// «Сайт-ловушка»: запутанные фразы, на которых сборщик не должен ошибиться.
test('ловушки: выгоды', () => {
  const max = (t) => { const a = parseBenefits(t); return a.length ? Math.max(...a) : null; };
  const cases = [
    ['Выгода в лизинг до 500 000 ₽', null],
    ['Ежемесячный платёж от 25 000 ₽. Выгода до 200 000 ₽', 200000],
    ['Скидка 10% на КАСКО', null],
    ['Выгода до 15%', null],
    ['Выгода до 1,2 млн ₽', 1200000],
    ['Выгода до 300 тыс. ₽', 300000],
    ['Выгода до 300 000 ₽*\n* предложение действует до 31.12.2026', 300000],
    ['Выгода 2025 года выпуска до 400 000 ₽', 400000],
    ['Цена с учётом выгоды от 2 199 000 ₽', null],
    ['Звоните 8 800 555 35 35, выгода до 100 000 ₽', 100000],
    ['Скидка на ТО 5 000 ₽', null],
    ['Скидка на КАСКО 20 000 ₽', null],
    ['Выгода до 300 000 ₽ при покупке с КАСКО', 300000],
    ['ВЫГОДА ДО 350 000 РУБ.', 350000],
    ['Выгода: от 50 000 до 300 000 ₽', 300000],
    ['Выгода до 300 000 ₽ на маркетплейсе', null],
    ['Выгода до 3 000 000 000 ₽', null],
  ];
  for (const [text, want] of cases) assert.equal(max(text), want, text);
});

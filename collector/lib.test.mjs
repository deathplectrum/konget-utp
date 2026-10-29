import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRubles, parseBenefits, cleanModel, mergeModels, validateModels, diffModels, decideChange, diffDetails, historyToDelete, formatRub, CHANGE,
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

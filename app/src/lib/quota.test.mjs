import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityDay, consume, peek, secondsUntilCityMidnight } from './quota.ts';

// 2026-06-15 is inside US daylight saving: St. Louis is UTC-5.
const JUNE_NOON_UTC = Date.parse('2026-06-15T17:00:00Z'); // noon in St. Louis
// 2026-01-15 is standard time: UTC-6.
const JAN_NOON_UTC = Date.parse('2026-01-15T18:00:00Z');

test('the day is St. Louis\'s, not UTC', () => {
  // 02:00 UTC on the 16th is still the evening of the 15th in St. Louis.
  assert.equal(cityDay(Date.parse('2026-06-16T02:00:00Z')), '2026-06-15');
  assert.equal(cityDay(Date.parse('2026-06-16T06:00:00Z')), '2026-06-16');
});

test('the reset lands on St. Louis midnight, in either half of the year', () => {
  // Noon in St. Louis: 12 hours to go.
  assert.equal(secondsUntilCityMidnight(JUNE_NOON_UTC), 12 * 3600);
  assert.equal(secondsUntilCityMidnight(JAN_NOON_UTC), 12 * 3600);
  // One second before midnight.
  assert.equal(secondsUntilCityMidnight(Date.parse('2026-06-16T04:59:59Z')), 1);
});

test('a budget counts down and then refuses', () => {
  const store = new Map();
  assert.deepEqual(consume(store, 'ip:1.2.3.4', 3, JUNE_NOON_UTC).remaining, 2);
  assert.deepEqual(consume(store, 'ip:1.2.3.4', 3, JUNE_NOON_UTC).remaining, 1);
  const last = consume(store, 'ip:1.2.3.4', 3, JUNE_NOON_UTC);
  assert.equal(last.allowed, true);
  assert.equal(last.remaining, 0);
  const over = consume(store, 'ip:1.2.3.4', 3, JUNE_NOON_UTC);
  assert.equal(over.allowed, false);
  assert.equal(over.remaining, 0);
  assert.equal(over.limit, 3);
  assert.ok(over.resetsIn > 0);
});

test('a refused call is not charged, so hammering it does not dig the hole deeper', () => {
  const store = new Map();
  consume(store, 'k', 1, JUNE_NOON_UTC);
  for (let i = 0; i < 50; i++) consume(store, 'k', 1, JUNE_NOON_UTC);
  assert.equal(store.get('k').count, 1);
  // Raising the limit immediately lets them through again, rather than working off a penalty.
  assert.equal(consume(store, 'k', 2, JUNE_NOON_UTC).allowed, true);
});

test('clients have their own budgets', () => {
  const store = new Map();
  consume(store, 'ip:a', 1, JUNE_NOON_UTC);
  assert.equal(consume(store, 'ip:a', 1, JUNE_NOON_UTC).allowed, false);
  assert.equal(consume(store, 'ip:b', 1, JUNE_NOON_UTC).allowed, true, 'b is unaffected by a');
});

test('the budget resets at St. Louis midnight, not 24 hours later', () => {
  const store = new Map();
  consume(store, 'k', 1, Date.parse('2026-06-16T04:00:00Z')); // 11pm in St. Louis
  assert.equal(consume(store, 'k', 1, Date.parse('2026-06-16T04:30:00Z')).allowed, false);
  assert.equal(consume(store, 'k', 1, Date.parse('2026-06-16T05:30:00Z')).allowed, true, 'past midnight there');
});

test('peek reports what is left without spending it', () => {
  const store = new Map();
  consume(store, 'k', 5, JUNE_NOON_UTC);
  assert.equal(peek(store, 'k', 5, JUNE_NOON_UTC).remaining, 4);
  assert.equal(peek(store, 'k', 5, JUNE_NOON_UTC).remaining, 4, 'still 4 after looking twice');
  assert.equal(peek(store, 'never-used', 5, JUNE_NOON_UTC).remaining, 5);
});

test('a signed-in crew member gets a bigger budget from the same store', () => {
  // Identity is in the key, so the route decides the limit and the store stays dumb.
  const store = new Map();
  for (let i = 0; i < 5; i++) consume(store, 'ip:1.2.3.4', 5, JUNE_NOON_UTC);
  assert.equal(consume(store, 'ip:1.2.3.4', 5, JUNE_NOON_UTC).allowed, false, 'anonymous is spent');
  assert.equal(consume(store, 'user:abc', 40, JUNE_NOON_UTC).allowed, true, 'signed in is not');
});

test('memory stays bounded when a lot of clients show up', () => {
  const store = new Map();
  for (let i = 0; i < 10_050; i++) consume(store, `ip:${i}`, 5, JUNE_NOON_UTC);
  assert.ok(store.size <= 10_001, `store grew to ${store.size}`);
});

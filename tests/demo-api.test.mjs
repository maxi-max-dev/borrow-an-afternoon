import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDemoAPI} from '../public/demo-api.js';
import {routes} from '../public/seed.js';
const plans = JSON.parse(await readFile(new URL('../public/seed-plans.json', import.meta.url)));
const post = body => ({method: 'POST', body: JSON.stringify(body)});
function fixture() {
  const entries = new Map();
  const storage = {getItem: key => entries.get(key) || null, setItem: (key, val) => entries.set(key, val)};
  const connect = () => createDemoAPI({storage, plans, baseURL: 'https://example.com/borrow-an-afternoon'});
  return {storage, connect, api: connect()};
}
test('Static creation, refresh, reply and inbox persist without publishing a route or exposing its owner token', async () => {
  const {api, connect} = fixture();
  const created = await api('/api/routes', post({...routes[0], title: '测试来信', author: '演示作者'}));
  const reopened = connect();
  const route = await reopened('/api/routes/' + created.id);
  assert.equal(route.title, '测试来信');
  assert.equal(route.token, undefined);
  assert.equal((await reopened('/api/routes')).length, 2);
  const path = '/api/routes/' + created.id + '/replies';
  await reopened(path, post({name: '体验者', message: '测试回信'}));
  await assert.rejects(reopened(path), /我的来信/);
  const inbox = await connect()(path, {headers: {Authorization: 'Bearer ' + created.token}});
  assert.equal(inbox[0].message, '测试回信');
  await assert.rejects(fixture().api('/api/routes/' + created.id), /当前浏览器/);
});
test('Only matching place order, coordinates and city receive saved walking records; changed segments remain unverified', async () => {
  const {api} = fixture();
  const route = structuredClone(routes[0]);
  const known = await api('/api/map/route', post(route));
  assert.equal(known.legs.reduce((n, l) => n + l.distance, 0), 1792);
  assert.equal(known.source, 'verified-snapshot');
  route.stops[2].point.lat += 0.01;
  assert.deepEqual((await api('/api/map/route', post(route))).legs.map(l => l.ok), [true, false]);
  route.stops.reverse();
  assert.equal((await api('/api/map/route', post(route))).legs.some(l => l.ok), false);
  await assert.rejects(api('/api/map/search', post({city: '北京', query: '柳浪闻莺'})), /6 个示例地点/);
});
test('Invalid input and storage denial do not report a successful save', async () => {
  const {api, storage} = fixture();
  await assert.rejects(api('/api/routes', post({...routes[0], title: ''})), /请填写/);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(api('/api/routes', post(routes[0])), /浏览器无法保存/);
});

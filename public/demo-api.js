// Static review mode: no server, no credentials, no outgoing API requests.
import {routes as seeds} from './seed.js';

const KEY = 'borrow-afternoon:pages:v1';
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const samePlace = (a, b) => a?.uid === b?.uid && a?.name === b?.name &&
  a?.point?.coordType === b?.point?.coordType && a?.point?.lat === b?.point?.lat && a?.point?.lng === b?.point?.lng;

export function createDemoAPI({storage, plans, baseURL, uuid = () => crypto.randomUUID()}) {
  function read() {
    const raw = storage.getItem(KEY);
    if (!raw) return {routes: {}, replies: {}};
    try {
      const store = JSON.parse(raw);
      if (!store.routes || !store.replies) throw Error();
      return store;
    } catch { throw new Error('浏览器中的演示数据无法读取，请换一个浏览器体验示例。'); }
  }
  function save(store) {
    try { storage.setItem(KEY, JSON.stringify(store)); }
    catch { throw new Error('浏览器无法保存，请减少照片或录音，或允许此站点使用浏览器存储。'); }
  }
  function attachment(value, type) {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 4_000_000 || !value.startsWith(`data:${type}/`))
      throw new Error('演示附件过大或格式不支持，请使用较小的照片或录音。');
    return value;
  }
  return async function api(path, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    if (path === '/api/config') return {staticDemo: true, seedPlans: true, agentPlan: false, localOnly: false, publicOrigin: baseURL, baiduAK: ''};
    if (path === '/api/routes' && method === 'GET') return structuredClone(seeds);
    if (path === '/api/map/search') {
      const query = text(body.query, 200);
      const places = seeds.filter(r => r.city === text(body.city, 30)).flatMap(r => r.stops)
        .filter(s => query && (s.name.includes(query) || query.includes(s.name)))
        .map(({name, address, uid, point}) => ({name, address, uid, point}));
      if (!places.length) throw new Error('演示地点库仅含杭州与上海的 6 个示例地点。请点击“先用示例试一试”，或保留自填地点继续写故事。');
      return structuredClone({places, source: 'verified-snapshot'});
    }
    if (path === '/api/map/route') {
      if (!Array.isArray(body.stops) || body.stops.length < 2 || body.stops.length > 6) throw new Error('请选择 2 至 6 个地点');
      const legs = body.stops.slice(0, -1).map((from, index) => {
        for (const seed of seeds.filter(r => r.city === body.city)) {
          const j = seed.stops.findIndex((s, k) => samePlace(s, from) && samePlace(seed.stops[k + 1], body.stops[index + 1]));
          if (j >= 0 && plans[seed.id]?.legs[j]?.ok) return {...structuredClone(plans[seed.id].legs[j]), index};
        }
        return {index, ok: false, message: '此路段没有已核验记录。演示版不实时规划，请在百度地图中确认。'};
      });
      return {legs, source: 'verified-snapshot', checkedAt: plans['lake-letter'].checkedAt};
    }
    const store = read();
    if (path === '/api/routes' && method === 'POST') {
      if (!Array.isArray(body.stops) || body.stops.length < 2 || body.stops.length > 6) throw new Error('请添加 2 至 6 个地点');
      const route = {
        title: text(body.title, 50), author: text(body.author, 30), city: text(body.city, 30),
        intro: text(body.intro, 350), dedication: text(body.dedication, 100),
        minutes: Math.min(240, Math.max(10, Number(body.minutes) || 45)),
        theme: body.theme === 'street' ? 'street' : 'lake', demo: false,
        stops: body.stops.map(s => ({name: text(s?.name, 80), address: text(s?.address, 200),
          title: text(s?.title, 80), story: text(s?.story, 2000), prompt: text(s?.prompt, 120),
          uid: text(s?.uid, 80), point: s?.point && Number.isFinite(s.point.lat) && Number.isFinite(s.point.lng) &&
            Math.abs(s.point.lat) <= 90 && Math.abs(s.point.lng) <= 180 ? {lat: s.point.lat, lng: s.point.lng, coordType: s.point.coordType} : null,
          art: ['lake', 'bridge', 'street'].includes(s?.art) ? s.art : 'lake',
          photo: attachment(s?.photo, 'image'), audio: attachment(s?.audio, 'audio')}))
      };
      if (!route.title || !route.author || !route.city || !route.intro || route.stops.some(s => !s.name || !s.story))
        throw new Error('请填写标题、署名、城市、开场白，以及每站的地点与故事');
      route.id = 'local-' + uuid();
      route.token = uuid();
      route.createdAt = new Date().toISOString();
      store.routes[route.id] = route;
      save(store);
      return {id: route.id, token: route.token};
    }
    const match = path.match(/^\/api\/routes\/([a-zA-Z0-9-]+)(?:\/(replies))?$/);
    const route = match && (seeds.find(r => r.id === match[1]) || store.routes[match[1]]);
    if (!route) throw new Error('这封来信不在当前浏览器中。请从首页打开示例，或在创建它的浏览器查看。');
    if (!match[2] && method === 'GET') {
      const {token, ...publicRoute} = route;
      return structuredClone(publicRoute);
    }
    if (match[2] && method === 'POST') {
      const message = text(body.message, 1000);
      if (!message) throw new Error('先写一句想说的话吧');
      const reply = {id: uuid(), name: text(body.name, 30) || '路过的人', message,
        photo: attachment(body.photo, 'image'), createdAt: new Date().toISOString()};
      (store.replies[route.id] ||= []).push(reply);
      save(store);
      return {id: reply.id, demo: true};
    }
    if (match[2] && method === 'GET') {
      if (route.demo || options.headers?.Authorization !== 'Bearer ' + route.token)
        throw new Error('请从“我的来信”进入自己创建的路线查看演示回信。');
      return structuredClone(store.replies[route.id] || []);
    }
    throw new Error('此操作未包含在演示版中');
  };
}

let demoAPI;
export async function api(path, options = {}) {
  if (document.documentElement.dataset.mode === 'pages-demo') {
    demoAPI ||= Promise.all([
      import('./demo-api.js'),
      fetch(new URL('./seed-plans.json', import.meta.url)).then(r => {
        if (!r.ok) throw new Error('示例地图数据加载失败，请刷新重试。');
        return r.json();
      })
    ]).then(([{createDemoAPI}, plans]) => createDemoAPI({storage: localStorage, plans, baseURL: new URL('.', import.meta.url).href.replace(/\/$/, '')}));
    return (await demoAPI)(path, options);
  }
  const res = await fetch(path, {...options, headers: {'Content-Type': 'application/json', ...options.headers}});
  let data;
  try { data = await res.json(); } catch { throw new Error('服务暂时不可用，请重新打开页面。'); }
  if (!res.ok) throw new Error(data.error || '请求未完成');
  return data;
}

export function requestGuard({limit=40,windowMs=60_000,now=Date.now}={}) {
  const buckets=new Map();
  return key=>{
    const time=now();
    if(buckets.size>2000)for(const [id,b] of buckets)if(b.until<=time)buckets.delete(id);
    let b=buckets.get(key);
    if(!b||b.until<=time){b={count:0,until:time+windowMs};buckets.set(key,b);}
    if(++b.count>limit)throw Object.assign(new Error('操作有点频繁，请稍后再试。'),{status:429});
  };
}

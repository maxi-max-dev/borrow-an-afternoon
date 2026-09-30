import test from 'node:test';import assert from 'node:assert/strict';import {requestGuard} from '../request-guard.mjs';
test('Request burst limit is per client and expires',()=>{let time=0;const check=requestGuard({limit:2,windowMs:100,now:()=>time});check('a');check('a');assert.throws(()=>check('a'),{status:429});check('b');time=101;assert.doesNotThrow(()=>check('a'));});

import {createDevServer} from './dev.mjs';
import {createFixtureFetcher} from '../test/fixtures/openai-responses.mjs';
const server=createDevServer({env:{OPENAI_API_KEY:'controlled-browser-fixture'},fetcher:createFixtureFetcher()});
server.listen(0,'127.0.0.1',()=>console.log(`Controlled browser test server: http://127.0.0.1:${server.address().port}\nOpenAI responses are simulated. No remote API calls. The first generation deliberately fails so the real sandbox/repair flow is exercised.`));

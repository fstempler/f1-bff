import { createApp } from './server.js';
import { config } from './config.js';

const app = createApp(); 

app.listen(config.port, () => {
    console.log(`BFF running on :${config.port}`)
});
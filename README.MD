# Gun-Tingo

A key:value TingoDB adapter for GunJS.

# Abstract

`gun-tingo` stores the each graph node's key:value (along with some metadata) in a separate document.

[TingoDB](https://github.com/sergeyksv/tingodb) is an embedded JavaScript in-process filesystem or in-memory database upwards compatible with MongoDB at the API level.

### Warning
PROOF OF CONCEPT. DO NOT USE THIS.

### Credits
This Gun hack is made possible by the awesome work of [Mark Nadal](https://github.com/amark), [Spencer Jones](https://github.com/sjones6) and the GunDB community. For anything serious, please refer to [`gun-mongo`](https://github.com/sjones6/gun-mongo) and [`gun-mongo-key`](https://github.com/sjones6/gun-mongo-key) adapters.

# Installation

`yarn add gun-tingo` or `npm install gun-tingo`.

```javascript

const Gun = require('gun');

// Must be added after Gun but before instantiating Gun
require('gun-tingo');

// Instantiate Gun
const gun = new Gun({
    file: false,
    web: httpServer,

    // The following are defaults. You can supply `true` to use all defaults
    mongo: {
        database: 'gun',
        collection: 'gun_mongo_key',
        query: '',
        opt: {
            poolSize: 25 // how large is the connection pool
            // include any other options when initializing:
            // See: http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/connection-settings/
        },
        chunkSize: 250 // see below
    }
});
```

### Chunking Results

For optimal performance, GunMongoKey will chunk key:value results into groups of 250 to stream back to Gun. The default is set fairly high at 250. If you anticipate that nodes might contain large values (e.g., 250 key:value pairs might overwhelm the memory), then you may want to set this lower. If all of the values are small (even if the node itself has many keys), consider setting this higher.

# Issues & Contributing

Issues welcome on [Github](https://github.com/lmangani/gun-tingo/issues).

Community contributions welcome. PRs accepted after code review.

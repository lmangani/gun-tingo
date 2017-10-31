const {KeyValAdapter, Mixins} = require('gun-flint');
const TingoDb = require('tingodb')().Db;

function getCollection(keyField) {
    return keyField ? keyField.substr(0, 2).replace(/\W/, '_') : 'gun';
}

function getKeyField(key, field) {
    return field ? key + '_' + field : key;
}

var gunMongoKey = new KeyValAdapter({

    /**
     * Handle Initialization options passed during Gun initialization of <code>opt</code> calls.
     * 
     * Prepare the adapter to create a connection to the Mongo server
     * 
     * @param {object}  context    The full Gun context during initialization/opt call
     * @param {object}  opt        Options pulled from fully context
     * 
     * @return {void}
     */
    opt: function(context, opt) {
        let {mongo} = opt;
        if (mongo) {
            this.initialized = true;
            let database = mongo.database || 'gun';
            let port = mongo.port || '27017';
            let host = mongo.host || 'localhost';
            let query = mongo.query ? '?' + mongo.query : '';
            this.collection = mongo.collection || 'gun_mongo_key';
            let connectionOpt = mongo.opt || {
                poolSize: 25
            };
            this.db = new TingoDB('/tmp', {});

            // Streaming Chunk size
            this.chunkSize = mongo.chunkSize || 250;

            // Indexes
            this.indexInBackground = mongo.indexInBackground || false;
            this._ensureIndex();
        } else {
            this.initialized = false
        }
    },

    /**
     * Respond to a <code>GET</code> request for data
     * 
     * @param {string} key       The node key
     * @param {string} [field]   A specific field, if requested
     * @param {object} stream    Flint stream, for streaming results back into Gun
     * 
     * @return {void}
     */
    get: function(key, field, stream) {
        if (this.initialized) {
            if (field) {
                this._getField(key, field, stream);
            } else {
                this._getNode(key, stream);
            }   
        }
    },

    /**
     * Retrieve a single node field
     * 
     * @param {string} key       The node key
     * @param {string} field     A specific field 
     * @param {object} stream    Flint stream, for streaming results back into Gun
     * 
     * @return {void}
     */
    _getField: function(key, field, stream) {

        // Find a single field
        this._streamResults(this._getCollection().find({_id: getKeyField(key, field)}).limit(1), stream);
    },

    /**
     * Retrieve a full  node field
     * 
     * @param {string} key       The node key
     * @param {object} stream    Flint stream, for streaming results back into Gun
     * 
     * @return {void}
     */
    _getNode: function(key, stream) {

        // Find an entire nodes key:val, stream results
        this._streamResults(this._getCollection().find({key}), stream, key);
    },

    /**
     * Stream DB results between Mongo <> Flint
     * 
     * @param {object} result     The DB result stream
     * @param {object} streamOut  Stream back to Flint -> Gun
     * 
     * @return {void}
     */
    _streamResults: function(result, streamOut, key) {
        let hasResult = false;
        let queryErr = null;
        let internalErr = this.errors.internal;
        let notFound = this.errors.lost;
        
        let buffer = [];
        result
            .on('data', function(data) {
                if (data) {
                    hasResult = true;
                    buffer.push(data);
                    if (buffer.length === this.chunkSize) {
                        streamOut(null, buffer);
                        buffer = [];
                    }
                }
            })
            .on('error', function(err) {
                queryErr = err;
            })
            .on('end', function(err) {
                queryErr = err;
                if (!err && !hasResult) {
                    streamOut(notFound);
                } else {
                    streamOut((queryErr ? internalErr : null), (buffer.length > 0 ? buffer : null));
                }
            })
            .on('close', function() {
                streamOut(queryErr ? internalErr : null);
            });
    },

    /**
     * Write a batch of key:value pairs
     * 
     * @param {array}     batch   A batch of key:value pairs to write
     * @param {function}  done    A callback to call after all data is written
     */
    put: function(batch, done) {
        if (this.initialized && batch.length) {
            // Essential info
            let written = 0;
            let writeErr = null;
            const bulkBatch = {};

            // Since the batch may contain updates for more than one node, we key each bulk update
            // to the node key and the corresponding collection. Bulk actions can have a limit of 1000
            let track = {}
            batch.forEach(node => {

                // Acquire the bulk by it's Nodekey + write iteration for that node
                // The iteration = number of writes for a single node / 1000
                let iter = track[node.key] = track[node.key] || 1;
                let bulkKey = node.key + iter;
                let bulk = bulkBatch[bulkKey] = bulkBatch[bulkKey] || this._getCollection().initializeOrderedBulkOp();
                bulk.find({_id: getKeyField(node.key, node.field)}).upsert().replaceOne(node);

                // After that are 1000 updates queued in the bulk update,
                // change the iteration so that the loop will get its own
                // bulk operation.
                if (bulkBatch[bulkKey] && bulk._currCmd.updates.length === 1000) {
                    track[node.key]++;
                }
            });

            let bulkKeys = Object.keys(bulkBatch);

            // Handler for each bulk write success
            const bulkWritten = (err, args) => {
                written++;
                if (bulkKeys.length === written) {
                    done((err || (args && !args.ok)) ? this.errors.internal : null);
                }
            };

            // Once all of the bulk operations have been
            // queued up, we fire them of and record their results
            // in <code>bulkWritten</code>
            bulkKeys.forEach(key => bulkBatch[key].execute(bulkWritten));                
        }
    },

    /**
     * Retrieve the collection for a certain node key. The collection does not
     * have to exist in advance
     * 
     * @param {string} key   The collection 
     */
    _getCollection(key) {
        return this.db.collection(this.collection);
    },

    /**
     * Ensure indexes are created on the proper fields
     * 
     * @return {void}
     */
    _ensureIndex() {
        this._getCollection().createIndex({
            key: 1,
            field: 1
        }, {
            background: this.indexInBackground
        });
   }
});

module.exports = gunMongoKey;

const { MongoClient } = require('mongodb');

let client;
async function conectar() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
  }
  return client.db(process.env.MONGO_DB);
}
module.exports = { conectar };
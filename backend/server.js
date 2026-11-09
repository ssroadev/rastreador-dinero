require('dotenv').config();
const { app, server, iniciarChangeStream } = require('./app');
const { conectar } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

conectar()
  .then(async () => {
    await iniciarChangeStream();
    server.listen(PORT, () =>
      console.log(`API en http://localhost:${PORT}`)
    );
  })
  .catch((e) => {
    console.error('No conecta a Mongo:', e.message);
    process.exit(1);
  });

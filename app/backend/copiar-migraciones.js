const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src/migrations');
const dstDir = path.resolve(__dirname, 'dist/migrations');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
  const archivos = fs.readdirSync(srcDir).filter((f) => f.endsWith('.sql'));
  archivos.forEach((f) => {
    fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
  });
  console.log(`📦 [Build Backend] ${archivos.length} migraciones SQL empaquetadas en dist/migrations/`);
}

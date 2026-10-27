/**
 * Un file di installazione per ogni tipo di processore invece di uno solo
 * per tutti: quello per i telefoni (arm64) pesa molto meno.
 * Il file per x86_64 serve solo al telefono simulato della prova automatica.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
    // Aggiunto da plugins/abi-split.js
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "x86_64"
            universalApk false
        }
    }
`;

module.exports = function withAbiSplit(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('plugins/abi-split.js')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/\nandroid\s*\{\n/, (m) => `${m}${BLOCK}`);
    }
    return cfg;
  });
};

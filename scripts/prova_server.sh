#!/usr/bin/env bash
# Lancia la prova del server e ne riporta l'esito in evidenza nella pagina
# dell'esecuzione su GitHub. Una prova saltata vale come fallita: qui il
# server deve esserci.
#
# Uso: VADO_TEST_SERVER=... [VADO_TEST_KEY=...] scripts/prova_server.sh <nome>
set -uo pipefail

name="${1:-server}"
npx tsx --test --test-reporter=tap src/social/remote.server.test.ts > esito.txt 2>&1
status=$?
cat esito.txt

flat() { sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g'; }

if [ "$status" -eq 0 ] && grep -q '^# pass 1' esito.txt && grep -q '^# skipped 0' esito.txt; then
  echo "::notice::Prova del server riuscita ($name): leghe, punti e sfide tra quattro persone simulate."
  exit 0
fi
detail=$(grep -E -A14 '^not ok|^# (pass|fail|skipped)' esito.txt | head -60 | flat)
echo "::error::Prova del server fallita ($name)%0A$detail"
exit 1

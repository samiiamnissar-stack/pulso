#!/bin/sh
# Réplica de lectura en streaming. La primera vez copia el primario con
# pg_basebackup; después arranca en modo standby (solo lectura).
set -e
DATA=/var/lib/postgresql/data
if [ ! -s "$DATA/PG_VERSION" ]; then
  echo "Copiando datos del primario..."
  until pg_isready -h db-primary -p 5432; do sleep 1; done
  rm -rf "$DATA"/*
  pg_basebackup -h db-primary -U replicator -D "$DATA" -R -X stream -P
  chown -R postgres:postgres "$DATA"
  chmod 700 "$DATA"
fi
exec su-exec postgres postgres -D "$DATA" -c hot_standby=on

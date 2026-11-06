#!/usr/bin/env bash
# Restaura un respaldo cifrado de Tutina en una base VACÍA (por ejemplo, un proyecto
# nuevo de Supabase). Ver docs/respaldos.md.
#
#   ARCHIVO="tutina-2026-11-06_0617.dump.gpg" \
#   DESTINO_URL="postgresql://..." \
#   CLAVE_RESPALDO="..." \
#   bash scripts/restaurar-db.sh
#
# Por seguridad, si la base de destino ya tiene tablas no hace nada.

set -euo pipefail

: "${ARCHIVO:?Falta ARCHIVO (el respaldo .dump.gpg descargado)}"
: "${DESTINO_URL:?Falta DESTINO_URL (la conexión a la base vacía donde restaurar)}"
: "${CLAVE_RESPALDO:?Falta CLAVE_RESPALDO (la contraseña con la que se cifró)}"

EXISTENTES="$(psql "$DESTINO_URL" -At -c "select count(*) from information_schema.tables where table_schema = 'public'")"
if [ "$EXISTENTES" != "0" ]; then
  echo "La base de destino ya tiene $EXISTENTES tablas. Para no pisar datos, solo se restaura en una base vacía." >&2
  exit 1
fi

DUMP="$(mktemp)"
INDICE="$(mktemp)"
trap 'rm -f "$DUMP" "$INDICE"' EXIT

echo "1/3 Descifrando..."
if ! printf '%s' "$CLAVE_RESPALDO" | gpg --batch --yes --quiet --pinentry-mode loopback \
  --passphrase-fd 0 --decrypt --output "$DUMP" "$ARCHIVO"; then
  echo "No se pudo descifrar: revisá la contraseña y que el archivo esté completo." >&2
  exit 1
fi

echo "2/3 Restaurando..."
# Toda base nueva ya trae el esquema public: se saltea su creación
pg_restore --list "$DUMP" | grep -v ' SCHEMA - public ' > "$INDICE"
pg_restore --no-owner --no-privileges --exit-on-error --use-list "$INDICE" -d "$DESTINO_URL" "$DUMP"

echo "3/3 Revisando..."
psql "$DESTINO_URL" -v ON_ERROR_STOP=1 -At -c "
  select 'Prendas: '   || (select count(*) from public.\"Producto\")
  union all select 'Variantes: ' || (select count(*) from public.\"VarianteProducto\")
  union all select 'Clientes: '  || (select count(*) from public.\"Cliente\")
  union all select 'Pedidos: '   || (select count(*) from public.\"Pedido\")" | sed 's/^/    /'
echo "Listo. Si es un proyecto nuevo de Supabase, corré también: npm run db:rls"

#!/usr/bin/env bash
# Respaldo cifrado de la base de Tutina (tablas de la app, esquema public).
#
# Lo usa la GitHub Action «Respaldo de la base» todas las noches, y también se puede
# correr a mano:
#
#   DB_URL="postgresql://..." CLAVE_RESPALDO="..." bash scripts/respaldo-db.sh
#
# Variables:
#   DB_URL           Conexión a la base (en Supabase: "Session pooler", puerto 5432).
#   CLAVE_RESPALDO   Contraseña con la que se cifra el archivo. Sin ella no se puede abrir.
#   VERIFICAR_URL    (opcional) Base VACÍA donde se prueba restaurar el respaldo antes de
#                    darlo por bueno. La Action usa una base temporal.
#   SALIDA_DIR       (opcional) Carpeta de salida. Por defecto: respaldos/
#
# Resultado: respaldos/tutina-AAAA-MM-DD_HHMM.dump.gpg
# Cómo restaurarlo: ver docs/respaldos.md

set -euo pipefail

: "${DB_URL:?Falta DB_URL (la conexión a la base)}"
: "${CLAVE_RESPALDO:?Falta CLAVE_RESPALDO (la contraseña para cifrar el respaldo)}"
if [ "${#CLAVE_RESPALDO}" -lt 16 ]; then
  echo "La contraseña del respaldo es muy corta: usá al menos 16 caracteres." >&2
  exit 1
fi

SALIDA_DIR="${SALIDA_DIR:-respaldos}"
FECHA="$(date -u +%Y-%m-%d_%H%M)"
mkdir -p "$SALIDA_DIR"
DUMP="$SALIDA_DIR/tutina-$FECHA.dump"
CIFRADO="$DUMP.gpg"

# El archivo sin cifrar se borra al terminar, aunque algo falle
trap 'rm -f "$DUMP"' EXIT

echo "1/4 Descargando la base ($(pg_dump --version))..."
# Solo las tablas de la app: los esquemas internos de Supabase no hacen falta y
# darían errores al restaurar. -Fc = formato comprimido de PostgreSQL.
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges -Fc -f "$DUMP"

echo "2/4 Revisando el archivo..."
TABLAS="$(pg_restore --list "$DUMP" | grep -c ' TABLE public ' || true)"
if [ "$TABLAS" -eq 0 ]; then
  echo "El respaldo no tiene tablas: algo salió mal." >&2
  exit 1
fi
echo "    $TABLAS tablas en el respaldo."

if [ -n "${VERIFICAR_URL:-}" ]; then
  echo "3/4 Probando restaurar el respaldo en una base vacía..."
  # Seguridad: nunca se restaura sobre una base que ya tiene tablas (podría ser la real)
  EXISTENTES="$(psql "$VERIFICAR_URL" -At -c "select count(*) from information_schema.tables where table_schema = 'public'")"
  if [ "$EXISTENTES" != "0" ]; then
    echo "VERIFICAR_URL tiene que apuntar a una base VACÍA (tiene $EXISTENTES tablas). No se restaura nada." >&2
    exit 1
  fi
  # Toda base nueva ya trae el esquema public: se saltea su creación
  INDICE="$(mktemp)"
  pg_restore --list "$DUMP" | grep -v ' SCHEMA - public ' > "$INDICE"
  pg_restore --no-owner --no-privileges --exit-on-error --use-list "$INDICE" -d "$VERIFICAR_URL" "$DUMP"
  rm -f "$INDICE"
  # Las tablas principales tienen que existir y poder leerse
  CONTEO="$(psql "$VERIFICAR_URL" -v ON_ERROR_STOP=1 -At -c "
    select 'Prendas: '   || (select count(*) from public.\"Producto\")
    union all select 'Variantes: ' || (select count(*) from public.\"VarianteProducto\")
    union all select 'Clientes: '  || (select count(*) from public.\"Cliente\")
    union all select 'Pedidos: '   || (select count(*) from public.\"Pedido\")")"
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    # En GitHub los registros de un repositorio público los ve cualquiera: sin cantidades
    echo "    Restauración de prueba correcta: las tablas principales se leen bien."
  else
    echo "$CONTEO" | sed 's/^/    /'
  fi
else
  echo "3/4 (Sin VERIFICAR_URL: no se prueba la restauración.)"
fi

echo "4/4 Cifrando con AES-256..."
# La contraseña entra por la entrada estándar: no queda a la vista en la lista de procesos
printf '%s' "$CLAVE_RESPALDO" | gpg --batch --yes --quiet --pinentry-mode loopback \
  --passphrase-fd 0 --symmetric --cipher-algo AES256 --output "$CIFRADO" "$DUMP"

TAMANO="$(du -h "$CIFRADO" | cut -f1)"
echo "Listo: $CIFRADO ($TAMANO)"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "archivo=$CIFRADO"
    echo "nombre=$(basename "$CIFRADO")"
    echo "tamano=$TAMANO"
    echo "tablas=$TABLAS"
  } >> "$GITHUB_OUTPUT"
fi

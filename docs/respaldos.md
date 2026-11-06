# Respaldos de la base de datos

Todas las noches (03:17, hora de Argentina) la GitHub Action **«Respaldo de la base»**:

1. descarga las tablas de la app desde Supabase, fotos incluidas;
2. prueba restaurar el respaldo en una base temporal (si no se puede restaurar, falla y GitHub te avisa por mail);
3. lo cifra con AES-256 usando tu contraseña;
4. lo guarda **30 días** en la pestaña **Actions** del repositorio.

> El repositorio es **público**: cualquier usuario de GitHub puede descargar esos archivos.
> Por eso siempre van cifrados. **Sin la contraseña no se pueden abrir, ni siquiera vos.**
> Guardala en un gestor de contraseñas: si la perdés, los respaldos no sirven.

## Configuración (una sola vez)

### 1. Conexión de Supabase

En Supabase: **Connect** (arriba) › **Connection string** › **Session pooler**. Copiá la URL
(empieza con `postgresql://postgres.` y usa el puerto **5432**) y reemplazá
`[YOUR-PASSWORD]` por la contraseña de la base.

Usá **Session pooler** y no «Direct connection»: los servidores de GitHub no pueden
conectarse a la conexión directa de Supabase (solo acepta IPv6).

### 2. Contraseña de cifrado

Generá una contraseña larga (mínimo 16 caracteres; mejor 30 o más al azar), por ejemplo
con tu gestor de contraseñas. Guardala ahí mismo.

### 3. Cargar los secretos en GitHub

En el repositorio: **Settings › Secrets and variables › Actions › New repository secret**.

| Nombre | Valor |
|---|---|
| `SUPABASE_DB_URL` | La URL del paso 1 |
| `RESPALDO_CLAVE` | La contraseña del paso 2 |

Los secretos no se pueden leer desde GitHub una vez guardados y no aparecen en los registros.

### 4. Probarlo

**Actions › Respaldo de la base › Run workflow**. En unos minutos aparece en verde, con el
archivo en la sección **Artifacts** al final de la página.

## Restaurar un respaldo

1. En **Actions › Respaldo de la base**, abrí la corrida del día que querés y descargá el
   artefacto (llega como `.zip`; adentro está el `.dump.gpg`).
2. Creá una base **vacía** (por ejemplo, un proyecto nuevo de Supabase) y copiá su conexión
   **Session pooler**.
3. Con PostgreSQL 17 (`pg_restore`, `psql`) y `gpg` instalados, desde la carpeta del proyecto:

```bash
ARCHIVO="tutina-2026-11-06_0617.dump.gpg" DESTINO_URL="postgresql://..." CLAVE_RESPALDO="tu-contraseña" bash scripts/restaurar-db.sh
```

4. Si es un proyecto nuevo de Supabase, aplicá también la seguridad: `npm run db:rls`
   (con `DATABASE_URL` y `DIRECT_URL` apuntando a la base nueva), y actualizá esas dos
   variables en Vercel.

El script se niega a restaurar sobre una base que ya tiene tablas, para no pisar datos.

## Respaldo a mano (en tu computadora)

```bash
DB_URL="postgresql://..." CLAVE_RESPALDO="tu-contraseña" bash scripts/respaldo-db.sh
```

Queda en la carpeta `respaldos/` (ignorada por git: nunca se sube al repositorio).

## A tener en cuenta

- **Si no hay actividad en el repositorio durante 60 días**, GitHub pausa las tareas
  programadas y avisa por mail. Se reactivan desde **Actions › Respaldo de la base › Enable workflow**.
- Los respaldos guardan las tablas de la app (esquema `public`). La configuración del
  proyecto de Supabase (usuarios del dashboard, claves de API) no se incluye.
- Supabase también tiene sus propios respaldos según el plan (**Database › Backups**). Este
  respaldo es independiente: sirve aunque pierdas el acceso a la cuenta o se borre el proyecto.

# Panel de Telemonitoreo Materno (Web)

Panel web de escritorio (Doctor/Admin) para telemonitorización materna. Frontend React + Vite que consume la misma base de datos Supabase y políticas RLS que la app móvil Flutter.

## Stack

- React 19 + Vite + React Router
- `@supabase/supabase-js` (auth y datos)
- `lucide-react` (iconos SVG; cero emojis en la UI)
- Oxlint para lint

## Scripts

```bash
npm install
npm run dev        # desarrollo
npm run lint       # oxlint
npm run build      # build de producción en dist/
npm run preview    # previsualizar el build
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores. El anon key es `sb_publishable_...` (publishable, seguro para frontend). Nunca subir `.env` al repositorio; `.env.example` sí se versiona.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Despliegue (Vercel)

1. Sube el repo a GitHub (sin `.env`).
2. Importa el proyecto en Vercel: framework **Vite**, comando build `npm run build`, directorio de salida `dist`.
3. En Project Settings > Environment Variables agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. `vercel.json` ya incluye el rewrite SPA para rutas como `/pacientes` (las Vercel Functions en `api/` tienen prioridad sobre el rewrite).

## Invitación de doctores y recuperación de contraseña (Fase 12)

Registrar un doctor no solo guarda la fila en `doctors`: la Vercel Function
`/api/invite-doctor` crea su cuenta en Supabase Auth (correo de invitación para
que el doctor defina su propia contraseña) y el perfil enlazado
(`profiles.doctor_id`). El login tiene además "Olvidé tu contraseña"
(`resetPasswordForEmail`) en `/recuperar`.

Configuración necesaria en el servidor:

1. **Vercel > Project Settings > Environment Variables** agrega **sin** prefijo
   `VITE_`: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Settings > API Keys en
   Supabase). La `service_role` nunca debe compilarse al navegador.
2. **Supabase > Authentication > URL Configuration**: agrega la URL del sitio en
   "Redirect URLs" (p. ej. `https://tu-app.vercel.app/login` y `.../recuperar`),
   para que los correos de invitación y de recuperación apunten a la web.
3. Pruebas locales: ejecuta `vercel dev` (puerto 3000, sirve la función) junto
   con `npm run dev` (Vite proxye `/api` hacia 3000).

Nota: el "Reenviar invitación" a doctores que nunca completaron el registro
queda pendiente: detectar ese estado requiere consultar `auth.admin` por doctor.

## Nota sobre policies RLS

Para que el Admin pueda editar doctores, ejecutar una vez en Supabase SQL:

```sql
DROP POLICY IF EXISTS "doctors_update_admin" ON public.doctors;
CREATE POLICY "doctors_update_admin"
  ON public.doctors
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));
```
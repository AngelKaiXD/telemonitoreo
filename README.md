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
4. `vercel.json` ya incluye el rewrite SPA para rutas como `/pacientes`.

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
# Contratos App Temp

Mini app temporal e independiente para generar contrato PDF manual.

## Objetivo
- Capturar datos en formulario HTML.
- Generar PDF.
- Descargar PDF.
- Ayuda para compartir por email o WhatsApp.
- Sin integraciones con el sistema principal.

## Ejecutar local
Abre `index.html` directamente en el navegador o usa un servidor estatico:

```bash
cd contratos-app-temp
python3 -m http.server 5179
```

Luego abre `http://localhost:5179`.

## Deploy en Vercel (independiente)
1. Crear proyecto nuevo en Vercel.
2. Seleccionar este repo.
3. En `Root Directory` elegir `contratos-app-temp`.
4. Framework Preset: `Other`.
5. Deploy.

## Eliminar cuando salga el sistema real
Borrar la carpeta `contratos-app-temp` completa. No afecta el sistema actual.

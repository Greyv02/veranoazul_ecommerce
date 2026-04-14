# 🌊 Ecosistema Serverless - Verano Azul
Este repositorio contiene la arquitectura completa (Frontend y Backend/Bot Local) para operar tu E-Commerce.

---

## 🚀 Guía de Configuración y Despliegue

### 1. Configurar la Base de Datos (Google Sheets)
1. Ve a [Google Sheets](https://docs.google.com/spreadsheets) y crea un nuevo documento llamado **Verano Azul Inventario**.
2. Nombra la primera pestaña de abajo como **Inventario** (Debe ser exacto).
3. Abre el archivo `template.csv` de este proyecto, copia todo su contenido y pégalo en la hoja (o impórtalo desde `Archivo > Importar`). 
   - Es **muy importante** que los nombres de las columnas en la Fila 1 sean exactos: `Codigo, Nombre, Categoria, Precio_Costo, Precio_Venta, Precio_Oferta, Stock, Imagen_URL, Tallas`.

### 2. Configurar la API del Frontend (Apps Script)
1. En tu hoja de cálculo, ve a **Extensiones > Apps Script**.
2. Borra el código que aparezca y pega TODO el contenido del archivo `codigo_appscript.js` de esta carpeta.
3. Arriba, haz clic en **Guardar** (Icono de disquete).
4. Ve al botón azul derecho **Implementar > Nueva Implementación**.
5. Selecciona el tipo de rueda dentada: **Aplicación Web**.
6. En descripción ponle "API Producción". En 'Ejecutar como' elige **Tú**, y en 'Quién tiene acceso' elige **Cualquier persona**.
7. Haz clic en Implementar y autoriza los permisos de Google. 
8. Al final te dará una **URL de la aplicación web**. Cópiala.
9. Abre el archivo `app.js` en tu computadora, y en la línea 4 cambia `'URL_DE_TU_WEB_APP_AQUI'` por la URL que copiaste. ¡Guarda el archivo! Modifica también la variable `WHATSAPP_NUMBER` con tu número.

### 3. Configurar GitHub Pages (Host del Frontend)
1. Tienes que subir esta carpeta (`index.html`, `styles.css`, `app.js`) a un repositorio de GitHub. 
2. Una vez subido, en GitHub ve a **Settings > Pages**.
3. En la sección "Build and deployment", selecciona como origen (Source) la rama `main` o `master` y guarda.
4. En unos minutos tendrás tu enlace público para que la gente compre.

---

## 🤖 Guía del Bot de Inventario (Local)

El bot sirve para subir ropa cómodamente desde el teléfono y que se actualice tu tienda de forma automática. 

### Pasos
1. **Crear el Bot:** 
   Ve a Telegram, busca a `@BotFather`, envía el comando `/newbot` y sigue los pasos. Al final te dará un token (Ej. `112233:AAHhbbcc...`). Copia esto y pónselo al archivo `bot_inventario.py` en la variable `TELEGRAM_BOT_TOKEN`.
   
2. **Obtener API KEY de ImgBB:** 
   Ve a [ImgBB API](https://api.imgbb.com/), regístrate, y obtén una clave ("API Key"). Pégala en `bot_inventario.py` en `IMGBB_API_KEY`.

3. **Obtener Credenciales de Google:**
   - Ve a [Google Cloud Console](https://console.cloud.google.com).
   - Crea un proyecto.
   - Ve a "API y Servicios" > "Habilitar API y servicios" e habilita `Google Drive API` y `Google Sheets API`.
   - Ve a "Credenciales" > "Crear Credenciales" > "Cuenta de servicio" (Service Account).
   - Ponle un nombre y guarda. Se generará un email de servicio (ej: `algo@mi-proyecto.iam.gserviceaccount.com`).
   - Ve a la cuenta generada, en la pestaña "Claves", añade una **Nueva Clave JSON**. Se descargará un archivo.
   - **¡IMPORTANTE!**: Renombra ese archivo a `credentials.json` y ponlo en esta misma carpeta (donde está tu `bot_inventario.py`).
   - **¡VERIFICACIÓN FINAL!**: Ve a tu hoja de cálculo "Verano Azul Inventario", dale al botón de "Compartir" arriba a la derecha, y añade el email de la cuenta de servicio como **Editor**, para que el bot tenga permiso de escribir.

4. **Ejecutar el bot:**
   - Abre una terminal/consola en esta carpeta.
   - Instala requisitos ejecutando: `pip install -r requirements.txt` (Requiere tener Python instalado).
   - Inicia el bot ejecutando: `python bot_inventario.py`.

A partir de ahí, solo abre el chat de tu bot en Telegram en el celular e ingresa los datos y comandos para manejar tu inventario.

import telebot
import gspread
import requests
import re

# ==========================================
# CONFIGURACIÓN (REEMPLAZA CON TUS DATOS)
# ==========================================
TELEGRAM_BOT_TOKEN = "TU_TOKEN_DE_TELEGRAM_AQUI"
IMGBB_API_KEY = "TU_IMGBB_API_KEY_AQUI"
DOCUMENTO_GOOGLE = "Verano Azul Inventario" # Nombre exacto de tu archivo en Google Sheets
PESTANA_GOOGLE = "Inventario"               # Nombre de la pestaña inferior

# ==========================================
# INICIALIZACIÓN
# ==========================================
print("Iniciando bot...")
bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

try:
    # Asegúrate de tener el archivo credentials.json en la misma carpeta que este script
    gc = gspread.service_account(filename='credentials.json')
    spreadsheet = gc.open(DOCUMENTO_GOOGLE)
    sheet = spreadsheet.worksheet(PESTANA_GOOGLE)
    print("✅ Conexión a Google Sheets exitosa.")
except Exception as e:
    print("❌ Error conectando a Google Sheets. Verifica 'credentials.json' y permisos.")
    print("Detalle:", e)


def subir_imagen_imgbb(file_url):
    """Descarga la imagen de Telegram y la sube a ImgBB, retornando la URL pública."""
    try:
        # Descarga la imagen en memoria
        response = requests.get(file_url)
        
        # Subir a ImgBB
        url = f"https://api.imgbb.com/1/upload?key={IMGBB_API_KEY}"
        files = {
            'image': ('image.jpg', response.content, 'image/jpeg')
        }
        res = requests.post(url, files=files)
        data = res.json()
        
        if data.get('success'):
            return data['data']['url']
        else:
            print("Error subiendo a ImgBB:", data)
            return None
    except Exception as e:
        print("Excepción subiendo imagen:", e)
        return None

def generar_nuevo_codigo():
    """Genera el código de formato VA00X leyendo cuántas filas hay."""
    filas = sheet.get_all_values()
    # Asumimos la fila 1 son encabezados
    total_articulos = len(filas) - 1
    if total_articulos < 0: 
        total_articulos = 0
    
    nuevo_numero = total_articulos + 1
    return f"VA{nuevo_numero:03d}"

# ==========================================
# HANDLERS - NUEVOS PRODUCTOS
# ==========================================
@bot.message_handler(content_types=['photo'])
def recibir_nuevo_articulo(message):
    """
    Se activa cuando se envía una foto. 
    Se espera que en el texto (caption) vaya esto separado por comas:
    Nombre, Precio_Costo, Precio_Venta, Precio_Oferta, Categoría, Tallas, Stock
    Si no hay oferta, se puede dejar vacío ej: Leggins, 5, 10, , Deportivo Mujer, S M L, 10
    """
    caption = message.caption
    if not caption:
        bot.reply_to(message, "⚠️ Foto recibida sin descripción. Por favor envía la foto con el formato requerido:\n"
                              "Nombre, Costo, Venta, Oferta, Categoría, Tallas, Stock\n"
                              "(Si no hay Oferta, deja el espacio vacío, ej: Venta, , Categoría)")
        return

    # Parsear los datos del caption
    parts = [p.strip() for p in caption.split(',')]
    if len(parts) != 7:
        bot.reply_to(message, f"⚠️ Formato incorrecto. Encontré {len(parts)} campos y necesito 7.\n"
                              "Ejemplo: Short Deportivo, 5, 12, , Deportivo Mujer, S M L, 10")
        return

    nombre, costo, venta, oferta, categoria, tallas, stock = parts
    
    bot.reply_to(message, "⏳ Procesando y subiendo imagen a la nube...")

    # Obtener la foto en mejor calidad (la última del array)
    photo = message.photo[-1]
    file_info = bot.get_file(photo.file_id)
    file_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_info.file_path}"
    
    # Subir a ImgBB
    img_public_url = subir_imagen_imgbb(file_url)
    if not img_public_url:
        bot.reply_to(message, "❌ Error al subir la imagen a ImgBB. Revisa tu API KEY.")
        return

    # Generar código
    codigo = generar_nuevo_codigo()

    # Columnas esperadas: Codigo, Nombre, Categoria, Precio_Costo, Precio_Venta, Precio_Oferta, Stock, Imagen_URL, Tallas
    row_data = [
        codigo, nombre, categoria, costo, venta, oferta, stock, img_public_url, tallas
    ]

    try:
        sheet.append_row(row_data)
        bot.reply_to(message, f"✅ *Artículo Agregado Exitosamente*\n\n"
                              f"▪️ *Código:* {codigo}\n"
                              f"▪️ *Producto:* {nombre}\n"
                              f"▪️ *Stock inicial:* {stock}\n"
                              f"[Ver Imagen]({img_public_url})", parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"❌ Error guardando en Google Sheets: {e}")

# ==========================================
# HANDLERS - REGISTRO DE VENTA (REDUCIR STOCK)
# ==========================================
@bot.message_handler(commands=['vendido', 'venta'])
def registrar_venta(message):
    """
    Comando: /vendido VA001 2
    Resta 2 del stock del producto VA001
    """
    try:
        # Extraer parámetros (ignorar el comando en sí)
        args = message.text.split()[1:]
        if len(args) == 0:
            bot.reply_to(message, "⚠️ Usa el formato: /vendido [CÓDIGO] [CANTIDAD]\nEjemplo: /vendido VA001 1")
            return
            
        codigo = args[0].upper()
        cantidad_vendida = 1
        if len(args) > 1:
            cantidad_vendida = int(args[1])

        # Buscar la fila del código
        bot.reply_to(message, f"🔍 Buscando producto {codigo}...")
        
        # En gspread, encontramos la celda
        cell = sheet.find(codigo)
        
        # La columna del stock es la número 7
        fila = cell.row
        stock_actual_str = sheet.cell(fila, 7).value
        stock_actual = int(stock_actual_str) if stock_actual_str else 0
        
        nuevo_stock = stock_actual - cantidad_vendida
        
        if nuevo_stock < 0:
             bot.reply_to(message, f"⚠️ ¡Cuidado! El stock actual es de {stock_actual}. No puedes vender {cantidad_vendida}. No se realizaron cambios.")
             return

        # Actualizar celda
        sheet.update_cell(fila, 7, str(nuevo_stock))
        
        bot.reply_to(message, f"✅ *Venta Registrada*\n\n"
                              f"▪️ Código: {codigo}\n"
                              f"▪️ Descontado: -{cantidad_vendida}\n"
                              f"▪️ *Stock Actualizado:* {nuevo_stock}", parse_mode='Markdown')

    except gspread.exceptions.CellNotFound:
        bot.reply_to(message, "❌ Código no encontrado en el inventario.")
    except Exception as e:
        bot.reply_to(message, f"❌ Ocurrió un error procesando la venta: {e}")

# ==========================================
# INICIO DEL BOT
# ==========================================
@bot.message_handler(commands=['start'])
def send_welcome(message):
    bienvenida = (
        "🤖 *Panel de Control - Verano Azul*\n\n"
        "Para agregar un producto:\n"
        "Envía una foto con ESTE formato en el texto:\n"
        "`Nombre, Costo, Venta, Oferta, Categoría, Tallas, Stock`\n\n"
        "Para registrar una venta:\n"
        "Usa el comando /vendido CÓDIGO CANTIDAD\n"
        "(Ejemplo: `/vendido VA002 1`)"
    )
    bot.reply_to(message, bienvenida, parse_mode='Markdown')

print("🤖 Bot local operando. Esperando comandos (Presiona CTRL+C para detener)...")
bot.infinity_polling()

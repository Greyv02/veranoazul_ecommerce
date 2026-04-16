import telebot
import gspread
import requests
import re
import os
import shutil

# ==========================================
# CONFIGURACIÓN (REEMPLAZA CON TUS DATOS)
# ==========================================
TELEGRAM_BOT_TOKEN = "8662527192:AAG2nID-y7jySgZ7ntEtmpqIj_VTUrh4KkY"
IMGBB_API_KEY = "01abb5a1fa771a46f0bd54a091703fab"
DOCUMENTO_ID = "118e0HzgtMsmvI1N3Z-RItFNHv2NYB_kOd2h_SafHQh8"
# Las categorías corresponden a los nombres exactos de las pestañas
CATEGORIAS = ["Deportivo Mujer", "Deportivo Hombre", "Accesorios Deportivos", "Lentes", "Relojes"]
IMG_FOLDER = r"C:\Users\gre_v\.gemini\antigravity\scratch\veranoazul_ecommerce\Imagenes Pagina"

if not os.path.exists(IMG_FOLDER):
    os.makedirs(IMG_FOLDER)

# ==========================================
# INICIALIZACIÓN
# ==========================================
print("Iniciando bot...")
bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

try:
    gc = gspread.service_account(filename='credentials.json')
    spreadsheet = gc.open_by_key(DOCUMENTO_ID)
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

def parse_stock_string(stock_str):
    """Convierte 'S=10|M=5' en {'S': 10, 'M': 5}"""
    if not stock_str or '=' not in stock_str:
        return {}
    parts = stock_str.split('|')
    result = {}
    for p in parts:
        if '=' in p:
            k, v = p.split('=')
            result[k.strip().upper()] = int(v)
    return result

def format_stock_dict(stock_dict):
    """Convierte {'S': 10} en 'S=10'"""
    return "|".join([f"{k}={v}" for k, v in stock_dict.items()])

def generar_nuevo_codigo():
    """Genera un código basado en el total de artículos en todas las hojas de categorías."""
    total = 0
    for cat in CATEGORIAS:
        try:
            ws = spreadsheet.worksheet(cat)
            total += len(ws.get_all_values()) - 1
        except:
            continue
    return f"VA{total + 1:03d}"

# ==========================================
# HANDLERS - NUEVOS PRODUCTOS
# ==========================================
@bot.message_handler(content_types=['photo'])
def recibir_nuevo_articulo(message):
    """
    Se espera que en el texto (caption) vaya esto separado por comas:
    Nombre, Precio_Costo, Precio_Venta, Precio_Oferta, Categoría, Tallas, StockPorTalla
    """
    caption = message.caption
    if not caption:
        bot.reply_to(message, "⚠️ Foto recibida sin descripción. Por favor envía la foto con el formato requerido:\n"
                              "Nombre, Costo, Venta, Oferta, Categoría, Tallas, Stock\n"
                              "(Ej: Leggins, 5, 12, , Ropa, S M L, 10 5 0)")
        return

    # Parsear los datos del caption
    parts = [p.strip() for p in caption.split(',')]
    if len(parts) != 7:
        bot.reply_to(message, f"⚠️ Formato incorrecto. Encontré {len(parts)} campos y necesito 7.\n"
                              "Ejemplo: Short Deportivo, 5, 12, , Ropa, S M L, 10 5 8")
        return

    nombre, costo, venta, oferta, categoria, tallas_str, stock_input = parts
    
    # Procesar tallas y stock
    list_tallas = [t.strip().upper() for t in tallas_str.replace(',', ' ').split()]
    list_stock = stock_input.split()

    if len(list_tallas) != len(list_stock):
        bot.reply_to(message, f"⚠️ Error: Pusiste {len(list_tallas)} tallas pero {len(list_stock)} cantidades de stock. Deben coincidir.")
        return

    # Crear string de stock: S=10|M=5
    stock_map = {list_tallas[i]: list_stock[i] for i in range(len(list_tallas))}
    stock_final_str = "|".join([f"{k}={v}" for k, v in stock_map.items()])

    bot.reply_to(message, "⏳ Procesando y subiendo imagen a la nube...")

    # Obtener la foto en mejor calidad
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

    # GUARDADO LOCAL DE IMAGEN
    try:
        local_path = os.path.join(IMG_FOLDER, f"{codigo}.jpg")
        img_res = requests.get(file_url, stream=True)
        if img_res.status_code == 200:
            with open(local_path, 'wb') as f:
                img_res.raw.decode_content = True
                shutil.copyfileobj(img_res.raw, f)
            print(f"✅ Imagen guardada localmente en: {local_path}")
    except Exception as e:
        print(f"⚠️ Error guardando imagen local: {e}")

    row_data = [
        codigo, nombre, categoria, costo, venta, oferta, stock_final_str, img_public_url, tallas_str
    ]

    try:
        # Intentar encontrar la pestaña correcta
        if categoria not in CATEGORIAS:
             bot.reply_to(message, f"❌ La categoría '{categoria}' no es válida. Opciones: {', '.join(CATEGORIAS)}")
             return
             
        ws = spreadsheet.worksheet(categoria)
        ws.append_row(row_data)
        resumen_stock = "\n".join([f"   • {k}: {v}" for k, v in stock_map.items()])
        bot.reply_to(message, f"✅ *Artículo Agregado Exitosamente*\n\n"
                              f"▪️ *Código:* {codigo}\n"
                              f"▪️ *Producto:* {nombre}\n"
                              f"▪️ *Stock Detalle:*\n{resumen_stock}\n"
                              f"[Ver Imagen]({img_public_url})", parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"❌ Error guardando en Google Sheets: {e}")

# ==========================================
# HANDLERS - REGISTRO DE VENTA (REDUCIR STOCK)
# ==========================================
@bot.message_handler(commands=['vendido', 'venta'])
def registrar_venta(message):
    """
    Comando: /vendido VA001 M 1
    """
    try:
        args = message.text.split()[1:]
        if len(args) < 1:
            bot.reply_to(message, "⚠️ Usa el formato: /vendido [CÓDIGO] [TALLA] [CANTIDAD]\nEjemplo: /vendido VA001 M 1")
            return
            
        codigo = args[0].upper()
        
        # Buscar la fila del código en todas las pestañas de categorías
        bot.reply_to(message, f"🔍 Buscando producto {codigo}...")
        
        ws = None
        cell = None
        for cat in CATEGORIAS:
            try:
                temp_ws = spreadsheet.worksheet(cat)
                cell = temp_ws.find(codigo)
                if cell:
                    ws = temp_ws
                    break
            except:
                continue
        
        if not ws or not cell:
            bot.reply_to(message, f"❌ Código {codigo} no encontrado en ninguna categoría.")
            return

        fila = cell.row
        # Obtener stock actual y tallas de la fila (Col 7 para Stock, Col 9 para Tallas)
        stock_actual_str = ws.cell(fila, 7).value
        tallas_disponibles = ws.cell(fila, 9).value.upper()
        
        stock_map = parse_stock_string(stock_actual_str)
        
        # Si el producto tiene varias tallas, necesitamos saber cuál se vendió
        if len(stock_map) > 1:
            if len(args) < 2:
                bot.reply_to(message, f"⚠️ Este producto tiene varias tallas ({tallas_disponibles}). Por favor indica cuál vendiste.\nEj: `/vendido {codigo} M 1`", parse_mode='Markdown')
                return
            
            talla_vendida = args[1].upper()
            cantidad_vendida = int(args[2]) if len(args) > 2 else 1
            
            if talla_vendida not in stock_map:
                bot.reply_to(message, f"❌ La talla '{talla_vendida}' no existe para este producto. Opciones: {tallas_disponibles}")
                return
        else:
            # Talla única o solo una talla registrada
            talla_vendida = list(stock_map.keys())[0] if stock_map else "ÚNICA"
            # Si el usuario puso /vendido VA001 2 (sin talla pero con cantidad)
            if len(args) > 1 and args[1].isdigit():
                cantidad_vendida = int(args[1])
            else:
                # Si el usuario puso /vendido VA001 TALLA 2
                cantidad_vendida = int(args[2]) if len(args) > 2 else 1

        # Actualizar stock
        stock_actual_talla = stock_map.get(talla_vendida, 0)
        nuevo_stock_talla = stock_actual_talla - cantidad_vendida
        
        if nuevo_stock_talla < 0:
             bot.reply_to(message, f"⚠️ ¡Cuidado! Solo quedan {stock_actual_talla} de la talla {talla_vendida}. No se realizaron cambios.")
             return

        stock_map[talla_vendida] = nuevo_stock_talla
        nuevo_stock_str = format_stock_dict(stock_map)

        # Actualizar celda
        ws.update_cell(fila, 7, nuevo_stock_str)
        
        resumen = "\n".join([f"   • {k}: {v}" for k, v in stock_map.items()])
        bot.reply_to(message, f"✅ *Venta Registrada*\n\n"
                              f"▪️ Código: {codigo}\n"
                              f"▪️ Talla: {talla_vendida} (-{cantidad_vendida})\n"
                              f"▪️ *Stock Actualizado:*\n{resumen}", parse_mode='Markdown')

    except gspread.exceptions.CellNotFound:
        bot.reply_to(message, "❌ Código no encontrado en el inventario.")
    except Exception as e:
        bot.reply_to(message, f"❌ Error: {e}")

# ==========================================
# INICIO DEL BOT
# ==========================================
@bot.message_handler(commands=['start'])
def send_welcome(message):
    bienvenida = (
        "🤖 *Panel de Control - Verano Azul*\n\n"
        "Para agregar un producto:\n"
        "Envía una foto con descripción:\n"
        "`Nombre, Costo, Venta, Oferta, Categoría, Tallas, StockPorTalla`.\n"
        "Ejemplo: `Leggins, 10, 20, , Ropa, S M L, 5 10 2`\n\n"
        "Para registrar una venta:\n"
        "Usa `/vendido CODIGO TALLA CANTIDAD`.\n"
        "Ejemplo: `/vendido VA001 M 1`"
    )
    bot.reply_to(message, bienvenida, parse_mode='Markdown')

print("🤖 Bot local operando. Esperando comandos (Presiona CTRL+C para detener)...")
bot.infinity_polling()

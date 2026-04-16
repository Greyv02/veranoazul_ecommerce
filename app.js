// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby97ctuvlDah8xC-cmN7jAhrHZu1dqWCweSAL2KDrhX9QiWfcFW-d9d2r_4xlHUiNjnJg/exec';
const WHATSAPP_NUMBER = '584129994320';

// ==========================================
// ESTADO GLOBAL
// ==========================================
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('veranoazul_cart')) || [];

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const categoriesView = document.getElementById('categories-view');
const productsView = document.getElementById('products-view');
const backToCatsBtn = document.getElementById('back-to-categories');
const currentCatNameEl = document.getElementById('current-category-name');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total-price');
const cartCountEl = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    updateCartUI();
});

async function initApp() {
    try {
        if (SCRIPT_URL && SCRIPT_URL !== 'URL_DE_TU_WEB_APP_AQUI') {
            const response = await fetch(SCRIPT_URL);
            allProducts = await response.json();
        } else {
            allProducts = [
                { Codigo: 'VA001', Nombre: 'Leggins Deportivos Seamless', Categoria: 'Deportivo Mujer', Precio_Venta: 15.00, Precio_Oferta: 12.00, Tallas: 'S,M,L', Stock: 'S=5|M=0|L=2', Imagen_URL: 'https://i.ibb.co/3k5Xy9n/placeholder-mujer1.jpg' },
                { Codigo: 'VA101', Nombre: 'Short Running Elite', Categoria: 'Deportivo Hombre', Precio_Venta: 10.00, Precio_Oferta: '', Tallas: 'M,L,XL', Stock: 'M=5|L=0', Imagen_URL: 'https://i.ibb.co/fCXq9x7/placeholder-hombre1.jpg' }
            ];
        }

        document.getElementById('loading-spinner').style.display = 'none';
        renderCategories();
    } catch (error) {
        console.error('Error cargando los productos:', error);
        document.getElementById('loading-spinner').innerHTML = '<p style="color: #ef4444;">Error de conexión. Intenta de nuevo más tarde.</p>';
    }
}

function setupEventListeners() {
    // Navegación de categorías
    categoriesView.addEventListener('click', (e) => {
        const card = e.target.closest('.category-card');
        if (card) {
            const category = card.getAttribute('data-category');
            showCategory(category);
        }
    });

    backToCatsBtn.addEventListener('click', () => {
        productsView.style.display = 'none';
        categoriesView.style.display = 'grid';
        window.scrollTo(0, 0);
    });

    // Delegación eventos en los productos (Selección de talla y botón añadir)
    const productsGrid = document.getElementById('products-grid');
    productsGrid.addEventListener('click', (e) => {
        // Seleccionar talla
        if (e.target.classList.contains('size-btn')) {
            const container = e.target.closest('.sizes-list');
            container.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
        }

        // Añadir al carrito
        if (e.target.closest('.add-to-cart-btn')) {
            const btn = e.target.closest('.add-to-cart-btn');
            const card = btn.closest('.product-card');
            const productCode = btn.getAttribute('data-id');
            const product = allProducts.find(p => p.Codigo === productCode);
            
            // Verificar si el producto requiere talla
            const sizesContainer = card.querySelector('.sizes-list');
            let selectedSize = 'Única';

            if (sizesContainer && product.Tallas.toLowerCase() !== 'unica' && product.Tallas.toLowerCase() !== 'única') {
                const selectedBtn = sizesContainer.querySelector('.size-btn.selected');
                if (!selectedBtn) {
                    alert('Por favor selecciona una talla primero.');
                    return;
                }
                selectedSize = selectedBtn.textContent;
            }

            addToCart(product, selectedSize);
        }
    });

    // Abrir/Cerrar Carrito
    cartBtn.addEventListener('click', toggleCart);
    closeCartBtn.addEventListener('click', toggleCart);
    cartOverlay.addEventListener('click', toggleCart);

    // Eventos dentro del carrito
    cartItemsContainer.addEventListener('click', (e) => {
         const itemEl = e.target.closest('.cart-item');
         if (!itemEl) return;
         
         const code = itemEl.getAttribute('data-code');
         const size = itemEl.getAttribute('data-size');

         if (e.target.closest('.qty-btn')) {
             const btn = e.target.closest('.qty-btn');
             const isPlus = btn.textContent.trim() === '+';
             updateItemQuantity(code, size, isPlus ? 1 : -1);
         }

         if (e.target.classList.contains('remove-btn')) {
             removeFromCart(code, size);
         }
    });

    // Checkout
    checkoutBtn.addEventListener('click', processCheckout);
}

// ==========================================
// RENDERIZADO
// ==========================================

/**
 * Convierte una cadena de stock (ej: "S=5|M=0") en un objeto usable.
 */
function parseStock(stockStr, sizesStr) {
    const stockMap = {};
    const sizes = sizesStr.split(',').map(s => s.trim());
    
    // Si el stock es un número simple (compatibilidad inicial o error de formato manual)
    if (!stockStr.toString().includes('=')) {
        const totalStock = parseInt(stockStr) || 0;
        sizes.forEach(size => stockMap[size] = totalStock);
        return stockMap;
    }

    // Formato nuevo: "S=5|M=0|L=2"
    stockStr.split('|').forEach(part => {
        const [size, qty] = part.split('=');
        if (size && qty !== undefined) {
            stockMap[size.trim()] = parseInt(qty);
        }
    });

    return stockMap;
}

function renderCategories() {
    const categories = [...new Set(allProducts.map(p => p.Categoria))];
    const categoryImages = {
        "Deportivo Mujer": "https://i.ibb.co/3k5Xy9n/placeholder-mujer1.jpg",
        "Deportivo Hombre": "https://i.ibb.co/fCXq9x7/placeholder-hombre1.jpg",
        "Accesorios Deportivos": "https://i.ibb.co/L5kL2C8/placeholder-reloj.jpg",
        "Lentes": "https://i.ibb.co/L5kL2C8/placeholder-reloj.jpg",
        "Relojes": "https://i.ibb.co/L5kL2C8/placeholder-reloj.jpg"
    };

    categoriesView.innerHTML = categories.map(cat => {
        // Buscar un producto de esta categoría para usar su foto real si es posible
        const sampleProduct = allProducts.find(p => p.Categoria === cat && p.Imagen_URL);
        const img = sampleProduct ? sampleProduct.Imagen_URL : (categoryImages[cat] || "logo.jpg");

        return `
            <article class="category-card" data-category="${cat}">
                <img src="${img}" alt="${cat}">
                <h3>${cat}</h3>
            </article>
        `;
    }).join('');
}

function showCategory(category) {
    const filtered = allProducts.filter(p => p.Categoria === category);
    currentCatNameEl.textContent = category;
    renderProducts(filtered);
    categoriesView.style.display = 'none';
    productsView.style.display = 'block';
    window.scrollTo(0, 0);
}

function renderProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="loading-spinner">No hay productos en esta selección.</p>';
        return;
    }

    productsGrid.innerHTML = products.map(product => {
        // Calcular precio a mostrar
        const pVenta = parseFloat(product.Precio_Venta);
        const pOferta = parseFloat(product.Precio_Oferta);
        const isOnSale = pOferta > 0 && pOferta < pVenta;
        const currentPrice = isOnSale ? pOferta : pVenta;
        
        // Procesar stock por talla
        const stockMap = parseStock(product.Stock, product.Tallas);
        const totalStock = Object.values(stockMap).reduce((a, b) => a + b, 0);
        
        // Generar tallas
        const tallasHTML = product.Tallas.split(',').map(talla => talla.trim()).map(talla => {
            const isUnica = talla.toLowerCase() === 'unica' || talla.toLowerCase() === 'única' || talla === '';
            if (isUnica) return '';
            
            const qty = stockMap[talla] || 0;
            const disabled = qty <= 0;
            
            return `<button class="size-btn ${disabled ? 'disabled' : ''}" ${disabled ? 'disabled' : ''}>${talla}</button>`;
        }).join('');
        
        const sizesSection = tallasHTML ? `
            <div class="sizes-container">
                <span class="sizes-label">Selecciona Talla:</span>
                <div class="sizes-list">
                    ${tallasHTML}
                </div>
            </div>
        ` : '';

        // Bloqueo si no hay stock total
        const isOutOfStock = totalStock <= 0;
        const stockBadge = isOutOfStock ? '<span class="stock-badge" style="color:red">Agotado</span>' : '';

        return `
            <article class="product-card">
                ${stockBadge}
                ${isOnSale && !isOutOfStock ? '<span class="stock-badge" style="color:#E11D48">Oferta</span>' : ''}
                <img src="${product.Imagen_URL}" alt="${product.Nombre}" class="product-image" loading="lazy">
                <div class="product-info">
                    <h3 class="product-title">${product.Nombre}</h3>
                    <div class="product-price">
                        ${isOnSale ? `<span style="text-decoration:line-through; font-size:0.85rem; color:#64748B">$${pVenta.toFixed(2)}</span> ` : ''}
                        $${currentPrice.toFixed(2)}
                    </div>
                    ${sizesSection}
                    <button class="add-to-cart-btn" data-id="${product.Codigo}" ${isOutOfStock ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-shopping"></i> ${isOutOfStock ? 'Agotado' : 'Añadir al Carrito'}
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

// ==========================================
// LÓGICA DEL CARRITO
// ==========================================
function addToCart(product, size) {
    // Validar stock antes de añadir
    const stockMap = parseStock(product.Stock, product.Tallas);
    const available = stockMap[size] || 0;
    
    if (available <= 0 && size !== 'Única') {
        alert('Lo sentimos, esa talla se acaba de agotar.');
        return;
    }

    // Determinar precio final
    const pOferta = parseFloat(product.Precio_Oferta);
    const pVenta = parseFloat(product.Precio_Venta);
    const price = (pOferta > 0 && pOferta < pVenta) ? pOferta : pVenta;

    // Buscar si ya existe en el carrito
    const existingIndex = cart.findIndex(item => item.Codigo === product.Codigo && item.Talla === size);
    
    if (existingIndex >= 0) {
        cart[existingIndex].Cantidad += 1;
    } else {
        cart.push({
            Codigo: product.Codigo,
            Nombre: product.Nombre,
            Imagen: product.Imagen_URL,
            Precio: price,
            Talla: size,
            Cantidad: 1
        });
    }

    saveCart();
    updateCartUI();
    
    // Feedback visual opcional
    toggleCart(); 
}

function updateItemQuantity(code, size, change) {
    const item = cart.find(i => i.Codigo === code && i.Talla === size);
    if (!item) return;

    item.Cantidad += change;
    
    if (item.Cantidad <= 0) {
        removeFromCart(code, size);
    } else {
        saveCart();
        updateCartUI();
    }
}

function removeFromCart(code, size) {
    cart = cart.filter(item => !(item.Codigo === code && item.Talla === size));
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('veranoazul_cart', JSON.stringify(cart));
}

function updateCartUI() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <p>Tu carrito está vacío</p>
            </div>
        `;
        cartTotalEl.textContent = '$0.00';
        cartCountEl.textContent = '0';
        checkoutBtn.style.opacity = '0.5';
        checkoutBtn.style.pointerEvents = 'none';
        return;
    }

    checkoutBtn.style.opacity = '1';
    checkoutBtn.style.pointerEvents = 'auto';

    let total = 0;
    let count = 0;

    cartItemsContainer.innerHTML = `
        <div class="cart-instruction">
            ✨ Escoge tus favoritos y finaliza por WhatsApp.
        </div>
    ` + cart.map(item => {
        const itemTotal = item.Precio * item.Cantidad;
        total += itemTotal;
        count += item.Cantidad;

        return `
            <div class="cart-item" data-code="${item.Codigo}" data-size="${item.Talla}">
                <img src="${item.Imagen}" alt="${item.Nombre}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.Nombre}</h4>
                    <span class="cart-item-meta">Código: ${item.Codigo} ${item.Talla !== 'Única' ? '| Talla: ' + item.Talla : ''}</span>
                    <span class="cart-item-price">$${item.Precio.toFixed(2)}</span>
                    <div class="cart-item-actions">
                        <div class="qty-controls">
                            <button class="qty-btn">-</button>
                            <span class="qty-val">${item.Cantidad}</span>
                            <button class="qty-btn">+</button>
                        </div>
                        <button class="remove-btn">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    cartTotalEl.textContent = `$${total.toFixed(2)}`;
    cartCountEl.textContent = count.toString();
}

function toggleCart() {
    cartOverlay.classList.toggle('active');
    cartSidebar.classList.toggle('active');
}

function processCheckout() {
    if (cart.length === 0) return;

    let text = '*¡Hola Verano Azul!* 🌞🌊\nQuiero confirmar el siguiente pedido:\n\n';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.Precio * item.Cantidad;
        total += itemTotal;
        
        text += `▪️ *${item.Nombre}* (x${item.Cantidad})\n`;
        text += `   Código: ${item.Codigo}\n`;
        if (item.Talla !== 'Única') text += `   Talla: ${item.Talla}\n`;
        text += `   Precio: $${itemTotal.toFixed(2)}\n\n`;
    });

    text += `*TOTAL A PAGAR: $${total.toFixed(2)}*\n\n`;
    text += `Quedo atento(a) para los métodos de pago. ¡Gracias!`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
}

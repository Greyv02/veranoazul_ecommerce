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
// TRACKING (META PIXEL)
// ==========================================
function getExternalId() {
    let id = localStorage.getItem('fb_external_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('fb_external_id', id);
    }
    return id;
}

function trackPixel(eventName, params = {}) {
    if (typeof fbq === 'function') {
        fbq('track', eventName, params);
    }
}

function initTracking() {
    const externalId = getExternalId();
    if (typeof fbq === 'function') {
        fbq('init', '1166748008643096', { external_id: externalId });
        fbq('track', 'PageView');
    }

    // Nivel 2: ViewContent (Interacción por tiempo y scroll)
    let interacted = false;
    const triggerInteraction = () => {
        if (!interacted) {
            interacted = true;
            trackPixel('ViewContent', { content_name: 'Main Page', content_category: 'E-commerce' });
        }
    };

    // 15 Segundos de permanencia
    setTimeout(triggerInteraction, 15000);

    // Scroll 25% de la página
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const height = document.documentElement.scrollHeight - window.innerHeight;
        if (scrolled > height * 0.25) {
            triggerInteraction();
        }
    });
}

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const categoriesView = document.getElementById('categories-view');
const productsView = document.getElementById('products-view');
const backToCatsBtn = document.getElementById('back-to-categories');
const currentCatNameEl = document.getElementById('current-category-name');

// Carrito DOM
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartOverlay = document.getElementById('cart-overlay');
const cartSidebar = document.getElementById('cart-sidebar');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total-price');
const cartCountEl = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const sizeFilterContainer = document.getElementById('size-filter-container');

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTracking();
    initApp();
    setupEventListeners();
    updateCartUI();
});

async function initApp() {
    try {
        if (SCRIPT_URL && SCRIPT_URL !== 'URL_DE_TU_WEB_APP_AQUI') {
            const response = await fetch(SCRIPT_URL);
            const rawData = await response.json();
            
            // Procesar y normalizar datos
            allProducts = rawData.map(p => {
                // Normalizar categoría (Title Case) para evitar duplicados por minúsculas/mayúsculas
                const rawCat = (p.Categoria || "Otros").trim().toLowerCase();
                const normalizedCat = rawCat.replace(/\b\w/g, c => c.toUpperCase());
                
                // Helper para limpiar precios (remover $, espacios, comas)
                const cleanPrice = (val) => {
                    if (!val) return 0;
                    return parseFloat(val.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                };

                // Determinar precio real (Oferta > Venta)
                const precioVenta = cleanPrice(p.Precio_Venta);
                const precioOferta = p.Precio_Oferta ? cleanPrice(p.Precio_Oferta) : null;
                const finalPrice = (precioOferta !== null && precioOferta > 0) ? precioOferta : precioVenta;

                return {
                    ...p,
                    Categoria: normalizedCat,
                    Precio_Final: finalPrice,
                    Precio_Original: precioVenta,
                    Tiene_Oferta: (precioOferta !== null && precioOferta > 0)
                };
            });
        } else {
            // Datos de prueba (Fallback)
            allProducts = [
                { Codigo: 'VA001', Nombre: 'Leggins Deportivos', Categoria: 'Deportivo Mujer', Precio_Venta: 15, Precio_Oferta: 12, Tallas: 'S,M,L', Stock: 'S=5|M=0|L=2', Imagen_URL: 'https://i.ibb.co/3k5Xy9n/placeholder-mujer1.jpg', Precio_Final: 12, Tiene_Oferta: true },
                { Codigo: 'VA101', Nombre: 'Short Running', Categoria: 'Deportivo Hombre', Precio_Venta: 10, Precio_Oferta: '', Tallas: 'M,L,XL', Stock: 'M=5|L=0', Imagen_URL: 'https://i.ibb.co/fCXq9x7/placeholder-hombre1.jpg', Precio_Final: 10, Tiene_Oferta: false }
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
    // Navegación de categorías (Cards)
    categoriesView.addEventListener('click', (e) => {
        const card = e.target.closest('.category-card');
        if (card) {
            const category = card.getAttribute('data-category');
            showCategory(category);
        }
    });

    // Navegación de categorías (Header List)
    const headerLinks = document.getElementById('categories-list');
    if (headerLinks) {
        headerLinks.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li) {
                const category = li.getAttribute('data-category');
                if (category === 'Todos') {
                    productsView.style.display = 'none';
                    categoriesView.style.display = 'grid';
                    updateHeaderNav('Todos');
                } else {
                    showCategory(category);
                }
            }
        });
    }

    backToCatsBtn.addEventListener('click', () => {
        productsView.style.display = 'none';
        categoriesView.style.display = 'grid';
        updateHeaderNav('Todos');
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

        // Selector de Cantidad en el card
        if (e.target.closest('.qty-btn-card')) {
            const btn = e.target.closest('.qty-btn-card');
            const input = btn.parentElement.querySelector('input');
            let val = parseInt(input.value);
            if (btn.textContent === '+') input.value = val + 1;
            else if (val > 1) input.value = val - 1;
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

            const requiresSize = sizesContainer && product.Tallas.toLowerCase() !== 'unica' && product.Tallas.toLowerCase() !== 'única' && product.Tallas.trim() !== '';

            if (requiresSize) {
                const selectedBtn = sizesContainer.querySelector('.size-btn.selected');
                if (!selectedBtn) {
                    alert('Por favor selecciona una talla primero.');
                    return;
                }
                selectedSize = selectedBtn.textContent;
            }

            const qtyInput = card.querySelector('.qty-input-card');
            const quantity = parseInt(qtyInput.value) || 1;

            flyToCart(card.querySelector('.product-image'));
            addToCart(product, selectedSize, quantity);
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

function parseStock(stockStr, sizesStr) {
    const stockMap = {};
    const sizes = (sizesStr || "").split(',').map(s => s.trim()).filter(s => s !== '');
    
    // Si no hay tallas definidas, tratar como Única
    if (sizes.length === 0) sizes.push('Única');

    const rawStock = stockStr ? stockStr.toString().trim() : "0";
    
    // Si el stock es un número simple (ej: "35") o está vacío
    if (!rawStock.includes('=') && !rawStock.includes('|')) {
        const totalStock = parseInt(rawStock.replace(/[^\d]/g, '')) || 0;
        sizes.forEach(size => stockMap[size] = totalStock);
        return stockMap;
    }

    // Formato: "S=5|M=0|L=2"
    rawStock.split('|').forEach(part => {
        const [size, qty] = part.split('=');
        if (size && qty !== undefined) {
            stockMap[size.trim()] = parseInt(qty.replace(/[^\d]/g, '')) || 0;
        }
    });

    // Asegurar que todas las tallas tengan una entrada en el map
    sizes.forEach(size => {
        if (stockMap[size] === undefined) stockMap[size] = 0;
    });

    return stockMap;
}

function renderCategories() {
    const categories = [...new Set(allProducts.map(p => p.Categoria))];
    
    // 1. Renderizar Nav Superior (Header)
    const headerLinks = document.getElementById('categories-list');
    if (headerLinks) {
        headerLinks.innerHTML = `
            <li class="active" data-category="Todos">Todos</li>
            ${categories.map(cat => `<li data-category="${cat}">${cat}</li>`).join('')}
        `;
    }

    // 2. Renderizar Grid de Categorías (Vista Principal)
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
        const img = (sampleProduct && sampleProduct.Imagen_URL) ? sampleProduct.Imagen_URL : (categoryImages[cat] || "logo.jpg");

        return `
            <article class="category-card" data-category="${cat}">
                <img src="${img}" alt="${cat}">
                <h3>${cat}</h3>
            </article>
        `;
    }).join('');
}

function showCategory(category) {
    const targetCat = category.trim();
    const filtered = allProducts.filter(p => (p.Categoria || "").trim() === targetCat);
    currentCatNameEl.textContent = targetCat;
    
    // Actualizar nav superior
    updateHeaderNav(category);
    
    // Generar Filtros de Talla
    renderSizeFilters(filtered);
    
    renderProducts(filtered);
    categoriesView.style.display = 'none';
    productsView.style.display = 'block';
    window.scrollTo(0, 0);
}

function updateHeaderNav(activeCategory) {
    const listItems = document.querySelectorAll('#categories-list li');
    listItems.forEach(li => {
        if (li.getAttribute('data-category') === activeCategory) {
            li.classList.add('active');
            // Hacer scroll horizontal automático si es necesario
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            li.classList.remove('active');
        }
    });
}

function renderSizeFilters(products) {
    const sizes = new Set();
    products.forEach(p => {
        p.Tallas.split(',').forEach(s => {
            const trimmed = s.trim().toUpperCase();
            if (trimmed && trimmed !== 'UNICA' && trimmed !== 'ÚNICA') sizes.add(trimmed);
        });
    });

    if (sizes.size === 0) {
        sizeFilterContainer.innerHTML = '';
        return;
    }

    const sizeArray = Array.from(sizes).sort();
    sizeFilterContainer.innerHTML = `
        <div class="filter-chip active" data-size="TODOS">Todas</div>
        ${sizeArray.map(s => `<div class="filter-chip" data-size="${s}">${s}</div>`).join('')}
    `;

    // Eventos de filtro
    sizeFilterContainer.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            sizeFilterContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const selectedSize = chip.getAttribute('data-size');
            
            const category = currentCatNameEl.textContent;
            const categoryProducts = allProducts.filter(p => p.Categoria === category);
            
            if (selectedSize === 'TODOS') {
                renderProducts(categoryProducts);
            } else {
                const filtered = categoryProducts.filter(p => p.Tallas.toUpperCase().includes(selectedSize));
                renderProducts(filtered);
            }
        });
    });
}

function renderProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="loading-spinner">No hay productos en esta selección.</p>';
        return;
    }

    productsGrid.innerHTML = products.map(product => {
        // Usar valores pre-calculados en initApp
        const currentPrice = product.Precio_Final;
        const pVenta = product.Precio_Original;
        const isOnSale = product.Tiene_Oferta;
        
        // Procesar stock por talla
        const stockMap = parseStock(product.Stock, product.Tallas);
        const totalStock = Object.values(stockMap).reduce((a, b) => a + b, 0);
        
        // Generar tallas
        const tallasHTML = product.Tallas.split(',').map(talla => talla.trim()).map(talla => {
            const isUnica = talla.toLowerCase() === 'unica' || talla.toLowerCase() === 'única' || talla === '';
            if (isUnica) return '';
            
            const qty = stockMap[talla] || 0;
            const disabled = qty <= 0;
            
            return `<button class="size-btn ${disabled ? 'selected' === '' : ''} ${disabled ? 'disabled' : ''}" ${disabled ? 'disabled' : ''}>${talla}</button>`;
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
                        ${isOnSale ? `<span style="text-decoration:line-through; font-size:0.8rem; color:#64748B">$${pVenta.toFixed(2)}</span> ` : ''}
                        $${currentPrice.toFixed(2)}
                    </div>
                    ${sizesSection}
                    <div class="qty-input-group">
                        <button class="qty-btn-card">-</button>
                        <input type="number" value="1" min="1" class="qty-input-card" readonly>
                        <button class="qty-btn-card">+</button>
                    </div>
                    <button class="add-to-cart-btn" data-id="${product.Codigo}" ${isOutOfStock ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-shopping"></i> ${isOutOfStock ? 'Agotado' : 'Añadir'}
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

// ==========================================
// LÓGICA DEL CARRITO
// ==========================================
function addToCart(product, size, quantity = 1) {
    // Validar stock antes de añadir
    const stockMap = parseStock(product.Stock, product.Tallas);
    const available = stockMap[size] || 0;
    
    if (available <= 0 && size !== 'Única') {
        alert('Lo sentimos, esa talla se acaba de agotar.');
        return;
    }

    // Usar el precio final ya calculado
    const price = product.Precio_Final;

    // Buscar si ya existe en el carrito
    const existingIndex = cart.findIndex(item => item.Codigo === product.Codigo && item.Talla === size);
    
    if (existingIndex >= 0) {
        cart[existingIndex].Cantidad += quantity;
    } else {
        cart.push({
            Codigo: product.Codigo,
            Nombre: product.Nombre,
            Imagen: product.Imagen_URL,
            Precio: price,
            Talla: size,
            Cantidad: quantity
        });
    }

    saveCart();
    updateCartUI();
    
    // Abrir carrito después de un segundo para que se vea la animación
    setTimeout(() => {
        if (!cartSidebar.classList.contains('active')) toggleCart();
    }, 800);
}

function flyToCart(imgElement) {
    const cartIcon = cartBtn;
    const flyingImg = imgElement.cloneNode();
    
    const rect = imgElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();
    
    Object.assign(flyingImg.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: '10000',
        borderRadius: '50%',
        transition: 'all 0.8s cubic-bezier(0.19, 1, 0.22, 1)',
        pointerEvents: 'none'
    });
    
    document.body.appendChild(flyingImg);
    
    setTimeout(() => {
        Object.assign(flyingImg.style, {
            left: `${cartRect.left + cartRect.width / 2}px`,
            top: `${cartRect.top + cartRect.height / 2}px`,
            width: '20px',
            height: '20px',
            opacity: '0'
        });
    }, 50);
    
    setTimeout(() => flyingImg.remove(), 800);
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
        const unitPrice = parseFloat(item.Precio) || 0;
        const itemTotal = unitPrice * item.Cantidad;
        total += itemTotal;
        count += item.Cantidad;

        return `
            <div class="cart-item" data-code="${item.Codigo}" data-size="${item.Talla}">
                <img src="${item.Imagen}" alt="${item.Nombre}" class="cart-item-img">
                <div class="cart-item-info">
                    <div class="cart-item-header">
                        <h4 class="cart-item-title">${item.Nombre}</h4>
                        <span class="cart-item-total-price">$${itemTotal.toFixed(2)}</span>
                    </div>
                    <div class="cart-item-details">
                        <span class="cart-item-meta">${item.Codigo} ${item.Talla !== 'Única' ? '| Talla: ' + item.Talla : ''}</span>
                        <span class="cart-item-subtitle">${item.Cantidad} x $${unitPrice.toFixed(2)}</span>
                    </div>
                    <div class="cart-item-actions">
                        <div class="qty-controls">
                            <button class="qty-btn" aria-label="Disminuir">-</button>
                            <span class="qty-val">${item.Cantidad}</span>
                            <button class="qty-btn" aria-label="Aumentar">+</button>
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

    // Nivel 3: Purchase Event (Detalle de productos para Facebook)
    const purchaseData = {
        value: total,
        currency: 'USD',
        content_type: 'product',
        content_ids: cart.map(item => item.Codigo),
        contents: cart.map(item => {
            const product = allProducts.find(p => p.Codigo === item.Codigo);
            return {
                id: item.Codigo,
                quantity: item.Cantidad,
                item_price: item.Precio,
                on_sale: product ? product.Tiene_Oferta : false
            };
        })
    };
    trackPixel('Purchase', purchaseData);

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
}

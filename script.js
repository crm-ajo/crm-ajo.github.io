document.addEventListener('DOMContentLoaded', () => {
    
    // 1. --- ЛОГИКА ВКЛАДОК ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // ⚠️ СЮДА ПОТОМ ВСТАВИМ ССЫЛКУ НОВОГО ВОРКЕРА ⚠️
    const WORKER_URL = 'https://crm-ajo.brelok2023.workers.dev'; // Пока старая для примера

    // 3. --- ЭЛЕМЕНТЫ ---
    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const sendButton = document.getElementById('sendOrderBtn');
    const statusMessage = document.getElementById('statusMessage');
    const totalSummaryEl = document.getElementById('totalSummary');
    const extraChargeInput = document.getElementById('extraCharge');
    
    // Ссылка
    const linkContainer = document.getElementById('orderLinkContainer');
    const linkInput = document.getElementById('generatedLink');
    const copyBtn = document.getElementById('copyLinkBtn');
    
    // Оплата
    const paymentOptionsContainer = document.querySelector('.radio-group');
    const customPrepaymentInput = document.getElementById('customPrepaymentAmount');
    const customPrepaymentRadio = document.getElementById('payment-custom');

    // 4. --- СЛУШАТЕЛИ (ИСПРАВЛЕННЫЕ) ---
    function setupEventListeners() {
        
        // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Слушаем изменение галочки
        productList.addEventListener('change', (e) => {
            if (e.target.classList.contains('product-checkbox')) {
                const item = e.target.closest('.product-item');
                updateItemState(item);
                updateTotalSummary();
            }
        });

        // Слушаем ввод количества (пересчет цены)
        productList.addEventListener('input', (e) => {
            if (e.target.classList.contains('qty-input')) updateTotalSummary();
        });
        
        extraChargeInput.addEventListener('input', updateTotalSummary);
        
        // Логика оплаты (радиокнопки)
        paymentOptionsContainer.addEventListener('change', (e) => {
            if (e.target.name === 'payment') {
                if (customPrepaymentRadio.checked) {
                    customPrepaymentInput.disabled = false;
                    customPrepaymentInput.focus();
                } else {
                    customPrepaymentInput.disabled = true;
                    customPrepaymentInput.value = '';
                }
            }
        });

        // Кнопка копирования ссылки
        if(copyBtn) {
            copyBtn.addEventListener('click', () => {
                if(!linkInput.value) return;
                linkInput.select();
                navigator.clipboard.writeText(linkInput.value);
                document.getElementById('copyFeedback').style.display = 'block';
                setTimeout(() => document.getElementById('copyFeedback').style.display = 'none', 2000);
            });
        }
    }

    // Красит рамочку и включает поле количества
    function updateItemState(item) {
        const checkbox = item.querySelector('.product-checkbox');
        const qtyInput = item.querySelector('.qty-input');
        
        if (checkbox.checked) {
            item.classList.add('selected');
            qtyInput.disabled = false;
            // Если там пусто или 0, ставим 1
            if (qtyInput.value == "" || qtyInput.value == "0") {
                qtyInput.value = "1";
            }
        } else {
            item.classList.remove('selected');
            qtyInput.disabled = true;
            qtyInput.value = '1'; // Сброс
        }
    }

    function updateTotalSummary() {
        let total = 0;
        let hasItems = false;
        
        document.querySelectorAll('.product-item.selected').forEach(item => {
            const price = parseFloat(item.dataset.price);
            const qty = parseInt(item.querySelector('.qty-input').value) || 1;
            total += (price * qty);
            hasItems = true;
        });
        
        total += parseFloat(extraChargeInput.value) || 0;
        totalSummaryEl.textContent = `Загальна Сума: ${total.toFixed(2)} грн`;
        
        // Кнопку включаем только если что-то выбрали
        sendButton.disabled = !hasItems;
    }

    // --- ОТПРАВКА ---
    async function submitForm(e) {
        e.preventDefault();
        linkContainer.style.display = 'none';
        
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        
        const clientFacebook = document.getElementById('clientFacebook').value.trim();
        const isUrgent = document.getElementById('markRed').checked;
        const comment = document.getElementById('orderComment').value;

        // СБОР ТОВАРОВ
        let selectedItems = [];
        
        document.querySelectorAll('.product-item.selected').forEach(item => {
            const name = item.dataset.name; 
            const qty = item.querySelector('.qty-input').value;
            
            if (qty > 1) {
                selectedItems.push(`${name} (x${qty})`);
            } else {
                selectedItems.push(name);
            }
        });

        const allItemsString = selectedItems.join(' + ');

        const paymentMethodRadio = document.querySelector('input[name="payment"]:checked');
        let prepayment = 0;
        const totalAmount = parseFloat(totalSummaryEl.textContent.match(/[\d\.]+/)[0]);

        if (paymentMethodRadio.id === 'payment-prepay150') prepayment = 150;
        else if (paymentMethodRadio.id === 'payment-prepay250') prepayment = 250;
        else if (paymentMethodRadio.id === 'payment-full') prepayment = totalAmount;
        else if (paymentMethodRadio.id === 'payment-custom') prepayment = parseFloat(customPrepaymentInput.value) || 0;

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        const payload = {
            order_id: orderId,
            Ник: clientFacebook,
            fb_id: "", 
            isUrgent: isUrgent,
            Заказ_жетон: allItemsString, 
            Доп_товары: "", 
            Предоплата: prepayment,
            extraCharge: parseFloat(extraChargeInput.value) || 0,
            comment: comment
        };

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                statusMessage.textContent = `✅ Заказ ${orderId} створено!`;
                statusMessage.style.color = '#007bff';
                
                form.reset();
                // Сбрасываем визуальное выделение
                document.querySelectorAll('.product-item').forEach(item => {
                    item.querySelector('.product-checkbox').checked = false;
                    updateItemState(item);
                });
                updateTotalSummary();

                setTimeout(() => {
                    // Сюда потом вставим твой новый сайт доставки
                    const fullLink = `https://dostavkagravochka.github.io/index.html?id=${orderId}`;
                    linkInput.value = "Заповніть дані доставки: " + fullLink;
                    linkContainer.style.display = 'block';
                }, 500);

            } else {
                alert('Помилка: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Помилка з\'єднання. Worker URL не настроен.');
        } finally {
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
        }
    }

    form.addEventListener('submit', submitForm);
    setupEventListeners();
});

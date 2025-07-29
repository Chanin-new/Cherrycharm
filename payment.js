// JavaScript สำหรับหน้า payment.html
document.addEventListener('DOMContentLoaded', function() {
    loadCartItems();
    setupPaymentForm();
});

function loadCartItems() {
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    const cartTableBody = document.getElementById('cart-items');
    const totalElement = document.getElementById('total-amount');
    
    if (!cartTableBody) return;
    
    let total = 0;
    
    cartTableBody.innerHTML = cartItems.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        return `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price.toLocaleString()} บาท</td>
                <td>${itemTotal.toLocaleString()} บาท</td>
            </tr>
        `;
    }).join('');
    
    if (totalElement) {
        totalElement.textContent = `${total.toLocaleString()} บาท`;
    }
}

function setupPaymentForm() {
    const paymentForm = document.getElementById('payment-form');
    
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(paymentForm);
            const orderData = {
                customerName: formData.get('customerName'),
                customerPhone: formData.get('customerPhone'),
                customerEmail: formData.get('customerEmail'),
                shippingAddress: formData.get('shippingAddress'),
                paymentMethod: formData.get('paymentMethod')
            };
            
            try {
                const order = await submitOrder(orderData);
                
                // เก็บข้อมูลคำสั่งซื้อสำหรับหน้า confirm
                localStorage.setItem('lastOrder', JSON.stringify(order));
                
                // ไปยังหน้า confirm
                window.location.href = 'confirm.html';
                
            } catch (error) {
                alert('เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
            }
        });
    }
}
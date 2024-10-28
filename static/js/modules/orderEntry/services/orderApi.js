// static/js/modules/orderEntry/services/orderApi.js
var OrderAPI = (function() {
    var baseUrl = '/api/orders';
    var csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    function placeOrder(orderData) {
        return fetch(baseUrl + '/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(orderData)
        })
        .then(handleResponse)
        .catch(handleError);
    }

    function modifyOrder(orderId, modifications) {
        return fetch(baseUrl + '/modify/' + orderId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(modifications)
        })
        .then(handleResponse)
        .catch(handleError);
    }

    function cancelOrder(orderId) {
        return fetch(baseUrl + '/cancel/' + orderId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
        .then(handleResponse)
        .catch(handleError);
    }

    function handleResponse(response) {
        if (!response.ok) {
            return response.json().then(function(data) {
                throw new Error(data.message || 'Server error');
            });
        }
        return response.json();
    }

    function handleError(error) {
        console.error('API Error:', error);
        throw error;
    }

    return {
        placeOrder: placeOrder,
        modifyOrder: modifyOrder,
        cancelOrder: cancelOrder
    };
})();
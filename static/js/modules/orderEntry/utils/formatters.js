// static/js/modules/orderEntry/utils/formatters.js
var OrderFormatters = (function() {
    function formatPrice(price) {
        if (!price || isNaN(price)) return '0.00';
        return parseFloat(price).toFixed(2);
    }

    function formatQuantity(quantity) {
        if (!quantity || isNaN(quantity)) return '0';
        return parseInt(quantity).toString();
    }

    function formatPriceChange(change, changePercent) {
        if (!change || isNaN(change)) return '';
        
        var formattedChange = parseFloat(change).toFixed(2);
        var formattedPercent = parseFloat(changePercent).toFixed(2);
        var sign = change >= 0 ? '+' : '';
        
        return sign + formattedChange + ' (' + sign + formattedPercent + '%)';
    }

    function formatOrderParams(orderData) {
        return {
            variety: orderData.variety || 'NORMAL',
            tradingsymbol: orderData.tradingSymbol,
            symboltoken: orderData.symbolToken,
            transactiontype: orderData.side,
            exchange: orderData.exchange,
            ordertype: orderData.orderType,
            producttype: orderData.productType,
            duration: 'DAY',
            price: formatPrice(orderData.price),
            triggerprice: orderData.triggerPrice ? formatPrice(orderData.triggerPrice) : '0',
            quantity: formatQuantity(orderData.quantity)
        };
    }

    function formatDate(date) {
        if (!date) return '';
        var d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    }

    return {
        formatPrice: formatPrice,
        formatQuantity: formatQuantity,
        formatPriceChange: formatPriceChange,
        formatOrderParams: formatOrderParams,
        formatDate: formatDate
    };
})();
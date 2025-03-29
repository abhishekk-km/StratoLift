// Register custom gauge chart type
Chart.register({
    id: 'gauge',
    beforeInit: function(chart) {
        chart.legend.options.display = false;
    },
    beforeUpdate: function(chart) {
        const dataset = chart.data.datasets[0];
        const value = dataset.needleValue || 0;
        
        chart.options.rotation = Math.PI;
        chart.options.circumference = Math.PI;
    },
    afterDraw: function(chart) {
        const dataset = chart.data.datasets[0];
        const value = dataset.needleValue || 0;
        const ctx = chart.ctx;
        const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
        const centerY = chart.chartArea.bottom;
        const radius = Math.min(chart.chartArea.right - chart.chartArea.left, chart.chartArea.bottom - chart.chartArea.top) / 2;
        
        // Draw needle
        const needleLength = radius * 0.8;
        const needleRadius = radius * 0.02;
        const angle = Math.PI * (1 - value);
        
        const x = centerX + Math.cos(angle) * needleLength;
        const y = centerY - Math.sin(angle) * needleLength;
        
        ctx.save();
        
        // Draw needle circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, needleRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#444';
        ctx.fill();
        
        // Draw needle
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.lineWidth = needleRadius;
        ctx.strokeStyle = '#444';
        ctx.stroke();
        
        // Draw value label if enabled
        if (chart.options.valueLabel && chart.options.valueLabel.display) {
            const formatter = chart.options.valueLabel.formatter || (value => value.toString());
            const text = formatter(value);
            const fontSize = radius * 0.2;
            
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = chart.options.valueLabel.color || '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (chart.options.valueLabel.backgroundColor) {
                const textWidth = ctx.measureText(text).width;
                const padding = chart.options.valueLabel.padding || { top: 0, bottom: 0 };
                const paddingTop = padding.top || 0;
                const paddingBottom = padding.bottom || 0;
                const paddingLeft = padding.left || 5;
                const paddingRight = padding.right || 5;
                
                ctx.fillStyle = chart.options.valueLabel.backgroundColor;
                ctx.beginPath();
                ctx.roundRect(
                    centerX - textWidth / 2 - paddingLeft,
                    centerY + radius * 0.2 - fontSize / 2 - paddingTop,
                    textWidth + paddingLeft + paddingRight,
                    fontSize + paddingTop + paddingBottom,
                    chart.options.valueLabel.borderRadius || 0
                );
                ctx.fill();
                
                ctx.fillStyle = chart.options.valueLabel.color || '#000';
            }
            
            ctx.fillText(text, centerX, centerY + radius * 0.2);
        }
        
        ctx.restore();
    }
});

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
    };
}

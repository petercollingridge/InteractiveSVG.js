var InteractiveSVGCanvas = function(id) {
    this.svgElement = $('#' + id);
    this.selected = false;
    this._addMouseEventHandlers();
};

InteractiveSVGCanvas.prototype._addMouseEventHandlers = function() {
    var self = this;

    this.svgElement.on('mousemove', function(evt) {
        if (self.selected) {
            if (evt.type === 'touchmove') { evt = evt.touches[0]; }
            var x = parseFloat(self.selected.attr('cx')) + evt.clientX - self.dragX;
            var y = parseFloat(self.selected.attr('cy')) + evt.clientY - self.dragY;

            self.selected.attr('cx', x);
            self.selected.attr('cy', y);
            self.dragX = evt.clientX;
            self.dragY = evt.clientY;
        }
    });

    this.svgElement.on('mouseup', function() {
        self.selected = false;
    });
};

InteractiveSVGCanvas.prototype._startDrag = function(evt) {
    this.selected = $(evt.target);

    // Get dragging to work on touch device
    if (evt.type === 'touchstart') { evt = evt.touches[0]; }
    this.dragX = evt.clientX;
    this.dragY = evt.clientY;
};

InteractiveSVGCanvas.create = function(id) {
    return new InteractiveSVGCanvas(id);
};

InteractiveSVGCanvas.prototype.addElement = function(tagName, attr) {
    var $el = $(document.createElementNS('http://www.w3.org/2000/svg', tagName));
    $el.attr(attr);
    this.svgElement.append($el);
    return $el;
};

InteractiveSVGCanvas.prototype.addDraggablePoint = function(attr) {
    var defaultAttr = { r: 6, class: 'draggable-point' }
    $.extend(defaultAttr, attr);
    var $el = this.addElement('circle', defaultAttr);
    $el.on('mousedown', this._startDrag.bind(this));
};

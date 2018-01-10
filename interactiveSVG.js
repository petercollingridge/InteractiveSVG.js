var LineSegmentFromPoints = function(canvas, p1, p2) {
    this.canvas = canvas;
    this.p1 = p1;
    this.p2 = p2;

    var defaultAttr = { class: 'line-segment' }
    defaultAttr.x1 = p1.attr('cx');
    defaultAttr.y1 = p1.attr('cy');
    defaultAttr.x2 = p2.attr('cx');
    defaultAttr.y2 = p2.attr('cy');
    this.el = canvas.addElement('line', defaultAttr);
}

var InteractiveSVGCanvas = function(id) {
    this.svgElement = $('#' + id);
    this.selected = false;
    this._addMouseEventHandlers();
};

InteractiveSVGCanvas.prototype._addMouseEventHandlers = function() {
    var self = this;

    this.svgElement.on('mousemove', function(evt) {
        if (self.selected) {
            // Get dragging to work on touch device
            if (evt.type === 'touchmove') { evt = evt.touches[0]; }

            // Move based on change in mouse position
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
    return $el;
};

InteractiveSVGCanvas.prototype.addLineFromPoints = function(p1, p2, attr) {
    return LineSegmentFromPoints(this, p1, p2);
};


var InteractiveSVG = function($container, width, height) {
    this.$svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    this.$svg.attr({
        xmlns: "http://www.w3.org/2000/svg",
        width: width || 400,
        height: height || 400
    }).appendTo($container);

    this.selected = false;
    //this._addMouseEventHandlers();
};

InteractiveSVG.createFromJSON = function(data) {
    if (!data.id) {
        console.error("No id given");
        return;
    }

    var $container = $('#' + data.id);
    if (!$container) {
        console.error("No element found with id " + id);
        return;   
    }

    return new InteractiveSVG($container, data.width, data.height);
};
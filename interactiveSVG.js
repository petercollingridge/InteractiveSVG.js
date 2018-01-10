var xmlns = 'http://www.w3.org/2000/svg';

/*************************************************
 *      LineSegmentFromPoints
 *  A line between two draggable points
**************************************************/

var LineSegmentFromPoints = function(svgObject, p1, p2, attr) {
    this.$svg = svgObject.$svg;
    this.p1 = p1;
    this.p2 = p2;

    var defaultAttr = {
        class: 'line-segment',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y
    };

    this.$element = svgObject.addElement('line', defaultAttr);
}

/*************************************************
 *      DraggablePoint
 *  A point that can be dragged.
**************************************************/

var DraggablePoint = function(svgObject, x, y, attr) {
    this.$svg = svgObject.$svg;
    this.x = x || 0;
    this.y = y || 0;

    var defaultAttr = { cx: x, cy: y, r: 6, class: 'draggable-point' }
    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElement('circle', defaultAttr);

    // Add handler to allow dragging
    var self = this;
    this.$element.on('mousedown', function(evt) {
        svgObject.selected = self;

        // Get dragging to work on touch device
        if (evt.type === 'touchstart') { evt = evt.touches[0]; }
        svgObject.dragX = evt.clientX;
        svgObject.dragY = evt.clientY;
    });
};

DraggablePoint.prototype.move = function(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.$element.attr({ cx: this.x, cy: this.y });
};

/*************************************************
 *      InteractiveSVG
 *  Main object for the whole SVG.
**************************************************/

var InteractiveSVG = function($container, width, height) {
    this.$svg = $(document.createElementNS(xmlns, 'svg'));
    this.$svg.attr({
        xmlns: xmlns,
        width: width || 400,
        height: height || 400
    }).appendTo($container);

    this.points = {};
    this.lines = {};
    this.selected = false;
    this._addMouseEventHandlers();
};

InteractiveSVG.create = function(id, width, height) {
    var $container = $('#' + id);
    if (!$container) {
        console.error("No element found with id " + id);
        return;   
    }
    return new InteractiveSVG($container, width, height);
};

InteractiveSVG.createFromJSON = function(data) {
    if (!data.id) {
        console.error("No id given");
        return;
    }

    var svgObject = this.create(data.id, data.width, data.height);

    if (data.points) {
        for (var label in data.points) {
            svgObject.addPoint(label, data.points[label]);
        }
    }

    if (data.lines) {
        for (var label in data.lines) {
            svgObject.addLine(label, data.lines[label]);
        }
    }

    return svgObject;
};

InteractiveSVG.prototype._addMouseEventHandlers = function() {
    var self = this;

    this.$svg.on('mousemove', function(evt) {
        if (self.selected) {
            // Get dragging to work on touch device
            if (evt.type === 'touchmove') { evt = evt.touches[0]; }

            // Move based on change in mouse position
            var dx = evt.clientX - self.dragX;
            var dy = evt.clientY - self.dragY;
            self.selected.move(dx, dy);

            // Update mouse position
            self.dragX = evt.clientX;
            self.dragY = evt.clientY;
        }
    });

    this.$svg.on('mouseup', function() {
        self.selected = false;
    });
};

InteractiveSVG.prototype.addPoint = function(label, attr) {
    // Extract x and y coordinates from attr hash
    var x = attr.x;
    var y = attr.y;
    delete attr.x;
    delete attr.y;

    var point = new DraggablePoint(this, x, y, attr);
    this.points[label] = point;
    return point;
};

InteractiveSVG.prototype.addLine = function(label, attr) {
    // Extract x and y coordinates from attr hash
    var p1 = attr.p1;
    var p2 = attr.p2;
    delete attr.p1;
    delete attr.p2;

    if (typeof p1 === 'string') { p1 = this.points[p1]; }
    if (typeof p2 === 'string') { p2 = this.points[p2]; }

    var line = new LineSegmentFromPoints(this, p1, p2, attr);
    this.lines[label] = line;
    return line;
};

InteractiveSVG.prototype.addElement = function(tagName, attr) {
    return $(document.createElementNS(xmlns, tagName))
            .attr(attr)
            .appendTo(this.$svg);
};

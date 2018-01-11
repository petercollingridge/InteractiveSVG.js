var xmlns = 'http://www.w3.org/2000/svg';

function lineLineIntersection(line1, line2) {
    // Lines as vectors
    var dx1 = line1.p2.x - line1.p1.x;
    var dy1 = line1.p2.y - line1.p1.y;
    var dx2 = line2.p2.x - line2.p1.x;
    var dy2 = line2.p2.y - line2.p1.y;

    // Shift lines so line1.p1 is at 0
    var dx3 = line2.p1.x - line1.p1.x;
    var dy3 = line2.p1.y - line1.p1.y;
    
    var cross = dx2 * dy1 - dy2 * dx1;
    if (Math.abs(cross) < 1e-8) { return false; }

    // Find proportion along line 2
    var s = (dx1 * dy3 - dy1 * dx3) / cross;
    
    // Check point is on line 2
    if (s >= 0 && s <= 1) {
        // Find proportion along line 1
        var t = dx1 !== 0 ? (dx3 + dx2 * s) / dx1 : (dy3 + dy2 * s) / dy1;

        // Check point is on line 1
        if (t >= 0 && t <= 1) {
            // Return intersection
            return {
                x: line2.p1.x + dx2 * s,
                y: line2.p1.y + dy2 * s
            };
        }
    }
}

/*************************************************
 *      LineSegmentFromPoints
 *  A line between two draggable points
**************************************************/

var LineSegmentFromPoints = function(svgObject, label, p1, p2, attr) {
    this.$svg = svgObject.$svg;
    this.label = label;
    this.p1 = p1;
    this.p2 = p2;

    if (p1.dependents) { p1.dependents[label] = this; }
    if (p2.dependents) { p2.dependents[label] = this; }

    var defaultAttr = {
        class: 'line-segment',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y
    };

    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElementToBottom('line', defaultAttr);
}

// Updates the position of the line to end at the end points.
LineSegmentFromPoints.prototype.update = function() {
    this.$element.attr({
        x1: this.p1.x,
        y1: this.p1.y,
        x2: this.p2.x,
        y2: this.p2.y
    });

    if (this.onMove) { this.onMove(); }
};

/*************************************************
 *      DraggablePoint
 *  A point that can be dragged.
**************************************************/

var DraggablePoint = function(svgObject, label, x, y, attr) {
    this.$svg = svgObject.$svg;
    this.label = label;
    this.x = x || 0;
    this.y = y || 0;
    this.dependents = {};

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

    for (var element in this.dependents) {
        this.dependents[element].update();
    }
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
    this.$background = this._addBackground();
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

InteractiveSVG.prototype._addBackground = function() {
    return this.addElement('rect', {
        class: 'background',
        width: this.$svg.attr('width'),
        height: this.$svg.attr('height')
    });
};

InteractiveSVG.prototype.addPoint = function(label, attr) {
    // Extract x and y coordinates from attr hash
    var x = attr.x;
    var y = attr.y;
    delete attr.x;
    delete attr.y;

    var point = new DraggablePoint(this, label, x, y, attr);
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

    var line = new LineSegmentFromPoints(this, label, p1, p2, attr);
    this.lines[label] = line;
    return line;
};

InteractiveSVG.prototype.addElement = function(tagName, attr) {
    return $(document.createElementNS(xmlns, tagName))
            .attr(attr)
            .appendTo(this.$svg);
};

InteractiveSVG.prototype.addElementToBottom = function(tagName, attr) {
    return $(document.createElementNS(xmlns, tagName))
            .attr(attr)
            .insertAfter(this.$background);
};
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

function _setAsDraggable(self) {
    self.$element.on('mousedown', function(evt) {
        self.svg.selected = self;

        // Get dragging to work on touch device
        if (evt.type === 'touchstart') { evt = evt.touches[0]; }
        self.svg.dragX = evt.clientX;
        self.svg.dragY = evt.clientY;
    });
};

/*************************************************
 *      InteractivePoint
 *  An SVG circle which can be draggable.
**************************************************/

var InteractivePoint = function(svgObject, draggable, x, y, attr, label) {
    this.svg = svgObject
    this.label = label;
    this.x = x || 0;
    this.y = y || 0;

    var defaultAttr = { cx: x, cy: y }
    if (draggable) {
         defaultAttr.r = 6;
        defaultAttr.class = "point draggable-point";
    } else {
        defaultAttr.r = 3;
        defaultAttr.class = "point static-point";
    }

    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElement('circle', defaultAttr);
    
    if (draggable) {
        this.dependents = {};
        _setAsDraggable(this);
    }
};

InteractivePoint.prototype.move = function(dx, dy) {
    this.setPosition(this.x + dx, this.y + dy);
};

InteractivePoint.prototype.setPosition = function(x, y) {
    this.x = x;
    this.y = y;
    this.$element.attr({ cx: x, cy: y });

    for (var element in this.dependents) {
        this.dependents[element].update();
    }
};

/*************************************************
 *      LineSegmentFromPoints
 *  A line between two draggable points
**************************************************/

var LineSegmentFromPoints = function(svgObject, p1, p2, attr, label) {
    this.$svg = svgObject.$svg;
    this.label = label;
    this.p1 = p1;
    this.p2 = p2;

    // Make line position depend on end points
    if (p1.dependents) { p1.dependents[label] = this; }
    if (p2.dependents) { p2.dependents[label] = this; }

    var defaultAttr = {
        class: 'line controllable-line',
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
 *      DraggableCircle
 *  A circle which can be dragged by its center.
**************************************************/

var DraggableCircle = function(svgObject, center, attr, label) {
    this.$svg = svgObject.$svg;
    this.label = label;
    this.center = center;
    this.type = 'static';

    // Make circle position depend on center points
    if (center.dependents) {
        this.type = 'controllable';
        center.dependents[label] = this;
    }

    var defaultAttr = {
        class: "line " + this.type + "-line",
        r: 20,
        cx: center.x,
        cy: center.y,
    };

    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElementToBottom('circle', defaultAttr);
}

// Updates the position of the circle to encircle the center point.
DraggableCircle.prototype.update = function() {
    this.$element.attr({
        cx: this.center.x,
        cy: this.center.y,
    });

    if (this.onMove) { this.onMove(); }
};

/*************************************************
 *      InteractiveSVG
 *  Main object for the whole SVG.
**************************************************/

var InteractiveSVG = function($container, width, height) {
    this.$svg = $(document.createElementNS(xmlns, 'svg'));
    this.$svg.attr({
        xmlns: xmlns,
        class: 'interactiveSVG',
        width: width || 400,
        height: height || 400,
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
        for (var i = 0; i < data.points.length; i++) {
            svgObject.addPoint(data.points[i]);
        }
    }

    if (data.lines) {
        for (var i = 0; i < data.lines.length; i++) {
            svgObject.addLine(data.lines[i]);
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
            self.selected.move(
                evt.clientX - self.dragX,
                evt.clientY - self.dragY
            );

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

InteractiveSVG.prototype.addPoint = function(attr) {
    // Extract x and y coordinates from attr hash
    var x = attr.x || 0;
    var y = attr.y || 0;
    var label = attr.label;
    var static = attr.static;

    delete attr.x;
    delete attr.y;
    delete attr.label;
    delete attr.static;

    var point = new InteractivePoint(this, !static, x, y, attr, label);
    if (label) { this.points[label] = point; }
    return point;
};

InteractiveSVG.prototype.addStaticPoint = function(attr) {
    // Extract x and y coordinates from attr hash
    var x = attr.x || 0;
    var y = attr.y || 0;
    var label = attr.label;
    delete attr.x;
    delete attr.y;
    delete attr.label;

    var point = new InteractivePoint(this, false, x, y, attr, label);
    this.points[label] = point;
    return point;
};

InteractiveSVG.prototype.addLine = function(attr) {
    // Extract x and y coordinates from attr hash
    var p1 = attr.p1 || { x: 0, y: 0 };
    var p2 = attr.p2 || { x: 0, y: 0 };
    var label = attr.label;
    delete attr.p1;
    delete attr.p2;
    delete attr.label;

    if (typeof p1 === 'string') { p1 = this.points[p1]; }
    if (typeof p2 === 'string') { p2 = this.points[p2]; }

    var line = new LineSegmentFromPoints(this, p1, p2, attr, label);
    if (label) { this.lines[label] = line; }
    return line;
};

InteractiveSVG.prototype.addCircle = function(attr) {
    // Extract x and y coordinates from attr hash
    var center = attr.center || { x: 0, y: 0 };
    var label = attr.label;
    delete attr.center;
    delete attr.label;

    var circle = new DraggableCircle(this, center, attr, label);
    if (label) { this.lines[label] = circle; }
    return circle;
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
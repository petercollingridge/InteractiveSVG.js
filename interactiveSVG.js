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

function defineCircleFromThreePoints(p1, p2, p3) {
    var dx1 = p1.x - p2.x;
    var dy1 = p1.y - p2.y;
    var dx2 = p2.x - p3.x;
    var dy2 = p2.y - p3.y;

    var cross = dx2 * dy1 - dy2 * dx1;

    // If points are colinear(ish), we have a line.
    if (Math.abs(cross) < 0.01) {
        var d = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        // TODO: improve how points are picked
        dx1 *= 2000 / d;
        dy1 *= 2000 / d;
        
        return {
            p1: { x: p1.x + dx1, y: p1.y + dy1},
            p2: { x: p1.x - dx1, y: p1.y - dy1}
        };
    }

    // Mid-point coordinates
    var mx1 = (p1.x + p2.x) / 2;
    var my1 = (p1.y + p2.y) / 2;
    var mx2 = (p2.x + p3.x) / 2;
    var my2 = (p2.y + p3.y) / 2;

    // Find intersection of lines in terms of position along 2 bisector
    var s = (-dy1 * (my2 - my1) - dx1 * (mx2 - mx1)) / cross;

    // Center of circle is along the line from (mx2, my2) in the direction (dy2, dx2)
    var cx = mx2 - s * dy2;
    var cy = my2 + s * dx2;

    // Find radius
    var dx = cx - p1.x;
    var dy = cy - p1.y;
    var r = Math.sqrt(dx * dx + dy * dy);

    return {center: {x: cx, y: cy}, r: r};
}

/*************************************************
 *      InteractivePoint
 *  An SVG circle which can be draggable.
**************************************************/

var InteractivePoint = function(svgObject, attr) {
    this.svg = svgObject
    this.label = attr.label;
    this.x = attr.x || 0;
    this.y = attr.y || 0;
    var draggable = !attr.static;

    delete attr.x;
    delete attr.y;
    delete attr.label;
    delete attr.static;

    var defaultAttr = { cx: this.x, cy: this.y }
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
        svgObject._setAsDraggable(this);
    }

    if (this.label) { svgObject.points[this.label] = this; }
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

var LineSegmentFromPoints = function(svgObject, attr) {
    this.$svg = svgObject.$svg;
    this.label = attr.label;
    this.p1 = svgObject._getDependentPoint(this, attr, 'p1');
    this.p2 = svgObject._getDependentPoint(this, attr, 'p2');

    delete attr.p1;
    delete attr.p2;
    delete attr.label;

    var defaultAttr = {
        class: 'line controllable-line',
        x1: this.p1.x,
        y1: this.p1.y,
        x2: this.p2.x,
        y2: this.p2.y
    };

    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElementToBottom('line', defaultAttr);
    if (this.label) { svgObject.lines[this.label] = this; }
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

var DraggableCircle = function(svgObject, attr) {
    this.$svg = svgObject.$svg;
    this.label = attr.label;

    if (!attr.center && attr.x !== undefined && attr.y !== undefined) {
        attr.center = { x: attr.x, y: attr.y };
    }

    this.center = svgObject._getDependentPoint(this, attr, 'center');
    this.type = this.center.dependents ? 'controllable' : 'static';

    delete attr.center;
    delete attr.label;

    var defaultAttr = {
        class: "line " + this.type + "-line",
        r: 20,
        cx: this.center.x,
        cy: this.center.y,
    };

    $.extend(defaultAttr, attr);
    this.$element = svgObject.addElementToBottom('circle', defaultAttr);
    if (this.label) { svgObject.lines[this.label] = this; }
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
    this._addFromJSON(svgObject.addPoint.bind(svgObject), data.points);
    this._addFromJSON(svgObject.addLine.bind(svgObject), data.lines);
    this._addFromJSON(svgObject.addCircle.bind(svgObject), data.circles);

    return svgObject;
};

InteractiveSVG._addFromJSON = function(addFunction, arr) {
    if (arr) {
        for (var i = 0; i < arr.length; i++) {
            addFunction(arr[i]);
        }
    }
}

InteractiveSVG.prototype._addBackground = function() {
    return this.addElement('rect', {
        class: 'background',
        width: this.$svg.attr('width'),
        height: this.$svg.attr('height')
    });
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

InteractiveSVG.prototype._setAsDraggable = function(element) {
    var self = this;
    element.$element.on('mousedown', function(evt) {
        self.selected = element;

        // Get dragging to work on touch device
        if (evt.type === 'touchstart') { evt = evt.touches[0]; }
        self.dragX = evt.clientX;
        self.dragY = evt.clientY;
    });
}

InteractiveSVG.prototype._getElement = function(type, label) {
    var dictOfElements = this[type];

    if (dictOfElements) {
        var element = dictOfElements[label];
        if (element) {
            return element;
        } else {
            console.error("No such " + type + " element with name " + label);
        }
    } else {
        console.error("No such element type " + type);
    }
};

// Given an attribute dictionary, look up point with given name
// If the name is not a string, but an object, use that object for the point
InteractiveSVG.prototype._getDependentPoint = function(parent, attr, name) {
    var point = attr[name] || { x: 0, y: 0 };

    // If point is a label then look it up in the points dictioanry
    if (typeof point === 'string') { point = this._getElement('points', point); }

    // If point is now an InteractiveSVG object, then make the parent dependent on it
    if (point.dependents) {
        point.dependents[parent.label] = parent;
    }

    return point;
};

InteractiveSVG.prototype.addPoint = function(attr) {
    return new InteractivePoint(this, attr);
};

InteractiveSVG.prototype.addStaticPoint = function(attr) {
    attr.static = true;
    return new InteractivePoint(this, attr);
};

InteractiveSVG.prototype.addLine = function(attr) {
    return new LineSegmentFromPoints(this, attr);
};

InteractiveSVG.prototype.addCircle = function(attr) {
    return new DraggableCircle(this, attr);
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
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

    return {cx: cx, cy: cy, r: r};
}

/*************************************************
 *      SVG Element Object
 *  A object that wraps an SVG element.
**************************************************/

var SVGElement = function(svgObject, defaultAttr, attr) {
    this.svg = svgObject;

    // Called when the element is updated
    // Empty but can be overwritten
    this.onUpdate = function() {};

    // Array of object to update when this is updated
    this.dependents = [];

    this.label = attr.label;
    delete attr.label;

    // Create new SVG element
    $.extend(defaultAttr, attr);
    if (this.addBelow) {
        this.$element = svgObject.addElementToBottom(this.tagName, defaultAttr);
    } else {
        this.$element = svgObject.addElement(this.tagName, defaultAttr);
    }

    if (this.draggable) {
        svgObject._setAsDraggable(this);
    }

    if (this.label) { svgObject.elements[this.label] = this; }
};

// Update the object with new attributes
SVGElement.prototype.update = function(attr) {
    if (attr) { this.$element.attr(attr); }
    this._updateAttr(attr);

    for (var i = 0; i < this.dependents.length; i++) {
        this.dependents[i]();
    }

    this.onUpdate();
};

// Make this element dependent on another with an update function
SVGElement.prototype.addDependency = function(controlObjects, updateFunction) {
    this.svg.addDependency(this, controlObjects, updateFunction);
};

// Empty to be overwritten
SVGElement.prototype._updateAttr = function() {};

/*************************************************
 *      InteractivePoint
 *  An SVG circle which can be draggable.
**************************************************/

var InteractivePoint = function(svgObject, attr) {
    this.tagName = "circle";
    this.x = attr.x || 0;
    this.y = attr.y || 0;
    this.draggable = !attr.static;

    delete attr.x;
    delete attr.y;
    delete attr.static;

    var defaultAttr = {
        cx: this.x,
        cy: this.y,
        class: "point"
    };

    if (this.draggable) {
        defaultAttr.r = 6;
        defaultAttr.class += " draggable-point";
    } else {
        defaultAttr.r = 3;
        defaultAttr.class += " static-point";
    }

    SVGElement.call(this, svgObject, defaultAttr, attr);
};

InteractivePoint.prototype = Object.create(SVGElement.prototype);

InteractivePoint.prototype.move = function(dx, dy) {
    this.update({cx: this.x + dx, cy: this.y + dy });
};

// Updating the element's cx and cy attributes should update the object x and y attributes
SVGElement.prototype._updateAttr = function(attr) {
    if (attr.cx !== undefined) { this.x = attr.cx; }
    if (attr.cy !== undefined) { this.y = attr.cy; }
};

/*************************************************
 *      InteractiveLine
 *  A line between two draggable points
**************************************************/

var InteractiveLine = function(svgObject, attr) {
    this.tagName = "line";
    this.addBelow = true;
    this.p1 = svgObject._getPoint(attr, 'p1');
    this.p2 = svgObject._getPoint(attr, 'p2');

    var defaultAttr = { class: "line" };
    if ((this.p1 && this.p1.draggable) || (this.p2 && this.p2.draggable)) {
        defaultAttr.class += " controllable-line";
    } else {
        defaultAttr.class += " static-line";
    }
    
    SVGElement.call(this, svgObject, defaultAttr, attr);

    if (this.p1) {
        this.addDependency(this.p1, function(p) {
            return { x1: p.x, y1: p.y };
        });
    }

    if (this.p2) {
        this.addDependency(this.p2, function(p) {
            return { x2: p.x, y2: p.y };
        });
    }
};
InteractiveLine.prototype = Object.create(SVGElement.prototype);

/*************************************************
 *      InteractiveBezier
 *  A cubic Bezier path between two draggable points
 *  with two draggable control points.
**************************************************/

var InteractiveBezier = function(svgObject, attr) {
    this.tagName = "path";
    this.addBelow = true;
    this.p1 = svgObject._getPoint(attr, 'p1');
    this.p2 = svgObject._getPoint(attr, 'p2');
    this.p3 = svgObject._getPoint(attr, 'p3');
    
    if (attr.p4) { this.p4 = svgObject._getPoint(attr, 'p4'); }

    var defaultAttr = { class: 'line controllable-line' };
    SVGElement.call(this, svgObject, defaultAttr, attr);

    if (this.p4) {
        // Cubic bezier
        this.addDependency(
            [this.p1, this.p2, this.p3, this.p4],
            function(p1, p2, p3, p4) {
                var d = "M" + p1.x + " " + p1.y;
                d += "C" + p2.x + " " + p2.y;
                d += " " + p3.x + " " + p3.y;
                d += " " + p4.x + " " + p4.y;
                return { d: d };
        });
    } else {
        // Quadratic bezier
        this.addDependency(
            [this.p1, this.p2, this.p3],
            function(p1, p2, p3) {
                var d = "M" + p1.x + " " + p1.y;
                d += "S" + p2.x + " " + p2.y;
                d += " " + p3.x + " " + p3.y;
                return { d: d };
        });
    }
};
InteractiveBezier.prototype = Object.create(SVGElement.prototype);

/*************************************************
 *      InteractiveCircle
 *  A circle which can be dragged by its center.
**************************************************/

var InteractiveCircle = function(svgObject, attr) {
    this.tagName = 'circle';
    this.addBelow = true;

    // If center not defined by a center attribute it could defined by x and y attributes
    if (!attr.center && attr.x !== undefined && attr.y !== undefined) {
        attr.center = { x: attr.x, y: attr.y };
    }

    this.center = svgObject._getPoint(attr, 'center');
    if (!this.center) {
        this.center = { x: attr.cx || 0, y: attr.cy || 0 };
    }
    this.r = svgObject._getPoint(attr, 'r');
    
    this.type = (this.center.draggable || this.r.draggable) ? 'controllable' : 'static';
    var defaultAttr = { class: "line " + this.type + "-line" };

    SVGElement.call(this, svgObject, defaultAttr, attr);

    // Circle coordinates depend on its center point
    this.addDependency(this.center, function(center) {
        return { cx: center.x, cy: center.y };
    });

    // Radius can be a number or determined by a points
    if (isNaN(this.r)) {
        // Radius of the circle is dependent on point this.r
        this.addDependency(this.r, function(radiusPoint) {
            radiusPoint.dx = radiusPoint.x - this.center.x;
            radiusPoint.dy = radiusPoint.y - this.center.y;
            return { r: Math.sqrt(radiusPoint.dx * radiusPoint.dx + radiusPoint.dy * radiusPoint.dy) };
        });

        // Point this.r is dependent on this.center
        this.r.addDependency(this.center, function(center) {
            return { cx: center.x + this.dx, cy: center.y + this.dy };
        });
    } else {
        this.update({ r: this.r });
    }
};
InteractiveCircle.prototype = Object.create(SVGElement.prototype);

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

    this.elements = {};
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
};

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
};

InteractiveSVG.prototype.getElement = function(label) {
    // If label is a string then look it up in the points dictionary
    if (typeof label === 'string') {
        var element = this.elements[label];
        if (element) {
            return element;
        } else {
            console.error("No such element with name " + label);
        }
    } else {
        return label;
    }
};

// Given a label as a name in an attr hash return the point or a default
InteractiveSVG.prototype._getPoint = function(attr, name) {
    var label = attr[name];
    delete attr[name];
    return this.getElement(label);
};

// Make dependentObject depend on controlObjects, so when controlObjects is updated, 
// dependentObject is also updated, sending the result of the updateFunction
InteractiveSVG.prototype.addDependency = function(dependentObject, controlObjects, updateFunction) {
    var getElement = this.getElement.bind(this);
    dependentObject = getElement(dependentObject);

    // Ensure controlObject is an array of objects
    if (!Array.isArray(controlObjects)) {
        controlObjects = [getElement(controlObjects)];
    } else {
        controlObjects = controlObjects.map(function(element) {
            return getElement(element);
        });
    }

    var updateDependentObject = function() {
        dependentObject.update(updateFunction.apply(dependentObject, controlObjects));
    };

    // If point is an InteractiveSVG object, then make the parent dependent on it
    for (var i = 0; i < controlObjects.length; i++) {
        var dependentsArray = controlObjects[i].dependents;
        if (dependentsArray) {
            dependentsArray.push(updateDependentObject);
        }
    }

    updateDependentObject();
};

InteractiveSVG.prototype.addPoint = function(attr) {
    return new InteractivePoint(this, attr);
};

InteractiveSVG.prototype.addStaticPoint = function(attr) {
    attr.static = true;
    return new InteractivePoint(this, attr);
};

InteractiveSVG.prototype.addLine = function(attr) {
    if (Array.isArray(attr)) {
        var i, lines = [];
        for (i = 1; i < attr.length; i++) {
            lines.push(
                new InteractiveLine(this, { p1: attr[i - 1], p2: attr[i] })
            );
        }
        return lines;
    }

    return new InteractiveLine(this, attr);
};

InteractiveSVG.prototype.addBezier = function(attr) {
    return new InteractiveBezier(this, attr);
};

InteractiveSVG.prototype.addCircle = function(attr) {
    return new InteractiveCircle(this, attr);
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
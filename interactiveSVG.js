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

function findMidPoint(A, B){
    return { cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2 };
}

var InteractiveSVG = (function() {
    var xmlns = 'http://www.w3.org/2000/svg';

    /*************************************************
     *      SVG Element Object
     *  A object that wraps an SVG element.
    **************************************************/

    var SVGElement = function(svgObject, reservedAttributes, attributes) {
        this.svg = svgObject;

        // Called when the element is updated
        // Empty but can be overwritten
        this.onUpdate = function() {};

        // Array of object to update when this is updated
        this.dependents = [];

        // Set default attributes
        for (var i = 0; i < reservedAttributes.length; i++) {
            var attributeName = reservedAttributes[i];
            if (attributes[attributeName] !== undefined) {
                this[attributeName] = attributes[attributeName];
                delete attributes[attributeName];
            }
        }

        // Create new SVG element
        if (this.addBelow) {
            this.$element = svgObject.addElementToBottom(this.tagName, attributes);
        } else {
            this.$element = svgObject.addElement(this.tagName, attributes);
        }

        if (this.draggable) {
            svgObject._setAsDraggable(this);
        }

        if (this.label) { svgObject.elements[this.label] = this; }
    };

    // Update the object with new attributes
    SVGElement.prototype.update = function(attributes) {
        if (attributes) { this.$element.attr(attributes); }
        this._updateAttr(attributes);

        for (var i = 0; i < this.dependents.length; i++) {
            this.dependents[i]();
        }

        this.onUpdate();
    };

    // Make this element dependent on another with an update function
    SVGElement.prototype.addDependency = function(controlObjects, updateFunction) {
        this.svg.addDependency(this, controlObjects, updateFunction);
        return this;
    };

    // Empty to be overwritten
    SVGElement.prototype._updateAttr = function() {};

    SVGElement.prototype._setAttrIfNotYetSet = function(attributes) {
        var el = this.$element[0];
        for (var attributeName in attributes) {
            if (!el.hasAttribute(attributeName)) {
                this.$element.attr(attributeName, attributes[attributeName]);
            }
        }
    };

    /*************************************************
     *      InteractivePoint
     *  An SVG circle which can be draggable.
    **************************************************/

    var InteractivePoint = function(svgObject, attributes) {
        this.tagName = "circle";
        this.draggable = !attributes.static;
        var reservedAttributes = ['label', 'x', 'y', 'static'];
        
        SVGElement.call(this, svgObject, reservedAttributes, attributes);
     
        // Set attributes
        this._setAttrIfNotYetSet({
            'cx': this.x || 0,
            'cy': this.y || 0,
            'r': this.draggable ? 6 : 3,
            'class': this.draggable ? "draggable-point" : "static-point"
        });

        // Set classes
        this.$element.addClass("point");
    };

    InteractivePoint.prototype = Object.create(SVGElement.prototype);

    InteractivePoint.prototype.move = function(dx, dy) {
        this.update({ cx: this.x + dx, cy: this.y + dy });
    };

    // Updating the element's cx and cy attributes should update the object x and y attributes
    SVGElement.prototype._updateAttr = function(attributes) {
        if (attributes.cx !== undefined) { this.x = attributes.cx; }
        if (attributes.cy !== undefined) { this.y = attributes.cy; }
    };

    /*************************************************
     *      InteractiveLine
     *  A line between two draggable points
    **************************************************/

    var InteractiveLine = function(svgObject, attributes) {
        this.tagName = "line";
        this.addBelow = true;
        var reservedAttributes = ['label', 'p1', 'p2'];

        SVGElement.call(this, svgObject, reservedAttributes, attributes);

        // Create points
        if (this.p1) {
            this.p1 = svgObject.getElement(this.p1);
            this.addDependency(this.p1, function(p) {
                return { x1: p.x, y1: p.y };
            });
        }

        if (this.p2) {
            this.p2 = svgObject.getElement(this.p2);
            this.addDependency(this.p2, function(p) {
                return { x2: p.x, y2: p.y };
            });
        }

        // Set class
        var className = ((this.p1 && this.p1.draggable) || (this.p2 && this.p2.draggable)) ? "controllable-line" : "static-line";
        this._setAttrIfNotYetSet({ 'class': className });
        this.$element.addClass("line");
    };
    InteractiveLine.prototype = Object.create(SVGElement.prototype);

    /*************************************************
     *      InteractiveBezier
     *  A cubic Bezier path between two draggable points
     *  with two draggable control points.
    **************************************************/

    var InteractiveBezier = function(svgObject, attributes) {
        this.tagName = "path";
        this.addBelow = true;
        var reservedAttributes = ['label', 'p1', 'p2', 'p3', 'p4', 'showHandles'];

        SVGElement.call(this, svgObject, reservedAttributes, attributes);
        
        this.p1 = svgObject.getElement(this.p1);
        this.p2 = svgObject.getElement(this.p2);
        this.p3 = svgObject.getElement(this.p3);
        this.p4 = svgObject.getElement(this.p4);

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

            if (this.showHandles) {
                svgObject.addLine({ p1: this.p1, p2: this.p2, class: "line static-line" });
                svgObject.addLine({ p1: this.p3, p2: this.p4, class: "line static-line" });
            }
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

            if (this.showHandles) {
                svgObject.addLine({ p1: this.p1, p2: this.p2, class: "line static-line" });
                svgObject.addLine({ p1: this.p2, p2: this.p3, class: "line static-line" });
            }
        }

        this.$element.addClass("line");
        this.$element.addClass("controllable-line");
    };
    InteractiveBezier.prototype = Object.create(SVGElement.prototype);

    /*************************************************
     *      InteractiveCircle
     *  A circle which can be dragged by its center.
    **************************************************/

    var InteractiveCircle = function(svgObject, attributes) {
        this.tagName = 'circle';
        this.addBelow = true;
        var reservedAttributes = ['label', 'x', 'y', 'center', 'r'];

        SVGElement.call(this, svgObject, reservedAttributes, attributes);

        // Center can be defined by a center attribute, (x, y) attributes or (cx, cy) attributes
        if (this.center) {
            this.center = svgObject.getElement(this.center);
        } else if (this.x !== undefined && this.y !== undefined) {
            this.center = { x: this.x, y: this.y };
        } else {
            this.center = { x: attributes.cx || 0, y: attributes.cy || 0 };
        }

        // Circle coordinates depend on its center point
        this.addDependency(this.center, function(center) {
            return { cx: center.x, cy: center.y };
        });

        // Radius can be a number or determined by a points
        if (isNaN(this.r)) {
            this.r = svgObject.getElement(this.r);

            // Radius of the circle is dependent on point this.r
            this.addDependency(this.r, function(radiusPoint) {
                radiusPoint.dx = radiusPoint.x - this.center.x;
                radiusPoint.dy = radiusPoint.y - this.center.y;
                return { r: Math.sqrt(radiusPoint.dx * radiusPoint.dx + radiusPoint.dy * radiusPoint.dy) };
            });

            // Move the radius point when the center is moved
            this.r.addDependency(this.center, function(center) {
                return { cx: center.x + this.dx, cy: center.y + this.dy };
            });
        } else {
            this.update({ r: this.r });
        }

        // Set classes
        var className = (this.center.draggable || this.r.draggable) ? 'controllable-line' : 'static-line';
        this._setAttrIfNotYetSet({ 'class': className });
        this.$element.addClass("line");
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

    InteractiveSVG.prototype.addPoint = function(attributes) {
        return new InteractivePoint(this, attributes);
    };

    InteractiveSVG.prototype.addStaticPoint = function(attributes) {
        attributes.static = true;
        return new InteractivePoint(this, attributes);
    };

    InteractiveSVG.prototype.addMidPoint = function(point1, point2) {
        point1 = this.getElement(point1);
        point2 = this.getElement(point2);

        return this.addPoint({
            r: 4, static: true, class: 'generated-point'
        }).addDependency([point1, point2], findMidPoint);
    };

    InteractiveSVG.prototype.addLine = function(attributes) {
        if (Array.isArray(attributes)) {
            var i, lines = [];
            for (i = 1; i < attributes.length; i++) {
                lines.push(
                    new InteractiveLine(this, { p1: attributes[i - 1], p2: attributes[i] })
                );
            }
            return lines;
        }

        return new InteractiveLine(this, attributes);
    };

    InteractiveSVG.prototype.addBezier = function(attributes, attr2) {
        if (Array.isArray(attributes)) {
            var i, newAttr = attr2 || {};
            for (i = 0; i < attributes.length; i++) {
                newAttr['p' + (i + 1)] = attributes[i];
            }
            attributes = newAttr;
        }
        return new InteractiveBezier(this, attributes);
    };

    InteractiveSVG.prototype.addCircle = function(attributes) {
        return new InteractiveCircle(this, attributes);
    };

    InteractiveSVG.prototype.addElement = function(tagName, attributes) {
        return $(document.createElementNS(xmlns, tagName))
                .attr(attributes)
                .appendTo(this.$svg);
    };

    InteractiveSVG.prototype.addElementToBottom = function(tagName, attributes) {
        return $(document.createElementNS(xmlns, tagName))
                .attr(attributes)
                .insertAfter(this.$background);
    };

    return InteractiveSVG;
})()
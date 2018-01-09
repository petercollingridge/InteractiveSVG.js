var InteractiveSVGCanvas = function(id) {
    this.svgElement = $('#' + id);
};

InteractiveSVGCanvas.create = function(id) {
    return new InteractiveSVGCanvas(id);
};

InteractiveSVGCanvas.prototype.addDraggablePoint = function(attr) {
    var $point = $(document.createElementNS('http://www.w3.org/2000/svg', 'circle'));
    var defaultAttr = { r: 6, class: 'draggable-point' }
    $.extend(defaultAttr, attr);
    $point.attr(defaultAttr);
    this.svgElement.append($point);
}

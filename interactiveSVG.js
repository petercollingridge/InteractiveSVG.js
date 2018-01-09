var InteractiveSVGCanvas = function(id) {
    this.svgElement = $('#' + id);
};

InteractiveSVGCanvas.create = function(id) {
    return new InteractiveSVGCanvas(id);
};

InteractiveSVGCanvas.prototype.addDraggablePoint = function(attr) {
    var $point = $(document.createElementNS('http://www.w3.org/2000/svg', 'circle'));
    $.extend(attr, { class: 'draggable-point' })
    $point.attr(attr);
    this.svgElement.append($point);
}

function createInteractiveCanvas(id) {
    $svg = InteractiveSVGCanvas.create(id);
    $svg.addDraggablePoint({ cx: 100, cy: 150, r: 6 });
}
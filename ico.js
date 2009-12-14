"use strict";
var Ico = {
  Base: {},

  Normaliser: {},

  SparkLine: {},
  SparkBar: {},

  BaseGraph: {},
  LineGraph: {},
  AreaGraph: {},
  StackGraph: {},
  BarGraph: {},
  HorizontalBarGraph: {}
};

/* Supporting methods to make dealing with arrays easier */
/* Note that some of this work to reduce framework dependencies */
Array.prototype.sum = function () {
  for (var i = 0, sum = 0; i < this.length; sum += this[i++]) {}
  return sum;
};

if (typeof Array.prototype.max === 'undefined') {
  Array.prototype.max = function () {
    return Math.max.apply({}, this);
  };
}

if (typeof Array.prototype.min === 'undefined') {
  Array.prototype.min = function () {
    return Math.min.apply({}, this);
  };
}

Array.prototype.mean = function () {
  return this.sum() / this.length;
};

Array.prototype.variance = function () {
  var mean = this.mean(),
      variance = 0;
  for (var i = 0; i < this.length; i++) {
    variance += Math.pow(this[i] - mean, 2);
  }
  return variance / (this.length - 1);
};

Array.prototype.standard_deviation = function () {
  return Math.sqrt(this.variance());
};

Ico.Normaliser = Class.create({
  initialize: function (data, options) {
    this.options = {
      start_value: null
    };
    Object.extend(this.options, options || { });

    this.min = data.min();
    this.max = data.max();
    this.standard_deviation = data.standard_deviation();
    this.range = 0;
    this.step = this.labelStep(this.max - this.min);
    this.start_value = this.calculateStart();
    this.process();
  },

  calculateStart: function () {
    var min = this.options.start_value !== null && this.min >= 0 ? this.options.start_value : this.min,
        start_value = this.round(min, 1);

    /* This is a boundary condition */
    if (this.min > 0 && start_value > this.min) {
      return 0;
    }
    return start_value;
  },

  /* Given a value, this method rounds it to the nearest good value for an origin */
  round: function (value, offset) {
    var roundedValue = value,
        multiplier;
        offset = offset || 1;


    if (this.standard_deviation > 0.1) {
      multiplier = Math.pow(10, -offset);
      roundedValue = Math.round(value * multiplier) / multiplier;

      if (roundedValue > this.min) {
        return this.round(value - this.step);
      }
    }
    return roundedValue;
  },

  process: function () {
    this.range = this.max - this.start_value;
    this.step = this.labelStep(this.range);
    if (this.range / this.step > 15) {
      this.step *= 3;
    }
  },

  labelStep: function (value) {
    return Math.pow(10, (Math.log(value) / Math.LN10).round() - 1);
  }
});

Ico.Base = Class.create({
  normaliseData: function (data) {
    return $A(data).collect(function (value) {
      return this.normalise(value);
    }.bind(this));
  },
  deepCopy: function (obj) {
    var out, i, len;
    if (Object.prototype.toString.call(obj) === '[object Array]') {
        out = [];
        i = 0;
        len = obj.length;
        for (; i < len; i++) {
            out[i] = arguments.callee(obj[i]);
        }
        return out;
    }
    if (typeof obj === 'object') {
        out = {};
        for (i in obj) {
            out[i] = arguments.callee(obj[i]);
        }
        return out;
    }
    return obj;
  }
});



Ico.BaseGraph = Class.create(Ico.Base, {
  initialize: function (element, data, options) {
    this.element = element;
    this.data_sets = Object.isArray(data) ? new Hash({ one: data }) : $H(data);
    if (this.chartDefaults().stacked === true) {
      this.real_data = this.deepCopy(this.data_sets);
      this.stackData(this.data_sets);
    }
    this.flat_data = this.data_sets.collect(function (data_set) {return data_set[1]; }).flatten();
    this.normaliser = new Ico.Normaliser(this.flat_data, this.normaliserOptions());
    this.label_step = this.normaliser.step;
    this.range = this.normaliser.range;
    this.start_value = this.normaliser.start_value;
    this.data_size = this.longestDataSetLength();


    /* If one colour is specified, map it to a compatible set */
    if (options && options.colour) {
      options.colours = {};
      this.data_sets.keys().each(function (key) {
        options.colours[key] = options.colour;
      });
    }

    this.options = {
      width:                  parseInt(element.getStyle('width'), 10),
      height:                 parseInt(element.getStyle('height'), 10),
      labels:                 $A($R(1, this.data_size)),            // Label data
      plot_padding:           10,                                   // Padding for the graph line/bar plots
      font_size:              10,                                   // Label font size
      show_horizontal_labels: true,
      show_vertical_labels:   true,
      vertical_label_unit:    false,
      colours:                this.makeRandomColours(),             // Line colours
      background_colour:      element.getStyle('backgroundColor'),
      label_colour:           '#000',                               // Label text colour
      grid_colour:            '#ccc',                               // Grid line colour
      markers:                false,                                // false, circle
      marker_size:            5,
      meanline:               false,
      y_padding_top:          20,
      draw_axis:              true,
      stacked_fill:           false,                                 // if true, show stacked lines instead of area's
      datalabels:             '',                                    // interactive, filled with same # of elements as graph items.
      start_at_zero:          true,                                  // allow line graphs to start at a non-zero horizontal step
      bargraph_lastcolour:    false,                                 // different colour for first value in horizontal graph
      hover_colour:           '',                                    // hover color if there are datalabels
      watermark:              false,
      watermark_orientation:  false,                                 // determine position of watermark. default is bottomright. currenty available is bottomright and middle
      horizontal_rounded:     false,                                 // show rounded endings on horizontal bar charts if true
      hide_empty_label_grid:  false,                                 // hide gridlines for labels with no value
      left_padding:           false                                  // set a standard leftpadding regardless of label width
    };
    Object.extend(this.options, this.chartDefaults() || { });
    Object.extend(this.options, options || { });

    /* Padding around the graph area to make room for labels */
    this.x_padding_left = 10 + this.paddingLeftOffset();
    this.x_padding_left += this.options.vertical_label_unit ? 6 : 0;
    this.x_padding_left = this.options.left_padding ? this.options.left_padding : this.x_padding_left;
    this.x_padding_right = 20;
    this.x_padding = this.x_padding_left + this.x_padding_right;
    this.y_padding_top = this.options.y_padding_top;
    this.y_padding_bottom = 20 + this.paddingBottomOffset();
    this.y_padding = this.y_padding_top + this.y_padding_bottom;

    this.graph_width = this.options.width - this.x_padding;
    this.graph_height = this.options.height - this.y_padding;

    this.step = this.calculateStep();

    /* Calculate how many labels are required */
    this.y_label_count = (this.range / this.label_step).round();
    if ((this.normaliser.min + (this.y_label_count * this.normaliser.step)) < this.normaliser.max) {
      this.y_label_count += 1;
    }

    this.value_labels = this.makeValueLabels(this.y_label_count);
    this.top_value = this.value_labels.last();

    /* Grid control options */
    this.grid_start_offset = -1;

    /* Drawing */
    this.paper = new Raphael(this.element, this.options.width, this.options.height);
    this.background = this.paper.rect(this.x_padding_left, this.y_padding_top, this.graph_width, this.graph_height);
    this.background.attr({fill: this.options.background_colour, stroke: 'none' });

    if (this.options.meanline === true) {
      this.options.meanline = { 'stroke-width': '2px', stroke: '#BBBBBB' };
    }
    /* global hoverSet */
    this.globalHoverSet = this.paper.set();
    this.globalBlockSet = this.paper.set();

    this.setChartSpecificOptions();
    this.draw();
    this.globalHoverSet.toFront();
    this.globalBlockSet.toFront();
  },

  normaliserOptions: function () {
    return {graph_height : parseInt(this.element.getStyle('height'), 10)};
  },

  chartDefaults: function () {
    /* Define in child class */
  },

  drawPlot: function (index, cursor, x, y, colour, datalabel, element) {
    /* Define in child class */
  },
  calculateStep: function () {
    /* Define in child classes */
  },
  getMousePos: function (e) {
    var posx = 0,
        posy = 0,
        mousepos;
    if (!e) {e = window.event; }
    if (e.pageX || e.pageY)   {
      posx = e.pageX;
      posy = e.pageY;
    }
    else if (e.clientX || e.clientY)   {
      posx = e.clientX + document.body.scrollLeft - document.documentElement.scrollLeft;
      posy = e.clientY + document.body.scrollTop - document.documentElement.scrollTop;
    }
    mousepos = {x : posx , y : posy};
    return mousepos;
  },
  makeRandomColours: function (number) {
    var colours = {};
    this.data_sets.each(function (data) {
      colours[data[0]] = Raphael.hsb2rgb(Math.random(), 1, 0.75).hex;
    });
    return colours;
  },

  longestDataSetLength: function () {
    var length = 0;
    this.data_sets.each(function (data_set) {
      length = data_set[1].length > length ? data_set[1].length : length;
    });
    return length;
  },

  roundValue: function (value, length) {
    var multiplier = Math.pow(10, length);
    value *= multiplier;
    value = Math.round(value) / multiplier;
    return value;
  },

  roundValues: function (data, length) {
    return $A(data).collect(function (value) { return this.roundValue(value, length); }.bind(this));
  },

  paddingLeftOffset: function () {
    if (this.options.show_vertical_labels) {
      /* Find the longest label and multiply it by the font size */
      var data = this.flat_data,
          longest_label_length;

      // Round values
      data = this.roundValues(data, 2);

      longest_label_length = $A(data).sort(function (a, b) { return a.toString().length < b.toString().length; }).first().toString().length;
      longest_label_length = longest_label_length > 2 ? longest_label_length - 1 : longest_label_length;
      return longest_label_length * this.options.font_size;
    } else {
      return 0;
    }
  },

  paddingBottomOffset: function () {
    /* height of the text */
    return this.options.font_size;
  },

  normalise: function (value) {
    var total = this.start_value === 0 ? this.top_value : this.range;
    return ((value / total) * this.graph_height);
  },

  draw: function () {
    if (this.options.grid) {
      this.drawGrid();
    }
    if (this.options.watermark) {
      this.drawWatermark();
    }
    if (this.options.meanline) {
      this.drawMeanLine(this.normaliseData(this.flat_data));
    }

    if (this.options.draw_axis) {
      this.drawAxis();
    }

    if (this.options.show_vertical_labels) {
      this.drawVerticalLabels();
    }

    if (this.options.show_horizontal_labels) {
      this.drawHorizontalLabels();
    }

    if (!this.options.watermark) {
        this.drawLinesInit(this);
    }

    if (this.start_value !== 0) {
      this.drawFocusHint();
    }
  },
  drawLinesInit: function (thisgraph) {

    thisgraph.data_sets.each(function (data, index) {
      thisgraph.drawLines(data[0], thisgraph.options.colours[data[0]], thisgraph.normaliseData(data[1]), thisgraph.options.datalabels[data[0]], thisgraph.element,index);
    }.bind(thisgraph));
  },
  drawWatermark: function () {
    var watermark = this.options.watermark,
        watermarkimg = new Image(),
        thisgraph = this;
    watermarkimg.onload = function (){
      var right, bottom, image;
      if (thisgraph.options.watermark_orientation === "middle") {
          right = (thisgraph.graph_width - watermarkimg.width)/2 + thisgraph.x_padding_left;
          bottom = (thisgraph.graph_height - watermarkimg.height)/2 + thisgraph.y_padding_top;
      } else {
        right = thisgraph.graph_width - watermarkimg.width + thisgraph.x_padding_left - 2;
        bottom = thisgraph.graph_height - watermarkimg.height + thisgraph.y_padding_top - 2;
      }
      image = thisgraph.paper.image(watermarkimg.src, right, bottom, watermarkimg.width, watermarkimg.height).attr({'opacity': '0.4'});

      thisgraph.drawLinesInit(thisgraph, thisgraph.data);

      if (thisgraph.options.stacked_fill) {
        image.toFront();
      }
    };
    watermarkimg.src = watermark.src || watermark;
  },
  drawGrid: function () {
    var path = this.paper.path().attr({ stroke: this.options.grid_colour}),
        y, x, x_labels;

    if (this.options.show_vertical_labels) {
      y = this.graph_height + this.y_padding_top;
      for (var i = 0; i < this.y_label_count+1; i++) {
        if ((this.options.horizontalbar_grid && i === this.y_label_count)|| !this.options.horizontalbar_grid) {
          path.moveTo(this.x_padding_left-0.5, parseInt(y, 10)+0.5);
          path.lineTo(this.x_padding_left + this.graph_width-0.5, parseInt(y, 10)+0.5);
        }
        y = y - (this.graph_height / this.y_label_count);
      }
    }

    if (this.options.show_horizontal_labels) {
      x = this.x_padding_left + this.options.plot_padding + this.grid_start_offset;
      x_labels = this.options.labels.length;

      if (!this.bar_padding) {
        for (var i = 0; i < x_labels; i++) {
          if ((this.options.hide_empty_label_grid === true && this.options.labels[i] !== "") || this.options.hide_empty_label_grid === false) {
            path.moveTo(parseInt(x, 10), this.y_padding_top);
            path.lineTo(parseInt(x, 10), this.y_padding_top + this.graph_height);
          }
          x = this.options.horizontalbar_grid ? x+(this.graph_width / this.y_label_count) : x + this.step;
        }
      }
      if (this.bar_padding) {
          //left side
          path.moveTo(parseInt(this.x_padding_left, 10)-0.5, this.y_padding_top);
          path.lineTo(parseInt(this.x_padding_left, 10)-0.5, this.y_padding_top + this.graph_height);
          //right side
          path.moveTo(parseInt(this.x_padding_left + this.graph_width, 10)-0.5, this.y_padding_top);
          path.lineTo(parseInt(this.x_padding_left + this.graph_width, 10)-0.5, this.y_padding_top + this.graph_height);
      }
    }
  },

  drawLines: function (label, colour, data, datalabel, element,graphindex) {
    var coords = this.calculateCoords(data),
        y_offset = (this.graph_height + this.y_padding_top),
        cursor,
        odd_horizontal_offset,
        rel_opacity;

    if (this.options.start_at_zero === false) {
      odd_horizontal_offset=0;
      $A(coords).each(function (coord, index) {
        if (coord[1] === y_offset) {odd_horizontal_offset++;}
      });
      this.options.odd_horizontal_offset = odd_horizontal_offset;

      if (this.options.odd_horizontal_offset > 1) {
        coords.splice(0,this.options.odd_horizontal_offset);
      }
    }

    if (this.options.stacked_fill||this.options.area) {
      if (this.options.area) {
        rel_opacity = this.data_sets.collect(function (data_set){return data_set.length;}).length;
        cursor = this.paper.path().attr({stroke: colour, fill: colour, 'stroke-width': '0', 'fill-opacity':1.5/rel_opacity});
      } else {
        cursor = this.paper.path().attr({stroke: colour, fill: colour, 'stroke-width': '0'});
      }
      coords.unshift([coords[0][0],y_offset]);
      coords.push([coords[coords.length-1][0],y_offset]);
    } else {
      cursor = this.paper.path().attr({stroke: colour, 'stroke-width': '5px'});
    }

    if (this.options.datalabels) {
      var colorattr = (this.options.stacked_fill||this.options.area) ? "fill" : "stroke",
          hover_colour = this.options.hover_colour|| colour;

      var hoverSet = this.paper.set(),
          textpadding = 4,
          text = this.paper.text(cursor.attrs.x, cursor.attrs.y-(this.options.font_size*1.5)-textpadding, datalabel);
      text.attr({'font-size': this.options.font_size, fill:this.options.background_colour,opacity: 1});

      var textbox = text.getBBox(),
          roundRect= this.paper.rect(
            text.attrs.x-(textbox.width/2)-textpadding,
            text.attrs.y-(textbox.height/2)-textpadding,
            textbox.width+(textpadding*2),
            textbox.height+(textpadding*2),
            textpadding*1.5);
      roundRect.attr({fill: this.options.label_colour,opacity: 1});

      text.toFront();
      hoverSet.push(roundRect,text).attr({opacity:0}).toFront();
      this.checkHoverPos({rect:roundRect,set:hoverSet});
      this.globalHoverSet.push(hoverSet);

      cursor.node.onmouseover = function (e) {
        if (colorattr==="fill") { cursor.attr({fill: hover_colour,stroke:hover_colour});}
        else {                   cursor.attr({stroke: hover_colour});}

        var mousepos = this.getMousePos(e);
        hoverSet[0].attr({
          x:mousepos.x-(textbox.width/2)-textpadding-element.offsetLeft,
          y:mousepos.y-(textbox.height/2)-(this.options.font_size*1.5)-textpadding-element.offsetTop,
          opacity:1});
        hoverSet[1].attr({
          x:mousepos.x-element.offsetLeft,
          y:mousepos.y-(this.options.font_size*1.5)-element.offsetTop,
          opacity:1});

        cursor.node.onmousemove = function (e) {
          var mousepos = this.getMousePos(e);
          hoverSet[0].attr({
            x:mousepos.x-(textbox.width/2)-textpadding-element.offsetLeft,
            y:mousepos.y-(textbox.height/2)-(this.options.font_size*1.5)-textpadding-element.offsetTop,
            opacity:1});
          hoverSet[1].attr({
            x:mousepos.x-element.offsetLeft,
            y:mousepos.y-(this.options.font_size*1.5)-element.offsetTop,
            opacity:1});
          this.checkHoverPos(roundRect,hoverSet);
        }.bind(this);
      }.bind(this);

      cursor.node.onmouseout = function () {
        if (colorattr==="fill") { cursor.attr({fill: colour,stroke:colour});}
        else {                   cursor.attr({stroke: colour});}
        hoverSet.attr({opacity:0});
      };
    }

    $A(coords).each(function (coord, index) {
      var x = coord[0],
          y = coord[1];
          this.drawPlot(index, cursor, x, y, colour, coords, datalabel, element,graphindex);
    }.bind(this));
  },

  calculateCoords: function (data) {
    var x = this.x_padding_left + this.options.plot_padding - this.step,
        y_offset = (this.graph_height + this.y_padding_top) + this.normalise(this.start_value);

    return $A(data).collect(function (value) {
      var y = y_offset - value;
      x = x + this.step;
      return [x, y];
    }.bind(this));
  },

  drawFocusHint: function () {
    var length = 5,
        x = this.x_padding_left + (length / 2) - 1,
        y = this.options.height - this.y_padding_bottom,
        cursor = this.paper.path().attr({stroke: this.options.label_colour, 'stroke-width': 2});

    cursor.moveTo(x, y);
    cursor.lineTo(x - length, y - length);
    cursor.moveTo(x, y - length);
    cursor.lineTo(x - length, y - (length * 2));
  },

  drawMeanLine: function (data) {
    var cursor = this.paper.path().attr({stroke: this.options.meanline}),
        offset = $A(data).inject(0, function (value, sum) { return sum + value; }) / data.length;

    cursor.moveTo(this.x_padding_left - 1, this.options.height - this.y_padding_bottom - offset);
    cursor.lineTo(this.graph_width + this.x_padding_left, this.options.height - this.y_padding_bottom - offset);
  },

  drawAxis: function () {
    var cursor = this.paper.path().attr({stroke: this.options.label_colour});

    //horizontal
    cursor.moveTo(parseInt(this.x_padding_left, 10)-0.5,                    this.options.height - parseInt(this.y_padding_bottom, 10) + 0.5);
    cursor.lineTo(parseInt(this.graph_width + this.x_padding_left, 10)-0.5, this.options.height - parseInt(this.y_padding_bottom, 10) + 0.5);

    //vertical
    cursor.moveTo(parseInt(this.x_padding_left, 10)-0.5, parseInt(this.options.height - this.y_padding_bottom, 10)+0.5);
    cursor.lineTo(parseInt(this.x_padding_left, 10)-0.5, parseInt(this.y_padding_top, 10));
  },

  makeValueLabels: function (steps) {
    var step = this.label_step,
        label = this.start_value,
        labels = [];
    for (var i = 0; i < steps; i++) {
      label = this.roundValue((label + step), 3);
      labels.push(label);
    }
    return labels;
  },
  drawMarkers: function (labels, direction, step, start_offset, font_offsets, extra_font_options) {
  /* Axis label markers */
    function x_offset(value) {
      return value * direction[0];
    }

    function y_offset(value) {
      return value * direction[1];
    }

    /* Start at the origin */
    var x = parseInt(this.x_padding_left, 10) - 0.5 + x_offset(start_offset),
        y = this.options.height - this.y_padding_bottom + y_offset(start_offset),
        cursor = this.paper.path().attr({stroke: this.options.label_colour}),
        font_options = {"font": this.options.font_size + 'px "Arial"', stroke: "none", fill: this.options.label_colour};

    Object.extend(font_options, extra_font_options || {});

    labels.each(function (label) {
      if (this.options.draw_axis && ((this.options.hide_empty_label_grid === true && label !== "") || this.options.hide_empty_label_grid === false)) {
        cursor.moveTo(parseInt(x, 10), parseInt(y, 10)+0.5);
        cursor.lineTo(parseInt(x, 10) + y_offset(5), parseInt(y, 10)+0.5 + x_offset(5));
      }
      this.paper.text(x + font_offsets[0], y - 2 - font_offsets[1], label).attr(font_options).toFront();
      x = x + x_offset(step);
      y = y + y_offset(step);
    }.bind(this));
  },

  drawVerticalLabels: function () {
    var y_step = this.graph_height / this.y_label_count;
    var vertical_label_unit = this.options.vertical_label_unit ? " "+this.options.vertical_label_unit : "";
    for (var i = 0; i < this.value_labels.length; i++) {
      this.value_labels[i] += vertical_label_unit;
    }
    this.drawMarkers(this.value_labels, [0, -1], y_step, y_step, [-8, -2], { "text-anchor": 'end' });
  },
  drawHorizontalLabels: function () {
    this.drawMarkers(this.options.labels, [1, 0], this.step, this.options.plot_padding, [0, (this.options.font_size + 7) * -1]);
  },
  checkHoverPos: function (elements) {
    var diff, rect, rectsize, set, marker, nib, textpadding;
    if (elements.rect) {
      rect = elements.rect;
      rectsize = rect.getBBox();
    }
    if (elements.set) {    set = elements.set;}
    if (elements.marker) { marker = elements.marker;}
    if (elements.nib) {    nib = elements.nib;}
    if (elements.textpadding) { textpadding = elements.textpadding;}

    if (rect && set) {
      /*top*/
      if (rect.attrs.y < 0) {
        if (nib && marker) {
          set.translate(0,set.getBBox().height+(textpadding*2));
          marker.translate(0,-set.getBBox().height-(textpadding*2));
          nib.translate(0,-rectsize.height-textpadding-1).scale(1,-1);
        } else {
          diff = rect.attrs.y;
          set.translate(0,1+(diff*-1));
        }
      }
      /*bottom*/
      if ((rect.attrs.y +rectsize.height) > this.options.height) {
        diff = (rect.attrs.y +rectsize.height) - this.options.height;
        set.translate(0,(diff*-1)-1);
        if (marker) {marker.translate(0,diff+1);}
      }
      /*left*/
      if (rect.attrs.x < 0) {
        diff = rect.attrs.x;
        set.translate((diff*-1)+1,0);
        if (nib) {nib.translate(diff-1,0);}
        if (marker) {marker.translate(diff-1,0);}
      }
      /*right*/
      if ((rect.attrs.x +rectsize.width) > this.options.width) {
        diff = (rect.attrs.x +rectsize.width) - this.options.width;
        set.translate((diff*-1)-1,0);
        if (nib) {nib.translate(diff+1,0);}
        if (marker) {marker.translate(diff+1,0);}
      }
    }
  }
});

Ico.LineGraph = Class.create(Ico.BaseGraph, {
  chartDefaults: function () {
    return { plot_padding: 10, stacked_fill:false };
  },

  setChartSpecificOptions: function () {
    if (typeof this.options.curve_amount === 'undefined') {
      this.options.curve_amount = 10;
    }
  },

  calculateStep: function () {
    return (this.graph_width - (this.options.plot_padding * 2)) / (this.data_size - 1);
  },

  startPlot: function (cursor, x, y, colour) {
    cursor.moveTo(x, y);
  },

  drawGraphMarkers: function (index, x, y, colour, datalabel, element) {
    var circle = this.paper.circle(x, y, this.options.marker_size),
        old_marker_size = this.options.marker_size,
        new_marker_size;
    circle.attr({ 'stroke-width': '1px', stroke: this.options.background_colour, fill: colour });

    circle.node.onmouseover = function (e) {
      new_marker_size = parseInt(1.7*old_marker_size, 10);
      circle.animate({r:new_marker_size},200);
    }.bind(this);

    circle.node.onmouseout = function () {
      circle.animate({r:old_marker_size},200);
    };
  },
  drawGraphValueMarkers: function (index, x, y, colour, datalabel, element, graphindex) {
    if (this.options.odd_horizontal_offset>1) {
          index += this.options.odd_horizontal_offset;
      }
    index -= this.options.stacked ? 1 : 0;
    var currentset = this.options.stacked ? this.real_data : this.data_sets,
        currentvalue = currentset.collect(function (data_set) {return data_set[1][index];})[graphindex],
        vertical_label_unit = this.options.vertical_label_unit||"";

    if (currentvalue) {
      currentvalue = currentvalue.toString().split('.');
      if (currentvalue[1]) {
        currentvalue[1] = currentvalue[1].truncate(3, '');
      }
    }

    if (!this.options.stacked || (this.options.stacked && index !== -1 && typeof(currentvalue) !== "undefined")) {
      var rectx = x-(this.step/2),
          recty = this.options.stacked ? y-(this.graph_height/18): y-(this.graph_height/6),
          rectw = this.step,
          recth = this.options.stacked ? this.graph_height/9     : this.graph_height/3,
          circle = this.paper.circle(x, y, this.options.marker_size),
          block = this.paper.rect(rectx, recty, rectw, recth);

      circle.attr({ 'stroke-width': '1px', stroke: this.options.background_colour, fill: colour,opacity:0});
      block.attr({fill:colour, 'stroke-width': 0, stroke : colour,opacity:0}).toFront();

      if (this.options.datalabels) {
        datalabel = datalabel+": "+currentvalue;
        datalabel += this.options.vertical_label_unit ? " "+this.options.vertical_label_unit:"";
      } else {
        datalabel = currentvalue.toString();
        datalabel += this.options.vertical_label_unit ? " "+this.options.vertical_label_unit:"";
      }
      var hoverSet = this.paper.set(),
          textpadding = 4,
          text = this.paper.text(circle.attrs.cx, circle.attrs.cy-(this.options.font_size*1.5)-2*textpadding, datalabel);
      text.attr({'font-size': this.options.font_size, fill:this.options.background_colour,opacity: 1});
      var textbox = text.getBBox(),
          roundRect= this.paper.rect(
            text.attrs.x-(textbox.width/2)-textpadding,
            text.attrs.y-(textbox.height/2)-textpadding,
            textbox.width+(textpadding*2),
            textbox.height+(textpadding*2),
            textpadding*1.5);
      roundRect.attr({fill: this.options.label_colour,opacity: 1});

      var nib = this.paper.path();
      nib.attr({fill: this.options.label_colour,opacity: 1});
      nib.moveTo(text.attrs.x-textpadding,text.attrs.y+(textbox.height/2)+textpadding+0.5);
      nib.lineTo(text.attrs.x,text.attrs.y+(textbox.height/2)+(2*textpadding+0.5));
      nib.lineTo(text.attrs.x+textpadding,text.attrs.y+(textbox.height/2)+textpadding+0.5);
      nib.andClose();

      text.toFront();
      hoverSet.push(circle,roundRect,nib,text).attr({opacity:0}).toFront();
      this.checkHoverPos({rect:roundRect,set:hoverSet,marker:circle,nib:nib,textpadding:textpadding});
      this.globalHoverSet.push(hoverSet);
      this.globalBlockSet.push(block);

      block.node.onmouseover = function (e) {
        hoverSet.animate({opacity:1},200);
      };

      block.node.onmouseout = function (e) {
        hoverSet.animate({opacity:0},200);
      };
    }
  },
  drawPlot: function (index, cursor, x, y, colour, coords, datalabel, element, graphindex) {

    if (this.options.markers === 'circle') {
      this.drawGraphMarkers(index, x, y, colour, datalabel, element);
    } else if (this.options.markers === 'value') {
      this.drawGraphValueMarkers(index, x, y, colour, datalabel, element, graphindex);
    }
    if (index === 0) {
      return this.startPlot(cursor, x, y, colour);
    }

    if (this.options.curve_amount) {
      cursor.cplineTo(x, y, this.options.curve_amount);
    } else {
      cursor.lineTo(x, y);
    }
  }
});

Ico.AreaGraph = Class.create(Ico.LineGraph, {

  chartDefaults: function () {
    return { plot_padding: 10, area:true };
  },
  setChartSpecificOptions: function () {
    if (typeof this.options.curve_amount === 'undefined') {
      this.options.curve_amount = 10;
    }
  },
  drawPlot: function (index, cursor, x, y, colour, coords, datalabel, element, graphindex) {
    var filltype = this.options.area||this.options.stacked_fill;

    if (this.options.markers === 'circle') {
      if (filltype === true) {
        if (index !== 0 && index !== coords.length-1) {
          this.drawGraphMarkers(index,cursor,x,y,colour, datalabel, element);
        }
      } else {
         this.drawGraphMarkers(index,cursor,x,y,colour, datalabel, element);
      }
    } else if (this.options.markers === 'value') {
      this.drawGraphValueMarkers(index, x, y, colour, datalabel, element, graphindex);
    }

    if (index === 0) {
      return this.startPlot(cursor, x, y, colour);
    }

    if (this.options.curve_amount && index > 1 && (index < coords.length-1)) {
      cursor.cplineTo(x, y, this.options.curve_amount);
    } else if (this.options.curve_amount && !filltype && (index = 1 || (index = coords.length-1))) {
      cursor.cplineTo(x, y, this.options.curve_amount);
    } else {
      cursor.lineTo(x, y);
    }
  }
});

Ico.StackGraph = Class.create(Ico.AreaGraph, {
  chartDefaults: function () {
    return { plot_padding: 10, stacked_fill:true, stacked:true };
  },
  normaliserOptions: function () {
  },
  stackData: function (stacked_data) {
    this.stacked_data = stacked_data.collect(
      function (data_set) {
        return data_set[1];
      });

    this.stacked_data.reverse();
    for (var i=1;i<this.stacked_data.length;i++) {
      for(var j=0;j<this.stacked_data[0].length; j++) {
        this.stacked_data[i][j] += this.stacked_data[i-1][j];
      }
    }
    this.stacked_data.reverse();
    return this.stacked_data;
  }
});
Ico.BarGraph = Class.create(Ico.BaseGraph, {
  chartDefaults: function () {
    return { plot_padding: 0 };
  },
  normaliserOptions: function () {
    return { start_value: 0 };
  },
  setChartSpecificOptions: function () {
    this.bar_padding = 5;
    this.bar_width = this.calculateBarWidth();
    this.options.plot_padding = (this.bar_width / 2);
    this.step = this.calculateStep();
    this.grid_start_offset = this.bar_padding - 1;
  },

  calculateBarWidth: function () {
    return (this.graph_width / this.data_size) - this.bar_padding;
  },

  calculateStep: function () {
    return (this.graph_width - (this.options.plot_padding * 2) - (this.bar_padding * 2)) / (this.data_size - 1);
  },

  drawPlot: function (index, cursor, x, y, colour, coords, datalabel, element) {
    var start_y = this.options.height - this.y_padding_bottom,
        lastcolor = this.options.bargraph_lastcolour,
        colour2;
    x = x + this.bar_padding;

    if (lastcolor && index === coords.length-1){
      colour2 = lastcolor;
    } else {
      colour2 = colour;
    }

    var bargraph = this.paper.rect(x-(this.bar_width/2), start_y-(this.options.height-y-this.y_padding_bottom), this.bar_width, (this.options.height-this.y_padding_bottom)-y);
    bargraph.attr({fill: colour2, 'stroke-width': 0, stroke : colour2});


    if (this.options.datalabels) {
      var hover_colour = this.options.hover_colour || colour,
          hoverSet = this.paper.set(),
          text = this.paper.text(bargraph.attrs.x+(this.bar_width/2), bargraph.attrs.y-(this.options.font_size*1.5), datalabel),
          hoverbar = this.paper.rect(x-(this.bar_width/2), this.y_padding_top, this.bar_width, this.options.height);

      datalabel = datalabel[index].toString();
      hoverbar.attr({fill: colour2, 'stroke-width': 0, stroke : colour2,opacity:0});
      text.attr({'font-size': this.options.font_size, fill:this.options.background_colour,opacity: 1});

      var textbox = text.getBBox(),
          textpadding = 4,
          roundRect= this.paper.rect(
            text.attrs.x-(textbox.width/2)-textpadding,
            text.attrs.y-(textbox.height/2)-textpadding,
            textbox.width+(textpadding*2),
            textbox.height+(textpadding*2),
            textpadding*1.5);
      roundRect.attr({fill: this.options.label_colour,opacity: 1});

      var nib = this.paper.path();
      nib.attr({fill: this.options.label_colour,opacity: 1});
      nib.moveTo(hoverbar.attrs.x+(this.bar_width/2)-textpadding,text.attrs.y+(textbox.height/2)+textpadding+0.5);
      nib.lineTo(hoverbar.attrs.x+(this.bar_width/2),text.attrs.y+(textbox.height/2)+(textpadding*2)+0.5);
      nib.lineTo(hoverbar.attrs.x+(this.bar_width/2)+textpadding,text.attrs.y+(textbox.height/2)+textpadding+0.5);
      nib.andClose();

      text.toFront();
      hoverSet.push(roundRect,nib,text).attr({opacity:0}).toFront();
      hoverbar.toFront();
      this.checkHoverPos({rect:roundRect,set:hoverSet,nib:nib});
      this.globalHoverSet.push(hoverSet);
      if (roundRect.attrs.y < 0) {
        hoverSet.translate(0,1+(roundRect.attrs.y*-1));
      }

      hoverbar.node.onmouseover = function (e) {
        bargraph.animate({fill: hover_colour,stroke:hover_colour}, 200);
        hoverSet.animate({opacity:1}, 200);
      }.bind(this);

      hoverbar.node.onmouseout = function (e) {
        bargraph.animate({fill: colour2,stroke:colour2}, 200);
        hoverSet.animate({opacity:0}, 200);
      };
    }

    x = x + this.step;
    this.options.count++;
  },
  drawHorizontalLabels: function () {
  /* Change the standard options to correctly offset against the bars */
    var x_start = this.bar_padding + this.options.plot_padding;
    this.drawMarkers(this.options.labels, [1, 0], this.step, x_start, [0, (this.options.font_size + 7) * -1]);
  }
});

Ico.HorizontalBarGraph = Class.create(Ico.BarGraph, {
  setChartSpecificOptions: function () {
    // Approximate the width required by the labels
    this.x_padding_left = 20 + this.longestLabel() * (this.options.font_size / 2);
    this.bar_padding = 5;
    this.bar_width = this.calculateBarHeight();
    this.options.plot_padding = 0;
    this.step = this.calculateStep();

    this.options.horizontalbar_grid = true;
    this.options.horizontalbar_padding = true;
    this.graph_width = this.options.width - this.x_padding_right - this.x_padding_left;
  },
  normalise: function (value) {
    var offset = this.x_padding_left;
    return ((value / this.range) * (this.graph_width - offset));
  },

  longestLabel: function () {
    return $A(this.options.labels).sort(function (a, b) { return a.toString().length < b.toString().length; }).first().toString().length;
  },

  /* Height */
  calculateBarHeight: function () {
    return (this.graph_height / this.data_size) - this.bar_padding;
  },

  calculateStep: function () {
    return (this.graph_height - (this.options.plot_padding * 2)) / this.data_size;
  },
  drawLines: function (label, colour, data, datalabel, element) {
    var x = this.x_padding_left + this.options.plot_padding,
        y = this.y_padding_top+(this.bar_width/2)+(this.bar_padding/2),
        lastcolor = this.options.bargraph_lastcolour;

    $A(data).each(function (value, index) {
      var colour2,
          horizontal_rounded = this.options.horizontal_rounded ? this.bar_width/2 : 0,
          cursor = this.paper.rect(x, (y-this.bar_width/2), x + value - this.normalise(this.start_value), this.bar_width, horizontal_rounded);

      if (lastcolor && index === $A(data).length-1){
        colour2 = lastcolor;
      } else {
        colour2 = colour;
      }

      cursor.attr({fill: colour2, 'stroke-width': 0, stroke : colour2});
      if (horizontal_rounded){
        var cursor2 = this.paper.rect(x, (y-this.bar_width/2)-0.5, x + value - this.normalise(this.start_value)-this.bar_width/2, this.bar_width+0.5);
            cursor2.attr({fill: colour2, 'stroke-width': 0, stroke : colour2});
        cursor.toFront();
        cursor.secondnode = cursor2;
      }

      y = y + this.step;

    }.bind(this));
  },

  /* Horizontal version */
  drawFocusHint: function () {
    var length = 5,
        x = this.x_padding_left + (this.step * 2),
        y = this.options.height - this.y_padding_bottom;
    var cursor = this.paper.path().attr({stroke: this.options.label_colour, 'stroke-width': 2});

    cursor.moveTo(x, y);
    cursor.lineTo(x - length, y + length);
    cursor.moveTo(x - length, y);
    cursor.lineTo(x - (length * 2), y + length);
  },

  drawVerticalLabels: function () {
    var y_start = (this.step / 2);
    this.drawMarkers(this.options.labels.reverse(), [0, -1], this.step, y_start, [-8, -(this.options.font_size / 5)], { "text-anchor": 'end' });
  },

  drawHorizontalLabels: function () {
    var x_step = this.graph_width / this.y_label_count,
        x_labels = this.makeValueLabels(this.y_label_count);

        if (this.options.vertical_label_unit) {
          for(var i=0;i<x_labels.length;i++) {
            x_labels[i] += this.options.vertical_label_unit;
          }
        }
    this.drawMarkers(x_labels, [1, 0], x_step, x_step, [0, (this.options.font_size + 7) * -1]);
  }
});
Ico.SparkLine = Class.create(Ico.Base, {
  initialize: function (element, data, options) {
    this.element = element;
    this.data = data;

    this.options = {
      highlight:              false
    };
    Object.extend(this.options, options || { });

    this.step = this.calculateStep();
    this.paper = new Raphael(this.element, this.options.width, this.options.height);
    if (this.options.acceptable_range) {
      this.background = this.paper.rect(0, this.options.height - this.normalise(this.options.acceptable_range[1]),
                                        this.options.width, this.options.height - this.normalise(this.options.acceptable_range[0]));
    } else {
      this.background = this.paper.rect(0, 0, this.options.width, this.options.height);
    }
    this.background.attr({fill: this.options.background_colour, stroke: 'none' });
    this.draw();
  },

  calculateStep: function () {
    return this.options.width / (this.data.length - 1);
  },

  normalise: function (value) {
    return (this.options.height / this.data.max()) * value;
  },

  draw: function () {
    var data = this.normaliseData(this.data);
    this.drawLines('', this.options.colour, data);

    if (this.options.highlight) {
      this.showHighlight(data);
    }
  },

  drawLines: function (label, colour, data) {
    var line = this.paper.path().attr({ stroke: colour, "stroke-width" : this.options.stroke_width }).moveTo(0, this.options.height - data.first()),
        x = 0;

    data.slice(1).each(function (value) {
      x = x + this.step;
      line.lineTo(x, this.options.height - value);
    }.bind(this));
  },

  showHighlight: function (data) {
    var size = 2,
        x = this.options.width - size,
        i = this.options.highlight.index || data.length - 1,
        y = data[i] + (size / 2).round(),
        circle;

    // Find the x position if it's not the last value
    if (typeof this.options.highlight.index !== 'undefined') {
      x = this.step * this.options.highlight.index;
    }

    circle = this.paper.circle(x, this.options.height - y, size);
    circle.attr({ stroke: false, fill: this.options.highlight.colour});
  }
});
Ico.SparkBar = Class.create(Ico.SparkLine, {
  calculateStep: function () {
    return this.options.width / this.data.length;
  },
  drawLines: function (label, colour, data) {
    var lastcolor = this.options.bargraph_lastcolour,
        width = this.step > 2 ? this.step - 1 : this.step,
        x = width;


    data.each(function (value,index) {
      var colour2, line;
      if (lastcolor && index === data.length-1 ){
        colour2 = lastcolor;
      } else {
        colour2 = colour;
      }
      line = this.paper.path().attr({ stroke: colour2, 'stroke-width': width });
      line.moveTo(x, this.options.height - value);
      line.lineTo(x, this.options.height);
      x = x + this.step;
    }.bind(this));
  }
});


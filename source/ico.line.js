
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

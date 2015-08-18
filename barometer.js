// barometer.js
// Jiun Wei Chia
// Barometer Simulator for MOE

// 2015-01-29: Initial UI developed
// 2015-02-02: Core functionality working
// 2015-02-16: Self-assessment added

/** List of physical constants. */
var Constants = {
  /** Sea level standard atmospheric pressure. */
  ATM: 101325.0,
  /** Sea level standard temperature, in Kelvin. */
  T0: 288.15,
  /** Gravitational acceleration. */
  G: 9.80665,
  /** Ideal gas constant. */
  R: 8.31447,
  /** Temperature lapse rate in K/m. */
  L: 0.0065,
  /** Molar mass of dry air. */
  M: 0.0289644,
  /** Density of air at standard temperature and pressure. */
  RHO: 1.2754,
};

/** List of UI-related constants. */
var UI = {
  /** Canvas width. */
  CANVAS_WIDTH: 847,
  /** Canvas height. */
  CANVAS_HEIGHT: 600,
  /** Scale factor for drawing. */
  METRE_IN_PIXELS: 200.0,
  /** Width of barometer stroke. */
  STROKE: 4,
  /** Global liquid level */
  LEVEL: 400,
  /** Threshold for determining whether tube is full or empty. */
  THRESHOLD: 0.02,
  /** Angle threshold for determining whether tube is upside down, in degrees. */
  ANGLE_THRESHOLD: 5.0,
  /** Pixel threshold for snapping to liquid levels. */
  PIXEL_THRESHOLD: 5.0,
  /** Margin to use for text rendering. */
  MARGIN: 25,
  /** Quantum to use for mystery altitude, in m. */
  QUANTA_ALTITUDE: 100.0,
  /** Minimum mystery altitude where simple approximation is used, in multiples of QUANTA_ALTITUDE. */
  MIN_ALTITUDE: 1,
  /** Maximum mystery altitude where simple approximation is used, in multiples of QUANTA_ALTITUDE. */
  MAX_ALTITUDE: 10,
  /** Quantum to use for mystery density, in kg/m^3. */
  QUANTA_DENSITY: 100.0,
  /** Minimum mystery density, in multiples of QUANTA_DENSITY. */
  MIN_DENSITY: 5,
  /** Maximum mystery density, in multiples of QUANTA_DENSITY. */
  MAX_DENSITY: 200,
  /** Precision to use for measurement display. */
  PRECISION: 3,
};

/** The canvas object that serves as the view. */
var canvas = new fabric.Canvas("canvas");
canvas.selection = false;

/** Represents a type of liquid. */
function LiquidType(color, density) {
  /** The color of this liquid. */
  this.color = color;
  /** The density of this liquid in kg/cm^3. */
  this.density = density;
}

// Built-in liquid types.
var MysteryLiquidType = new LiquidType("rgb(0, 255, 0)", Math.round(Math.random() * (UI.MAX_DENSITY - UI.MIN_DENSITY) + UI.MIN_DENSITY) * UI.QUANTA_DENSITY);
var OilLiquidType = new LiquidType("rgb(255, 255, 128)", 920.0);
var WaterLiquidType = new LiquidType("rgb(64, 64, 255)", 1000.0);
var SaltWaterLiquidType = new LiquidType("rgb(0, 0, 128)", 1027.0);
var MercuryLiquidType = new LiquidType("rgb(128, 128, 128)", 13534.0);

/** List of environment variables. */
var Environment = {
  /** Atmospheric pressure. By default, it is 1 Atmosphere. */
  atm: Constants.ATM,
  /** Gravitational acceleration. By default, it is 9.81 m/s^2. */
  g: Constants.G,
  /** Liquid type in the barometer. */
  liquidType: MercuryLiquidType,
  /** Whether measurement mode is on. */
  measurementMode: false,
  /** Whether mystery liquid is active. */
  mysteryLiquidActivated: false,
  /** Whether mystery altitude is active. */
  mysteryAltitudeActivated: false,
  /** Mystery altitude in m. */
  mysteryAltitude: Math.round(Math.random() * (UI.MAX_ALTITUDE - UI.MIN_ALTITUDE) + UI.MIN_ALTITUDE) * UI.QUANTA_ALTITUDE,
};

/** List of possible tube shapes. */
var TubeShapes = {
  PLAIN: 0,
  SLIM: 1,
  ZIGZAG: 2,
};

/** Represents a Barometer tube. */
var Tube = fabric.util.createClass(fabric.Path, {
  initialize: function(tubeShape) {
    var path;
    var options = {
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: UI.STROKE,
      lockScalingX: true,
      lockScalingY: true,
      perPixelTargetFind: true,
    };
    switch (tubeShape) {
      case TubeShapes.PLAIN:
        path = "M 0 0 L 0 300 L 100 300 L 100 0";
        break;
      case TubeShapes.SLIM:
        path = "M 0 0 L 0 300 L 50 300 L 50 0";
        break;
      case TubeShapes.ZIGZAG:
        path = "M 0 0 L 0 50 L -20 100 L 20 200 L 0 250 L 0 300 L 50 300 L 50 250 L 70 200 L 30 100 L 50 50 L 50 0";
        break;
    }
    this.callSuper("initialize", path, options);

    var setCoords = this.setCoords.bind(this);
    this.on({
      moving: setCoords,
      scaling: setCoords,
      rotating: setCoords,
    });
  },
  _render: function(ctx) {
    ctx.save()

    ctx.beginPath();
    var bound = this.getBoundingRect();
    var point;
    point = this.toLocalPoint(new fabric.Point(0, bound.top + bound.height - this.depth), 'center', 'center');
    ctx.moveTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(UI.CANVAS_WIDTH, bound.top + bound.height - this.depth), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(UI.CANVAS_WIDTH, 0), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(0, 0), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.strokeStyle = "transparent";
    this.callSuper("_render", ctx);

    ctx.restore();

    ctx.save();

    ctx.beginPath();
    point = this.toLocalPoint(new fabric.Point(0, bound.top + bound.height - this.depth), 'center', 'center');
    ctx.moveTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(UI.CANVAS_WIDTH, bound.top + bound.height - this.depth), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(UI.CANVAS_WIDTH, UI.CANVAS_HEIGHT), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    point = this.toLocalPoint(new fabric.Point(0, UI.CANVAS_HEIGHT), 'center', 'center');
    ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = Environment.liquidType.color;
    ctx.strokeStyle = "transparent";
    this.callSuper("_render", ctx);

    ctx.restore();

    ctx.fillStyle = "transparent";
    ctx.strokeStyle = "black";
    this.callSuper("_render", ctx);
  },
  depth: 0,
  volume: 0.0,
  airVolumeInAtm: 1.0,
  toGlobalPoint: function(point) {
    var center = this.getCenterPoint();
    return fabric.util.rotatePoint(new fabric.Point(point.x, point.y).addEquals(center), 
      center, fabric.util.degreesToRadians(this.angle));
  },
  globalOpening: function() {
    var first = this.path[0];
    var last = this.path[this.path.length-1];
    var firstPoint = this.toGlobalPoint(new fabric.Point(first[1] - this.pathOffset.x, first[2] - this.pathOffset.y));
    var lastPoint = this.toGlobalPoint(new fabric.Point(last[1] - this.pathOffset.x, last[2] - this.pathOffset.y));
    return [ firstPoint, lastPoint ];
  },
  globalDepth: function() {
    var bound = this.getBoundingRect();
    return bound.top + bound.height - this.depth;
  },
});

/** List of Barometer tubes. */
var tubes = [ ];

/** Updates the model after each user interaction. */
canvas.on('before:render', function() {
  
  // Draw surrounding liquid manually.
  var ctx = canvas.getContext();
  ctx.save();
  ctx.fillStyle = Environment.liquidType.color;
  ctx.fillRect(0, UI.LEVEL, UI.CANVAS_WIDTH, UI.CANVAS_HEIGHT - UI.LEVEL)
  ctx.restore();

  $.each(tubes, function(index, tube) {
    var bound = tube.getBoundingRect();
    var opening = tube.globalOpening();
    var globalDepth = tube.globalDepth();

    var openingAboveLevel = (opening[0].y <= UI.LEVEL) && (opening[1].y <= UI.LEVEL);
    var openingAboveGlobalDepth = (opening[0].y <= globalDepth) && (opening[1].y <= globalDepth);
    var isLiquidConserved = openingAboveLevel && openingAboveGlobalDepth;

    var openingBelowLevel = (opening[0].y >= UI.LEVEL) && (opening[1].y >= UI.LEVEL);
    var openingBelowGlobalDepth = (opening[0].y >= globalDepth) && (opening[1].y >= globalDepth);
    var openingUpsideDown = Math.abs(tube.angle - 180) < UI.ANGLE_THRESHOLD;
    var isAirConserved = openingBelowLevel && (openingBelowGlobalDepth || openingUpsideDown);

    if (isLiquidConserved) {
      // tube.volume is conserved.
      tube.depth = tube.volume * bound.height; 
      tube.airVolumeInAtm = 1.0 - tube.volume;
    } else if (isAirConserved) {
      // tube.airVolumeInAtm is conserved.

      // Use Boyle's law to calculate new tube depth.
      // Done by solving quadratic equation in terms of tube.depth.
      // a = \rho g
      // b = -(atm + (bound.height + bound.top + bound.height - UI.LEVEL) \rho g)
      // c = bound.height ((bound.top + bound.height - UI.LEVEL) \rho g + atm (1 - tube.airVolumeInAtm))
      var a = Environment.liquidType.density * Environment.g;
      var b = -(Environment.atm + (bound.height + bound.top + bound.height - UI.LEVEL) / UI.METRE_IN_PIXELS * a);
      var c = bound.height / UI.METRE_IN_PIXELS * ((bound.top + bound.height - UI.LEVEL) / UI.METRE_IN_PIXELS * a + Environment.atm * (1.0 - tube.airVolumeInAtm));
      var discriminant = Math.pow(b, 2) - 4.0 * a * c;
      var answer = (-b - Math.sqrt(discriminant)) / 2.0 / a * UI.METRE_IN_PIXELS;
      if (answer > bound.height) answer = bound.height;
      if (answer < 0) answer = 0.0;
      tube.depth = answer;
      tube.volume = tube.depth / bound.height;
    } else {
      var upperOpening = (opening[0].y < opening[1].y) ? opening[0].y : opening[1].y;
      var lowerOpening = (opening[0].y > opening[1].y) ? opening[0].y : opening[1].y;
      var newGlobalDepth;
      if (openingBelowLevel) {
        // No conservation and no air supply.
        newGlobalDepth = (UI.LEVEL > upperOpening) ? UI.LEVEL : upperOpening;
        if (newGlobalDepth < bound.top) tube.depth = bound.height;
        else if (newGlobalDepth > bound.top + bound.height) tube.depth = 0.0;
        else tube.depth = bound.top + bound.height - newGlobalDepth;
        tube.volume = tube.depth / bound.height;
        var pressureAtDepth = Environment.atm + (tube.globalDepth() - UI.LEVEL) / UI.METRE_IN_PIXELS * Environment.liquidType.density * Environment.g;
        var oldAirVolumeInAtm = tube.airVolumeInAtm;
        var newAirVolumeInAtm = pressureAtDepth * (1.0 - tube.volume) / Environment.atm;
        // Amount of air can only go down.
        tube.airVolumeInAtm = (oldAirVolumeInAtm < newAirVolumeInAtm) ? oldAirVolumeInAtm : newAirVolumeInAtm;
      } else {
        // No conservation but air supply present.
        newGlobalDepth = (UI.LEVEL < lowerOpening) ? UI.LEVEL : lowerOpening;
        if (newGlobalDepth < bound.top) tube.depth = bound.height;
        else if (newGlobalDepth > bound.top + bound.height) tube.depth = 0.0;
        else tube.depth = bound.top + bound.height - newGlobalDepth;
        tube.volume = tube.depth / bound.height;
        tube.airVolumeInAtm = 1.0 - tube.volume;
      }

      // Force tube to be full or empty if near threshold.
      // Should only do this when no conservation is taking place.
      if (Math.abs(tube.volume) < UI.THRESHOLD) {
        tube.depth = 0.0;
        tube.volume = 0.0;
        tube.airVolumeInAtm = 1.0;
      }
      if (Math.abs(tube.airVolumeInAtm) < UI.THRESHOLD) {
        tube.depth = bound.height;
        tube.volume = 1.0;
        tube.airVolumeInAtm = 0.0;
      }
    }
  })
});

/** Register event handlers. */
function registerEvents() {

  // Rounds a given value to the given quanta.
  function roundToQuanta(value, quanta) {
    var multiple = Math.round(value / quanta);
    return multiple * quanta;
  }

  // Updates the title of a dropdown given one of its menu items.
  function updateDropdownText(menuitem, text) {
    $(menuitem).parents(".btn-group").find(".dropdown-toggle").html(text +
      " <span class=\"caret\"></span>");
  }

  $("#checkDensity").click(function() {
    var density = parseFloat($("#answerDensity").val());
    if (isNaN(density) || density < 0.0) {
      alert("Invalid density!");
      return;
    }
    if (roundToQuanta(density, UI.QUANTA_DENSITY).toPrecision(UI.PRECISION) != MysteryLiquidType.density.toPrecision(UI.PRECISION)) {
      alert("Incorrect answer!");
      return;
    }
    alert("That's correct! Answer: " + MysteryLiquidType.density.toFixed(0) + " kg/m^3\n\nClick OK for a new mystery liquid.");
    MysteryLiquidType.density = Math.round(Math.random() * (UI.MAX_DENSITY - UI.MIN_DENSITY) + UI.MIN_DENSITY) * UI.QUANTA_DENSITY;
    canvas.renderAll();
  });

  $("#liquidMystery").click(function() {
    $("#checkDensityPanel").show();
    Environment.mysteryLiquidActivated = true;
    Environment.liquidType = MysteryLiquidType;
    updateDropdownText(this, "Liquid: Mystery");
    canvas.renderAll();
  });

  $("#liquidMercury").click(function() {
    $("#checkDensityPanel").hide();
    Environment.mysteryLiquidActivated = false;
    Environment.liquidType = MercuryLiquidType;
    updateDropdownText(this, "Liquid: Mercury");
    canvas.renderAll();
  });

  $("#liquidSaltWater").click(function() {
    $("#checkDensityPanel").hide();
    Environment.mysteryLiquidActivated = false;
    Environment.liquidType = SaltWaterLiquidType;
    updateDropdownText(this, "Liquid: Salt Water");
    canvas.renderAll();
  });

  $("#liquidWater").click(function() {
    $("#checkDensityPanel").hide();
    Environment.mysteryLiquidActivated = false;
    Environment.liquidType = WaterLiquidType;
    updateDropdownText(this, "Liquid: Water");
    canvas.renderAll();
  });

  $("#liquidOil").click(function() {
    $("#checkDensityPanel").hide();
    Environment.mysteryLiquidActivated = false;
    Environment.liquidType = OilLiquidType;
    updateDropdownText(this, "Liquid: Oil");
    canvas.renderAll();
  });

  function pressureAtAltitude(altitude) {
    return Constants.ATM * Math.pow(1.0 - Constants.L * altitude / Constants.T0, Environment.g * Constants.M / Constants.R / Constants.L);
  }

  $("#checkAltitude").click(function() {
    var altitude = parseFloat($("#answerAltitude").val());
    if (isNaN(altitude) || altitude < 0.0) {
      alert("Invalid altitude!");
      return;
    }
    // Only check up to precision of 1 due to inaccuracy in subtraction.
    if (roundToQuanta(altitude, UI.QUANTA_ALTITUDE).toPrecision(UI.PRECISION) != Environment.mysteryAltitude.toPrecision(UI.PRECISION)) {
      alert("Incorrect altitude!");
      return;
    }
    alert("That's correct! Answer: " + Environment.mysteryAltitude.toFixed(0) + " m\n\nClick OK for a new mystery altitude.");
    Environment.mysteryAltitude = Math.round(Math.random() * (UI.MAX_ALTITUDE - UI.MIN_ALTITUDE) + UI.MIN_ALTITUDE) * UI.QUANTA_ALTITUDE;
    Environment.atm = Constants.ATM - Environment.mysteryAltitude * Constants.RHO * Environment.g;
    canvas.renderAll();
  });

  $("#altitudeMystery").click(function() {
    $("#checkAltitudePanel").show();
    Environment.mysteryAltitudeActivated = true;
    Environment.atm = Constants.ATM - Environment.mysteryAltitude * Constants.RHO * Environment.g;
    updateDropdownText(this, "Altitude: Mystery");
    canvas.renderAll();
  });

  $("#altitudeSea").click(function() {
    $("#checkAltitudePanel").hide();
    Environment.mysteryAltitudeActivated = false;
    Environment.atm = Constants.ATM;
    updateDropdownText(this, "Altitude: Sea Level");
    canvas.renderAll();
  });

  $("#altitude1km").click(function() {
    $("#checkAltitudePanel").hide();
    Environment.mysteryAltitudeActivated = false;
    Environment.atm = pressureAtAltitude(1000.0);
    updateDropdownText(this, "Altitude: 1 km Above Sea");
    canvas.renderAll();
  });

  $("#altitude10km").click(function() {
    $("#checkAltitudePanel").hide();
    Environment.mysteryAltitudeActivated = false;
    Environment.atm = pressureAtAltitude(10000.0);
    updateDropdownText(this, "Altitude: 10 km Above Sea");
    canvas.renderAll();
  });

  $("#scale20").click(function() {
    UI.METRE_IN_PIXELS = 20.0;
    updateDropdownText(this, "Scale: 1 m = 20 pixels");
    canvas.renderAll();
  });

  $("#scale50").click(function() {
    UI.METRE_IN_PIXELS = 50.0;
    updateDropdownText(this, "Scale: 1 m = 50 pixels");
    canvas.renderAll();
  });

  $("#scale100").click(function() {
    UI.METRE_IN_PIXELS = 100.0;
    updateDropdownText(this, "Scale: 1 m = 100 pixels");
    canvas.renderAll();
  });

  $("#scale200").click(function() {
    UI.METRE_IN_PIXELS = 200.0;
    updateDropdownText(this, "Scale: 1 m = 200 pixels");
    canvas.renderAll();
  });

  $("#measurement").click(function() {
    Environment.measurementMode = !Environment.measurementMode;
    if (Environment.measurementMode) {
      $("#measurementText").show();
    } else {
      $("#measurementText").hide();
    }
    $(this).html("Measurement: " + (Environment.measurementMode ? "On" : "Off"));
    canvas.renderAll();
  });

  $("#addPlain").click(function() {
    var tube = new Tube(TubeShapes.PLAIN);
    tubes.push(tube);
    canvas.add(tube);
    tube.center();
    tube.setCoords();
    canvas.renderAll();
  });

  $("#addSlim").click(function() {
    var tube = new Tube(TubeShapes.SLIM);
    tubes.push(tube);
    canvas.add(tube);
    tube.center();
    tube.setCoords();
    canvas.renderAll();
  });

  $("#addZigzag").click(function() {
    var tube = new Tube(TubeShapes.ZIGZAG);
    tubes.push(tube);
    canvas.add(tube);
    tube.center();
    tube.setCoords();
    canvas.renderAll();
  });

  $("#delete").click(function() {
    var tube = canvas.getActiveObject();
    var index = tubes.indexOf(tube);
    if (index > -1) tubes.splice(index, 1);
    canvas.remove(tube);
    canvas.renderAll();
  });

  var offsetX = -UI.MARGIN;
  var offsetY = -UI.MARGIN;
  var hoverTarget = null;

  canvas.on("mouse:move", function(event) {
    if (Environment.measurementMode) {
      offsetX = event.e.offsetX;
      offsetY = event.e.offsetY;
      canvas.renderAll();
    }
  });

  canvas.on("mouse:over", function(event) {
    if (Environment.measurementMode) {
      hoverTarget = event.target;
    }
  });

  canvas.on("mouse:out", function(event) {
    if (Environment.measurementMode) {
      hoverTarget = null;
    }
  });

  $("canvas").on("mouseout", function(event) {
    offsetX = -UI.MARGIN;
    offsetY = -UI.MARGIN;
    canvas.renderAll();
  });

  function arrowPath(ctx, x, top, bottom) {
    ctx.beginPath();
    ctx.moveTo(x - 6, top);
    ctx.lineTo(x + 6, top);
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.moveTo(x - 6, bottom);
    ctx.lineTo(x + 6, bottom);
  }

  function withPrefix(value) {
    if (value > 1000000.0) return (value / 1000000.0).toPrecision(UI.PRECISION) + " M";
    if (value > 1000.0) return (value / 1000.0).toPrecision(UI.PRECISION) + " k";
    return value.toPrecision(UI.PRECISION) + " ";
  }

  canvas.on("after:render", function() {
    var ctx = canvas.getContext();
    ctx.save();

    var text;
    ctx.font = "12pt Helvetica";

    if (Environment.measurementMode) {
      // Calculate snappedY and pressure based on global conditions.
      var snappedY = offsetY;
      if (Math.abs(offsetY - UI.LEVEL) < UI.PIXEL_THRESHOLD) snappedY = UI.LEVEL;
      var pressure = Environment.atm;
      var airPressure = Environment.atm;
      var depth = 0;
      if (snappedY > UI.LEVEL) {
        pressure = Environment.atm + (snappedY - UI.LEVEL) / UI.METRE_IN_PIXELS * Environment.liquidType.density * Environment.g;
        depth = (snappedY - UI.LEVEL) / UI.METRE_IN_PIXELS;
      }

      // If cursor is over a tube, calculate snappedY and pressure differently.
      if (hoverTarget) {
        var opening = hoverTarget.globalOpening();
        var globalDepth = hoverTarget.globalDepth();

        // Snap y-coordinate to liquid level in tube.
        if (Math.abs(offsetY - globalDepth) < UI.PIXEL_THRESHOLD) snappedY = globalDepth;

        // Calculate pressure at position of probe on tube.
        var connected = (opening[0].y > UI.LEVEL) || (opening[1].y > UI.LEVEL);
        if (connected) {
          if (snappedY > globalDepth) {
            pressure = Environment.atm + (snappedY - UI.LEVEL) / UI.METRE_IN_PIXELS * Environment.liquidType.density * Environment.g;
            depth = (snappedY - UI.LEVEL) / UI.METRE_IN_PIXELS;
          } else {
            pressure = Environment.atm + (globalDepth - UI.LEVEL) / UI.METRE_IN_PIXELS * Environment.liquidType.density * Environment.g;
            depth = (globalDepth - UI.LEVEL) / UI.METRE_IN_PIXELS;
          }
        } else {
          if (snappedY > globalDepth) {
            pressure = Environment.atm + (snappedY - globalDepth) / UI.METRE_IN_PIXELS * Environment.liquidType.density * Environment.g;
            depth = (snappedY - globalDepth) / UI.METRE_IN_PIXELS;
          } else {
            pressure = Environment.atm;
            depth = 0;
          }
        }
      }

      // Force pressure to 0 Pa if low enough.
      if (pressure < UI.THRESHOLD) pressure = 0.0;
      if (airPressure < UI.THRESHOLD) airPressure = 0.0;

      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, snappedY);
      ctx.lineTo(UI.CANVAS_WIDTH, snappedY);
      ctx.stroke();
      
      ctx.textAlign = "left";
      ctx.fillStyle = "red";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      text = ((UI.LEVEL - snappedY) / UI.METRE_IN_PIXELS).toPrecision(UI.PRECISION) + " m";
      ctx.strokeText(text, UI.MARGIN, snappedY - UI.PIXEL_THRESHOLD);
      ctx.fillText(text, UI.MARGIN, snappedY - UI.PIXEL_THRESHOLD);

      if (!Environment.mysteryLiquidActivated && !Environment.mysteryAltitudeActivated) {
        ctx.textAlign = "center";
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(offsetX, snappedY, 5, 0, 2*Math.PI, false);
        ctx.fill();

        ctx.beginPath();
        text = withPrefix(pressure) + "Pa";
        ctx.strokeText(text, offsetX, snappedY - UI.MARGIN);
        ctx.fillText(text, offsetX, snappedY - UI.MARGIN);

        // Update measurement text.
        $("#totalPressure").html(text);
        $("#airPressure").html(withPrefix(airPressure) + "Pa (atmosphere)");
        if (depth != 0) {
          $("#liquidPressure").show();
          $("#depth").html(depth.toPrecision(UI.PRECISION) + " m")
          $("#density").html(Environment.liquidType.density + " kg/m<sup>3</sup>")
          $("#g").html(Environment.g + " m/s<sup>2</sup>")
        } else {
          $("#liquidPressure").hide();
        }
        $("#measurementText").show();
      } else {
        $("#measurementText").hide();
      }
    }

    // Draw scale regardless of whether measurement mode is on.
    ctx.strokeStyle = "grey";
    ctx.lineWidth = 1;
    arrowPath(ctx, UI.CANVAS_WIDTH - UI.MARGIN, UI.LEVEL - UI.METRE_IN_PIXELS, UI.LEVEL);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillStyle = "grey";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    text = "1 m";
    ctx.strokeText(text, UI.CANVAS_WIDTH - UI.MARGIN - UI.PIXEL_THRESHOLD, UI.LEVEL - UI.METRE_IN_PIXELS / 2 + UI.PIXEL_THRESHOLD);
    ctx.fillText(text, UI.CANVAS_WIDTH - UI.MARGIN - UI.PIXEL_THRESHOLD, UI.LEVEL - UI.METRE_IN_PIXELS / 2 + UI.PIXEL_THRESHOLD);

    ctx.restore();
  });

  canvas.on("object:selected", function() {
    $("#selectedPanel").show();
  });

  canvas.on("selection:cleared", function() {
    $("#selectedPanel").hide();
  });

}

$(document).ready(function() {
  // Perform other initializations.
  $.each(tubes, function(index, tube) {
    canvas.add(tube);
    tube.center();
    tube.set('left', UI.CANVAS_WIDTH / (tubes.length + 1) * (index + 1) - tube.getWidth() / 2);
    tube.setCoords();
  });
  $("#checkDensityPanel").hide();
  $("#checkAltitudePanel").hide();
  $("#selectedPanel").hide();
  $("#measurementText").hide();

  registerEvents();
  canvas.renderAll();
});

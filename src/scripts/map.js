// US map showing brewery count per state between 1984 and 2017

d3.csv("../data/brewery_count_by_state_1984_2017.csv", function(err, data) {
    let config = {"color1":"#d3e5ff","color2":"#08306B","stateDataColumn":"state","defaultValue":"1984","state":"state"};
    const WIDTH = 800,
          HEIGHT = 500,
          COLOR_COUNTS = 9,
          SCALE = 0.7,
          fields = Object.keys(data[0]);

    function Interpolate(start, end, steps, count) {
        let s = start,
            e = end,
            final = s + (((e - s) / steps) * count);
        return Math.floor(final);
    }

    function Color(_r, _g, _b) {
        let r, g, b;
        let setColors = function(_r, _g, _b) {
            r = _r;
            g = _g;
            b = _b;
        };

        setColors(_r, _g, _b);
        this.getColors = function() {
            let colors = {
                r: r,
                g: g,
                b: b
            };
            return colors;
        };
    }

    function hexToRgb(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    let option_select = d3.select('#selectors').append("select")
        .attr("class", "option-select");

    for (let i = 0; i < fields.length; i++) {
        if (fields[i] !== config.state) {
            let opt = option_select.append("option")
                .attr("value", fields[i])
                .text(fields[i]);

            if (fields[i] === config.defaultValue) {
                opt.attr("selected", "true");
            }
        }
    }

    let COLOR_FIRST = config.color1,
        COLOR_LAST = config.color2;

    let rgb = hexToRgb(COLOR_FIRST);

    let COLOR_START = new Color(rgb.r, rgb.g, rgb.b);

    rgb = hexToRgb(COLOR_LAST);
    let COLOR_END = new Color(rgb.r, rgb.g, rgb.b);

    let width = WIDTH,
        height = HEIGHT;

    let startColors = COLOR_START.getColors(),
        endColors = COLOR_END.getColors();

    let colors = [];

    for (let i = 0; i < COLOR_COUNTS; i++) {
        let r = Interpolate(startColors.r, endColors.r, COLOR_COUNTS, i);
        let g = Interpolate(startColors.g, endColors.g, COLOR_COUNTS, i);
        let b = Interpolate(startColors.b, endColors.b, COLOR_COUNTS, i);
        colors.push(new Color(r, g, b));
    }

    let quantize = d3.scale.quantize()
        .domain([0, 1.0])
        .range(d3.range(COLOR_COUNTS).map(function(i) { return i }));

    let path = d3.geo.path();

    let svg = d3.select("#canvas-svg").append("svg")
        .attr("width", width)
        .attr("height", height);

    d3.tsv("../data/us-state-names.tsv", function(error, names) {
        d3.json("../data/us.json", function(error, us) {

            let name_id_map = {};
            let id_name_map = {};

            for (let i = 0; i < names.length; i++) {
                name_id_map[names[i].name] = names[i].id;
                id_name_map[names[i].id] = names[i].name;
            }

            let dataMap = {};

            data.forEach(function(d) {
                if (!dataMap[d[config.state]]) {
                    dataMap[d[config.state]] = {};
                }

                for (let i = 0; i < Object.keys(data[0]).length; i++) {
                    if (Object.keys(data[0])[i] !== config.state) {
                        dataMap[d[config.state]][Object.keys(data[0])[i]] = +d[Object.keys(data[0])[i]];
                    }
                }
            });

            let selectedYear;

            function drawMap(dataColumn) {
                let valueById = d3.map();

                data.forEach(function(d) {
                    let id = name_id_map[d[config.state]];
                    valueById.set(id, +d[dataColumn]);
                });

                quantize.domain([d3.min(data, function(d){ return +d[dataColumn] }),
                    d3.max(data, function(d){ return +d[dataColumn] })]);

                svg.append("g")
                    .attr("class", "states-choropleth")
                    .selectAll("path")
                    .data(topojson.feature(us, us.objects.states).features)
                    .enter().append("path")
                    .attr("transform", "scale(" + SCALE + ")")
                    .style("fill", function(d) {
                        if (valueById.get(d.id)) {
                            let i = quantize(valueById.get(d.id));
                            let color = colors[i].getColors();
                            return "rgb(" + color.r + "," + color.g + "," + color.b + ")";
                        } else {
                            return "";
                        }
                    })
                    .attr("d", path)
                    .on("mousemove", function(d) {
                        let html = "";
                        
                        html += "<div class=\"tooltip_kv\">";
                        html += "<span class=\"tooltip_key\">";
                        html += id_name_map[d.id];
                        html += "</span>";
                        html += "</div>";

                        for(let i = 0; i < 35; i++) {
                            if (option_select[0][0][i].selected) {
                                selectedYear = option_select[0][0][i].value;
                            }
                        }

                        html += "<div><span> brewery count: " + dataMap[id_name_map[d.id]][selectedYear]  + "</span></div>";

                        $("#tooltip-container").html(html);
                        $(this).attr("fill-opacity", "0.7");
                        $("#tooltip-container").show();

                        let coordinates = d3.mouse(this);

                        let map_width = $('.states-choropleth')[0].getBoundingClientRect().width;

                        if (d3.event.layerX < map_width / 2) {
                            d3.select("#tooltip-container")
                            .style("top", (d3.event.layerY + 15) + "px")
                            .style("left", (d3.event.layerX + 15) + "px");
                        } else {
                            let tooltip_width = $("#tooltip-container").width();
                            d3.select("#tooltip-container")
                            .style("top", (d3.event.layerY + 15) + "px")
                            .style("left", (d3.event.layerX - tooltip_width - 30) + "px");
                        }
                    })
                    .on("mouseout", function() {
                            $(this).attr("fill-opacity", "1.0");
                            $("#tooltip-container").hide();
                    });

                svg.append("path")
                    .datum(topojson.mesh(us, us.objects.states, function(a, b) {
                        return a !== b;
                    }))
                    .attr("class", "states")
                    .attr("transform", "scale(" + SCALE + ")")
                    .attr("d", path);
            }

            drawMap(config.defaultValue);
            
            option_select.on("change", function() {
                drawMap($("#selectors").find(".option-select").val());
            });
        });
    });
});

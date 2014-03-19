(function() {

  function post(url, data, callback) {
    d3.xhr(url).post(JSON.stringify(data), function (error, xhr) {
      callback(error, error ? null : JSON.parse(xhr.responseText));
    });
  }

  var params = {
    nodefault: 1,
    filter: {
      field: 'headline'
    },
    sort: ['date:desc', 'primary_country.iso3:asc'],
    limit: 24,
    fields: {
      include: [
        'date.created',
        'headline.title', 'headline.summary', 'headline.image.url', 'headline.image.copyright',
        'primary_country.iso3', 'primary_country.name', 'primary_country.shortname',
        'source.name', 'source.shortname', 'source.homepage'
      ]
    }
  };

  var data = {},
      width = 240,
      height = 240;

  var projection = d3.geo.orthographic()
      .scale(110)
      .translate([width / 2, height / 2])
      .clipAngle(90);

  var title = d3.select("#container").append("h2");

  var svg = d3.select("#container").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append('g');

  var headlines = d3.select("#container").append("div")
      .attr('class', 'headlines-container')
    .append('div')
      .attr('class', 'headlines');

  var path = d3.geo.path()
      .projection(projection);

  var graticule = d3.geo.graticule();

  var spinner = new Spinner().spin(document.getElementById('container'));

  queue()
      .defer(d3.json, 'data/un.world.topojson')
      .defer(d3.json, 'data/un.world.boundaries.topojson')
      .defer(post, 'http://api.rwlabs.org/v0/report/list', params)
      .await(ready);

  function ready(error, world, boundaries, data) {
    var globe = {type: "Sphere"},
        land = topojson.feature(world, world.objects.layer1),
        countries = {}, country,
        i = -1, o = 0, l = 0, n = 0;

    data.data.list.forEach(function (d) {
      var fields = d.fields,
          iso3 = fields.primary_country.iso3,
          name = fields.primary_country.name,
          country = countries[iso3];

      if (!country) {
        country = countries[iso3] = {
          name: name,
          iso3: iso3,
          headlines: [],
          type: 'FeatureCollection',
          features: []
        };
      }
      fields.id = d.id;
      country.headlines.push(fields);
    });

    land.features.forEach(function(f) {
      var country = countries[f.properties.iso3];

      if (country) {
        country.features.push(f);
        country.centroid = d3.geo.centroid(country);
      }
    });

    countries = d3.values(countries);
    console.log(countries)

    boundaries = [
      {type:'Feature', id:'inner', geometry: topojson.mesh(boundaries, boundaries.objects[0])},
      {type:'Feature', id:'inner-dashed', geometry: topojson.mesh(boundaries, boundaries.objects[1])},
      {type:'Feature', id:'inner-dotted', geometry: topojson.mesh(boundaries, boundaries.objects[2])},
      {type:'Feature', id:'outter', geometry: topojson.mesh(world, world.objects.layer1, function(a, b) { return a === b; })}
    ];

    n = countries.length;

    function correctUrl(url) {
      return url.replace('headline-images', 'styles/thumbnail/public/headline-images');
    }

    var format = d3.time.format("%d %b %Y");

    headlines.html(countries.map(function (c) {
      return c.headlines.map(function (d) {
        var img = d.headline.image,
            source = d.source[0];

        img = img ? '<img src="' + correctUrl(img.url) + '" title="© ' + (img.copyright || '') + '"/>' : '';

        return '<div class="headline">' +
          '<h3><a href="http://reliefweb.int/node/' + d.id + '">' + d.headline.title + '</a></h3>' +
          '<div>' + format(new Date(d.date.created)) + ' - <a href="' + source.homepage + '">' + (source.shortname || source.name) + '</a></div>' +
          '<p>' + img + d.headline.summary + '</p>' +
          '</div>';
      }).join('');
    }).join(''));

    var background = svg.append('g').attr('class', 'background');
    var content = svg.append('g').attr('class', 'content');
    var foreground = svg.append('g').attr('class', 'foreground');

    spinner.stop();

    background.append('path')
        .datum({type: 'Sphere'})
        .attr('class', 'globe')
        .attr('d', path);

    content.append('path')
        .datum(land)
        .attr('class', 'countries')
        .attr('d', path);

    content.selectAll('.country')
        .data(countries)
      .enter().append('path')
        .attr('class', 'country')
        .attr('id', function (d) { return d.iso3; })
        .attr('d', path);

    content.selectAll('.boundaries')
        .data(boundaries)
      .enter().append('path')
        .attr('class', function (d) { return 'boundaries ' + d.id.replace('-', ' ') + ''; })
        .attr('d', path);

    content.append('path')
        .datum(graticule())
        .attr('class', 'graticule')
        .attr('d', path);

    foreground.append('path')
        .datum({type: 'Sphere'})
        .attr('class', 'circle')
        .attr('d', path);




    function displayInfo() {
      title.text(countries[i].name);


      return true;
    }

    function pauseHeadline() {
      headlines.transition()
          .duration(4000)
          .each('end', ++o === l ? transition : displayHeadline);
    }

    function displayHeadline() {
      headlines.transition()
          .duration(800)
          .style("top", -o * 200 + 'px')
          .each('end', pauseHeadline);
      return true;
    }

    function transition() {
      i = (i + 1) % n;

      country = countries[i];

      if (i === 0) {
        o = 0, l = 0;
      }
      l += country.headlines.length;

      d3.transition()
          .duration(1250)
          .each("start", function() {
            title.text(country.name);
            d3.timer(displayHeadline, 600);
          })
          .tween("rotate", function() {
            var p = country.centroid || [0, 0],
                r = d3.interpolate(projection.rotate(), [-p[0], -p[1]]);
            svg.selectAll('.country.active').classed('active', false);
            svg.selectAll('#' + country.iso3).classed('active', true);
            return function(t) {
              projection.rotate(r(t));
              content.selectAll('path').attr('d', path);
            };
          });
    }

    transition();
  }
})();

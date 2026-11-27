/* Tiny inventory illustrations, drawn on a 32-pixel grid. */
(() => {
  const colors = {
    edge: '#42291f', bark: '#784229', wood: '#b26a35', brass: '#e7993e',
    sun: '#ffd46d', cream: '#ffedb7', red: '#ba4830', ember: '#e96534',
    brown: '#91432c', gold: '#f49b38', ochre: '#bf752c', spruce: '#376358',
    teal: '#568b76', mint: '#93b498', skin: '#e6a06c', blush: '#f8c38b',
    cuff: '#e6d9ac', boot: '#553c30', bootLight: '#8f5b40'
  };
  const atlas = Object.create(null);

  function makeIcon(paint) {
    const pixels = Array.from({length: 32}, () => Array(32).fill(''));
    const put = (x, y, color) => {
      if (x >= 0 && x < 32 && y >= 0 && y < 32) pixels[y][x] = color;
    };
    function box(x, y, width, height, color) {
      for (let row = y; row < y + height; row++) {
        for (let col = x; col < x + width; col++) put(col, row, color);
      }
    }
    function line(x, y, endX, endY, color) {
      const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
      const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
      let error = dx + dy;
      while (true) {
        put(x, y, color);
        if (x === endX && y === endY) return;
        const double = error * 2;
        if (double >= dy) { error += dy; x += sx; }
        if (double <= dx) { error += dx; y += sy; }
      }
    }
    function poly(points, color) {
      // Fill pixels by their centers and explicitly paint the stepped perimeter.
      const minX = Math.min(...points.map(p => p[0]));
      const maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1]));
      const maxY = Math.max(...points.map(p => p[1]));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [ax, ay] = points[i], [bx, by] = points[j];
            if ((ay > y + 0.5) !== (by > y + 0.5) &&
                x + 0.5 < (bx - ax) * (y + 0.5 - ay) / (by - ay) + ax) inside = !inside;
          }
          if (inside) put(x, y, color);
        }
      }
      points.forEach(([x,y], i) => line(x, y, ...points[(i+1) % points.length], color));
    }
    paint({put, box, line, poly});
    const original = pixels.map(row => row.slice());
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (!original[y][x]) continue;
        for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (!original[ny]?.[nx]) put(nx, ny, 'edge');
        }
      }
    }
    const paths = {};
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32;) {
        const color = pixels[y][x], start = x++;
        while (x < 32 && pixels[y][x] === color) x++;
        if (color) (paths[color] ||= []).push('M' + start + ' ' + y + 'h' + (x-start) + 'v1H' + start + 'z');
      }
    }
    const shapes = Object.entries(paths).map(([key, runs]) => '<path fill="' + colors[key] + '" d="' + runs.join('') + '"/>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + shapes.join('') + '</svg>';
  }

  atlas.rake = makeIcon(({line, poly, put}) => {
    poly([[14,15],[26,2],[28,2],[29,3],[29,5],[17,17]], 'wood');
    line(16,15,27,3,'sun');
    line(17,16,28,4,'brass');
    for (const [tipX,tipY] of [[2,17],[3,20],[5,23],[8,26],[11,28],[14,29]]) {
      line(15,16,tipX,tipY,'wood');
      line(15,15,tipX,tipY-1,'sun');
      put(tipX,tipY,'brass');
    }
    line(9,16,14,22,'brass');
    line(8,16,13,22,'sun');
    poly([[14,14],[16,13],[18,15],[16,18],[14,18],[13,17]],'spruce');
    line(15,14,17,16,'mint');
    line(14,15,16,17,'teal');
  });
  atlas.maple = makeIcon(({poly,line,put}) => {
    const outline = [[15,2],[17,5],[18,8],[20,7],[19,13],[23,9],[24,12],[28,11],[27,15],[29,16],[25,19],[23,21],[24,23],[17,23],[15,25],[12,24],[7,25],[8,22],[3,19],[5,17],[2,13],[7,14],[7,10],[12,14],[11,7],[14,9]];
    poly(outline, 'ember');
    poly([[15,3],[17,7],[16,12],[15,18],[13,14],[12,9],[14,11]],'gold');
    poly([[4,14],[9,16],[11,18],[15,20],[12,20],[8,18]],'sun');
    poly([[17,19],[22,13],[24,12],[21,17],[27,15],[24,18],[21,20],[17,22]],'red');
    poly([[6,19],[12,20],[15,22],[14,23],[10,23]],'red');
    line(15,10,16,22,'brass');
    line(16,20,22,15,'gold');
    line(15,21,8,16,'gold');
    line(16,22,13,28,'wood');
    put(14,25,'sun');
  });
  atlas.leaf = makeIcon(({poly,line,put}) => {
    poly([[5,24],[5,19],[7,14],[10,10],[14,8],[22,7],[27,4],[26,12],[23,17],[22,19],[19,19],[16,22],[11,23],[8,23]],'ochre');
    poly([[6,21],[8,15],[11,12],[16,9],[22,8],[25,6],[22,11],[17,14],[14,18],[9,20]],'sun');
    line(4,27,24,8,'wood');
    line(9,21,22,9,'brass');
    line(14,16,14,12,'brass');
    line(17,16,21,15,'brass');
    put(11,13,'cream');
  });
  atlas.jump = makeIcon(({poly,box,line,put}) => {
    // Two kicked-up hiking boots above an amber pile.
    poly([[10,18],[9,13],[7,10],[7,8],[11,7],[14,12],[15,16],[17,19],[13,22]],'spruce');
    line(10,10,14,16,'teal');
    poly([[6,6],[6,4],[8,3],[10,4],[11,7],[9,9],[5,9],[3,8],[3,6]],'bootLight');
    line(3,5,6,5,'cream'); line(6,3,9,2,'cream');
    line(5,8,8,8,'boot'); line(8,7,10,6,'cuff');
    poly([[16,18],[17,13],[20,8],[24,8],[22,13],[22,17],[20,21]],'teal');
    line(20,11,18,17,'mint');
    poly([[19,7],[20,4],[23,4],[25,5],[28,5],[28,7],[26,9],[22,9]],'bootLight');
    line(21,3,24,3,'cream'); line(25,4,28,4,'cuff');
    line(25,8,28,7,'boot'); line(19,8,22,9,'cuff');
    poly([[2,26],[4,24],[6,24],[8,21],[10,21],[11,18],[14,19],[16,17],[18,19],[20,18],[22,21],[24,21],[25,23],[28,23],[29,26],[25,26],[23,28],[16,27],[13,28],[7,27],[4,28]],'brown');
    poly([[4,25],[7,23],[9,22],[8,25]],'gold');
    poly([[9,22],[12,19],[15,20],[13,22]],'sun');
    poly([[12,24],[16,21],[18,21],[16,25]],'ember');
    poly([[17,19],[20,19],[22,22],[19,22]],'brass');
    poly([[19,25],[22,22],[25,23],[23,25]],'gold');
    line(9,25,12,24,'brass'); put(27,25,'ember');
    box(3,15,2,1,'gold'); put(2,14,'sun'); put(27,16,'brass');
  });
  atlas.toss = makeIcon(({poly,line,box,put}) => {
    poly([[3,28],[2,24],[3,22],[6,22],[7,25],[9,25],[9,27],[6,29]],'spruce');
    poly([[3,20],[3,17],[4,17],[6,21],[8,22],[7,20],[8,19],[11,22],[13,23],[14,25],[11,27],[8,26],[5,24]],'skin');
    line(4,18,6,21,'blush'); line(8,22,11,24,'blush'); line(9,26,12,26,'wood');
    poly([[20,26],[22,24],[25,23],[27,24],[28,26],[29,28],[26,30],[23,29]],'teal');
    poly([[17,24],[19,22],[22,21],[24,19],[25,19],[25,20],[23,23],[26,21],[27,18],[28,17],[29,18],[28,22],[26,25],[23,26],[20,27],[18,26]],'skin');
    line(18,24,21,22,'blush'); line(26,22,28,18,'blush');
    line(21,27,24,26,'wood');
    poly([[12,3],[15,5],[16,2],[17,5],[19,4],[18,7],[21,7],[19,10],[17,10],[15,12],[13,10],[10,9],[11,7],[10,5],[13,6]],'ember');
    line(15,5,16,10,'sun'); put(15,12,'wood');
    poly([[4,9],[7,10],[8,12],[7,14],[5,13]],'gold');
    line(5,10,7,13,'sun');
    poly([[22,13],[25,11],[28,11],[27,14],[24,16],[22,16]],'brass');
    line(23,15,26,12,'sun');
    line(13,17,14,16,'gold'); put(19,18,'sun');
  });
  atlas.angel = makeIcon(({poly,line,box,put}) => {
    // Overhead view. Arms and boots spread out on the leaves.
    poly([[1,10],[3,8],[6,10],[6,12],[3,12]],'gold');
    poly([[25,21],[29,19],[28,23],[26,24]],'ember');
    poly([[3,24],[5,22],[7,23],[7,26],[4,27]],'brass');
    poly([[23,5],[25,3],[27,4],[25,7],[23,7]],'gold');
    poly([[12,17],[17,16],[20,19],[21,21],[24,24],[23,26],[20,25],[16,21],[13,22],[10,26],[7,25],[7,23],[11,18]],'spruce');
    line(11,22,9,24,'teal'); line(18,20,21,23,'teal');
    poly([[7,24],[10,25],[9,27],[7,28],[4,28],[4,26]],'bootLight');
    poly([[21,25],[24,23],[26,25],[27,27],[25,28],[23,27]],'bootLight');
    line(5,28,8,28,'cuff'); line(25,27,26,27,'cuff');
    poly([[7,12],[9,12],[12,14],[14,13],[17,13],[20,13],[23,11],[25,11],[25,14],[21,16],[19,16],[19,19],[13,20],[11,17],[8,16],[6,14]],'red');
    line(7,13,12,16,'ember'); box(14,15,3,4,'ember');
    line(20,14,24,12,'ember');
    poly([[4,11],[4,9],[6,9],[7,11],[7,13],[5,13]],'blush');
    poly([[25,10],[26,8],[28,8],[28,10],[26,12],[25,12]],'blush');
    poly([[12,8],[15,6],[18,7],[19,9],[18,12],[16,14],[13,13],[12,11]],'skin');
    box(15,10,3,2,'blush'); put(17,10,'boot');
    poly([[11,9],[11,7],[13,5],[14,4],[17,4],[19,6],[19,8],[16,8],[14,10]],'spruce');
    line(12,8,18,6,'mint');
  });
  window.leafIcon = name => Object.hasOwn(atlas, name) ? atlas[name] : '';
})();

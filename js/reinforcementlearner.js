/******************\
|   Reinforcement  |
|      Learner     |
| @author Anthony  |
| @version 0.1     |
| @date 2015/07/11 |
| @edit 2015/07/11 |
\******************/

var ReinforcementLearner = (function() {
    'use strict';

    /**********
     * config */
    var DIMS = [800, 450];
    var GRID = [
        [0, 0, 0, 2],
        [0, 1, 0, 3],
        [0, 0, 0, 0]
    ]; //tile types: {0: empty, 1: wall, 2: good exit, 3: bad exit}
    var REWARDS = [
        -0.1, //0: living penalty
        0, //1: can't get here so it doesn't matter
        1, //2: go here, desirable end state
        -1 //3: don't go here, bad end state
    ];

    /*************
     * constants */
    var TILE_WD = DIMS[0]/GRID[0].length;
    var TILE_HT = DIMS[1]/GRID.length;
    var TILE_COLS = ['#EFEFEF', '#424242', '#83E378', '#ED7C6F'];

    /*********************
     * working variables */
    var canvas, ctx;

    /******************
     * work functions */
    function initReinforcementLearner() {
        //canvas stuff
        canvas = $s('#canvas');
        canvas.width = DIMS[0];
        canvas.height = DIMS[1];
        ctx = canvas.getContext('2d');

        //draw the grid
        paintGrid();

        //draw the agent
        paintAgent(2, 0);
    }

    function paintAgent(c1, c2) {
        var yOff = (c1 + 0.5)*TILE_HT;
        var xOff = (c2 + 0.5)*TILE_WD;
        drawPoint([xOff, yOff], Math.min(TILE_WD, TILE_HT)/5, TILE_COLS[1]);
        drawPoint([xOff, yOff], Math.min(TILE_WD, TILE_HT)/9, TILE_COLS[0]);
    }

    function paintGrid() {
        //color cells
        for (var ai = 0; ai < GRID.length; ai++) {
            var yOff = ai*TILE_HT;
            for (var bi = 0; bi < GRID[0].length; bi++) {
                var xOff = bi*TILE_WD;
                ctx.fillStyle = TILE_COLS[GRID[ai][bi]];
                ctx.fillRect(xOff, yOff, TILE_WD, TILE_HT);
            }
        }

        //draw borders
        ctx.fillStyle = '#101010';
        for (var ai = 0; ai <= GRID.length; ai++) {
            var yOff = ai*TILE_HT - (ai === GRID.length ? 1 : 0);
            ctx.fillRect(0, yOff, canvas.width, 1);
        }
        for (var ai = 0; ai <= GRID[0].length; ai++) {
            var xOff = ai*TILE_WD - (ai === GRID[0].length ? 1 : 0);
            ctx.fillRect(xOff, 0, 1, canvas.height);
        }
    }

    /***********
     * objects */

    /********************
     * helper functions */
    function drawPoint(pos, r, color) {
        ctx.fillStyle = color || 'rgba(255, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], r, 0, 2*Math.PI, true);
        ctx.closePath();
        ctx.fill();
    }

    function clearCanvas(color) {
        ctx.fillStyle = color || 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function $s(id) { //for convenience
        if (id.charAt(0) !== '#') return false;
        return document.getElementById(id.substring(1));
    }

    return {
        init: initReinforcementLearner
    };
})();

window.addEventListener('load', ReinforcementLearner.init);

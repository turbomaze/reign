/******************\
|   Reinforcement  |
|      Learner     |
| @author Anthony  |
| @version 0.2     |
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
    var REWARD = function(s_, s, a) {
        //living reward, unreachable state, good reward, bad reward
        var rewards = [-0.1, 0, 1, -1];
        if (s_[0] === false) return rewards[GRID[s[0]][s[1]]]; //they exited

        var tileType_ = GRID[s_[0]][s_[1]]; //landing tile
        if (tileType_ === 2 || tileType_ === 3) return rewards[0];
        else return rewards[GRID[s_[0]][s_[1]]]; //only depends on end state
    }; //reward for going to state s_ from state s with action a
    var ACTIONS = [0, 1, 2, 3]; //up, right, down, left
    var TRANSITION = function(s, a) {
        var tileType = GRID[s[0]][s[1]];
        if (tileType === 2 || tileType === 3) {
            //guaranteed to exit regardless of the action
            return [[[false, false], 1]];
        } else {
            //0 deg shift clockwise, 90, 180, 270
            var probs = [
                [0.8, 0.1, 0, 0.1], //up: up, right, down, left
                [0.1, 0.8, 0.1, 0], //right: up, right, down, left
                [0, 0.1, 0.8, 0.1], //down: up, right, down, left
                [0.1, 0, 0.1, 0.8], //left: up, right, down, left
                [0, 0, 0, 0] //exit: up, right, down, left
            ];
            var trsns = [];
            if (s[0] > 0 && GRID[s[0]-1][s[1]] !== 1) {
                if (probs[a][0] > 0) trsns.push([[s[0]-1, s[1]], probs[a][0]]);
            }
            if (s[1] < GRID[0].length-1 && GRID[s[0]][s[1]+1] !== 1) {
                if (probs[a][1] > 0) trsns.push([[s[0], s[1]+1], probs[a][1]]);
            }
            if (s[0] < GRID.length-1 && GRID[s[0]+1][s[1]] !== 1) {
                if (probs[a][2] > 0) trsns.push([[s[0]+1, s[1]], probs[a][2]]);
            }
            if (s[1] > 0 && GRID[s[0]][s[1]-1] !== 1) {
                if (probs[a][3] > 0) trsns.push([[s[0], s[1]-1], probs[a][3]]);
            }
            var unusedProb = 1 - trsns.reduce(function(acc, transition) {
                return acc + transition[1];
            }, 0);
            trsns.push([s.slice(0), unusedProb]); //remain in the same state
            return trsns;
        }
    }; //returns probability of entering alternate states

    /*************
     * constants */
    var TILE_WD = DIMS[0]/GRID[0].length;
    var TILE_HT = DIMS[1]/GRID.length;
    var TILE_COLS = ['#EFEFEF', '#424242', '#83E378', '#ED7C6F'];

    /*********************
     * working variables */
    var canvas, ctx;
    var learners = [];

    /******************
     * work functions */
    function initReinforcementLearner() {
        //canvas stuff
        canvas = $s('#canvas');
        canvas.width = DIMS[0];
        canvas.height = DIMS[1];
        ctx = canvas.getContext('2d');

        //reinforcement learning stuff
        learners.push(new Reign(GRID, REWARD, ACTIONS, TRANSITION, [2, 0],
            function(state, action, reward) {
                clearCanvas(); //clean slate
                paintGrid(); //draw the grid
                paintAgent(state[0], state[1]); //draw the agent
            }
        ));
        learnNTimes(0, 8);
    }

    function learnNTimes(idx, n) {
        learners[idx].exitNTimes(n, function each(idx, cumRwd) {
            console.log('Cumulative reward #'+idx+': '+cumRwd);
        }, function end(avgCumRwd) {
            console.log('Average cumulative reward: '+avgCumRwd);
        });
    }

    function paintAgent(c1, c2) {
        if (c1 === false) return; //don't draw the agent if it's exited

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
        init: initReinforcementLearner,
        w: GRID,
        r: REWARD,
        a: ACTIONS,
        t: TRANSITION,
        learners: learners,
        learnNTimes: learnNTimes
    };
})();

window.addEventListener('load', ReinforcementLearner.init);

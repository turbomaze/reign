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
    var REWARD = function(s_, s, a) {
        //living reward, unreachable state, good reward, bad reward
        var rewards = [-0.1, 0, 1, -1];
        if (s_[0] === false) return rewards[GRID[s[0]][s[1]]]; //they exited

        var tileType_ = GRID[s_[0]][s_[1]]; //landing tile
        if (tileType_ === 2 || tileType_ === 3) return rewards[0];
        else return rewards[GRID[s_[0]][s_[1]]]; //only depends on end state
    }; //reward for going to state s_ from state s with action a
    var ACTIONS = [0, 1, 2, 3, 4]; //up, right, down, left, exit
    var TRANSITION = function(s, a) {
        var tileType = GRID[s[0]][s[1]];
        if (tileType === 2 || tileType === 3) {
            if (a === 4) return [[[false, false], 1]]; //guaranteed to exit
            else return [[s.slice(0), 1]]; //same spot otherwise
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
    var learner;

    /******************
     * work functions */
    function initReinforcementLearner() {
        //canvas stuff
        canvas = $s('#canvas');
        canvas.width = DIMS[0];
        canvas.height = DIMS[1];
        ctx = canvas.getContext('2d');

        //reinforcement learning stuff
        learner = new Reign(GRID, REWARD, ACTIONS, TRANSITION, [2, 0],
            function(state) {
                clearCanvas(); //clean slate
                paintGrid(); //draw the grid
                paintAgent(state[0], state[1]); //draw the agent
            }
        );
        learner.actUntilExit();
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
    function Reign(world, reward, actions, transition, initState, every) {
        //constants
        this.world = world.slice(0); //the geography of the world
        this.reward = reward; //the values of each state
        this.actions = actions.slice(0); //the actions available
        this.transition = transition; //the action probabilities
        this.initState = initState.slice(0); //state to restart in after exit
        this.every = every || function() {}; //run after each action

        //working variables
        this.state = this.initState.slice(0);

        //call this for the first time
        this.every(this.state);

        //methods
        this.actUntilExit = function() {
            if (this.state[0] !== false) {
                var action = this.actions[
                    Math.floor(this.actions.length*Math.random())
                ];
                console.log(['up','right','down','left','EXIT'][action]);
                this.takeAction(action);

                setTimeout(this.actUntilExit.bind(this), 500);
            }
        };
        this.takeAction = function(a) {
            var possibleEndStates = this.transition(this.state, a);
            var result = this.chooseRandomly(possibleEndStates);
            this.state = result.slice(0);

            this.every(this.state);
        };
        this.chooseRandomly = function(set) {
            //given a set of object-weight pairs, choose a random object
            //according to its corresponding weight (which is its probabilty if
            //the weights are normalized)
            var sum = set.reduce(function(a, b) {
                return a + b[1];
            }, 0);
            var idxs = [];
            for (var ai = 0; ai < set.length; ai++) {
                var val = ai > 0 ? idxs[ai-1][1] : 0;
                val += set[ai][1]/sum;
                idxs.push([ai, val]);
            }
            var chooser = Math.random();
            for (var ai = 0; ai < idxs.length; ai++) {
                if (chooser < idxs[ai][1]) {
                    return set[idxs[ai][0]][0]; //the first one it's less than
                }
            }
            return set[0][0]; //unexpected error; return first one
        };
    }

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
        r: REWARD,
        t: TRANSITION
    };
})();

window.addEventListener('load', ReinforcementLearner.init);

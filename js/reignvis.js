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
    var DIMS = [720, 405];

    /*************
     * constants */

    /*********************
     * working variables */
    var worlds = [];
    var learners = [];

    /******************
     * work functions */
    function initReinforcementLearner() {
        //canvas stuff
        var canvas0 = $s('#canvas0');
        canvas0.width = DIMS[0];
        canvas0.height = DIMS[1];
        var ctx0 = canvas0.getContext('2d');
        var canvas1 = $s('#canvas1');
        canvas1.width = DIMS[0];
        canvas1.height = DIMS[1];
        var ctx1 = canvas1.getContext('2d');

        //event listeners
        $s('#run-0-5-btn').addEventListener('click', function() {
            learnNTimes(0, 5);
        });
        $s('#run-0-50-btn').addEventListener('click', function() {
            learnNTimes(0, 50, 30);
        });
        $s('#run-1-5-btn').addEventListener('click', function() {
            learnNTimes(1, 5);
        });
        $s('#run-1-50-btn').addEventListener('click', function() {
            learnNTimes(1, 50, 30);
        });

        //reinforcement learning stuff
        worlds.push(new GridWorld(
            [
                [0, 0, 0, 2],
                [0, 1, 0, 3],
                [0, 0, 0, 0]
            ], [2, 0], [
                -0.1, 0, 1, -1 //rewards
            ], [
                0.8, 0.1, 0, 0.1 //move probabilities
            ], ctx0
        ));
        learners.push(
            new Reign(
                worlds[0].initPos, worlds[0].actions, worlds[0].transition,
                worlds[0].reward, worlds[0].drawWorld //the 'every'
            )
        );
        worlds.push(new GridWorld([
                [0, 0, 0, 0, 1, 2, 3, 3],
                [0, 0, 0, 0, 1, 0, 0, 0],
                [0, 1, 0, 0, 1, 0, 0, 0],
                [0, 1, 3, 0, 0, 0, 0, 2],
                [0, 3, 0, 0, 0, 0, 0, 1],
                [0, 2, 0, 0, 0, 0, 0, 0]
            ], [0, 3], [
                -0.1, 0, 1, -1 //rewards
            ], [
                0.8, 0.1, 0, 0.1 //move probabilities
            ], ctx1
        ));
        learners.push(
            new Reign(
                worlds[1].initPos, worlds[1].actions, worlds[1].transition,
                worlds[1].reward, worlds[1].drawWorld //the 'every'
            )
        );

        //initial paintings
        worlds.map(function(world) {
            world.drawWorld([false, false], false, false, function(){return 0});
        });
    }

    function learnNTimes(lIdx, n, msPerAction) {
        function each(idx, cumRwd) {
            var str = 'Cumulative reward #'+idx+': '+round(cumRwd, 3);
            console.log(str);
            $s('#rwd-'+lIdx+'-updates').innerHTML = str;
        }
        function end(avgCumRwd) {
            var str = 'Average cumulative reward: '+round(avgCumRwd, 3);
            console.log(str);
            $s('#rwd-'+lIdx+'-updates').innerHTML = str;
        }

        if (arguments.length === 2) {
            learners[lIdx].exitNTimes(n, each, end);
        } else {
            learners[lIdx].exitNTimes(n, msPerAction, each, end);
        }
    }

    /***********
     * objects */
    /* GridWorld
     * An environment under which to assess and visualize the performance of
     * a reinforcement learning agent.
     *
     * @param geography: a 2D array of tile types; 0 is empty, 1 is an
     *                   impassable wall, 2 is a positive end state, 3 is
     *                   a negative end state
     * @param initPos: an array; the position in the grid where agents start
     * @param rewards: an array of 4 elements; rewards[tileType] is the
     *                 reward granted upon entering tile tileType; the rewards
     *                 for the end state tiles are granted upon exit
     * @param moveProbs: an array of 4 elements each between 0 and 1, summing
     *                   to; 0th element is the probability of moving in the
     *                   intended direction, 1 is the probability of moving 90
     *                   degrees clockwise, etc.
     * @param ctx: 2d context of the canvas to draw to
     *
     */
    function GridWorld(geography, initPos, rewards, moveProbs, ctx) {
        var self = this;

        //RL variables
        this.grid = geography;
        this.initPos = initPos;
        this.reward = function(s_, s, a) {
            if (s_[0] === false) {
                return rewards[self.grid[s[0]][s[1]]]; //exited
            }

            var tileType_ = self.grid[s_[0]][s_[1]]; //landing tile
            if (tileType_ === 2 || tileType_ === 3) {
                return rewards[0];
            } else { //only depends on end state
                return rewards[self.grid[s_[0]][s_[1]]];
            }
        }
        this.actions = [0, 1, 2, 3]; //up, left, down, right
        this.transition = function(s, a) {
            var tileType = self.grid[s[0]][s[1]];
            if (tileType === 2 || tileType === 3) {
                //guaranteed to exit regardless of the action
                return [[[false, false], 1]];
            } else {
                var trsns = [];
                if (s[0] > 0 && self.grid[s[0]-1][s[1]] !== 1) {
                    var prob = moveProbs[(0+4-a)%4];
                    if (prob > 0) trsns.push([[s[0]-1, s[1]], prob]);
                }
                if (s[1] < self.grid[0].length-1 &&
                    self.grid[s[0]][s[1]+1] !== 1) {
                    var prob = moveProbs[(1+4-a)%4];
                    if (prob > 0) trsns.push([[s[0], s[1]+1], prob]);
                }
                if (s[0] < self.grid.length-1 &&
                    self.grid[s[0]+1][s[1]] !== 1) {
                    var prob = moveProbs[(2+4-a)%4];
                    if (prob > 0) trsns.push([[s[0]+1, s[1]], prob]);
                }
                if (s[1] > 0 && self.grid[s[0]][s[1]-1] !== 1) {
                    var prob = moveProbs[(3+4-a)%4];
                    if (prob > 0) trsns.push([[s[0], s[1]-1], prob]);
                }

                var unusedProb = 1 - trsns.reduce(function(acc, transition) {
                    return acc + transition[1];
                }, 0);
                trsns.push([s.slice(0), unusedProb]); //remain in the same state
                return trsns;
            }
        };

        //visualization variables
        this.ctx = ctx;
        this.TILE_WD = this.ctx.canvas.width/this.grid[0].length;
        this.TILE_HT = this.ctx.canvas.height/this.grid.length;
        this.TILE_COLS = ['#EFEFEF', '#424242', '#83E378', '#ED7C6F'];

        //drawing methods
        this.drawWorld = function(state, action, reward, q) {
            Crush.clear(self.ctx);
            self.paintGrid(q);
            self.paintAgent(state[0], state[1]);
        };
        this.paintAgent = function(c1, c2) {
            if (c1 === false) return; //don't draw the agent if it's exited

            var yOff = (c1 + 0.5)*self.TILE_HT;
            var xOff = (c2 + 0.5)*self.TILE_WD;
            Crush.drawPoint(
                self.ctx,
                [xOff, yOff],
                Math.min(self.TILE_WD, self.TILE_HT)/5, self.TILE_COLS[1]
            );
            Crush.drawPoint(
                self.ctx,
                [xOff, yOff],
                Math.min(self.TILE_WD, self.TILE_HT)/9, self.TILE_COLS[0]
            );
        };
        this.paintGrid = function(q) {
            function drawQs(state) {
                //prepare the relevant points
                var center = [
                    (state[1]+0.5)*self.TILE_WD,
                    (state[0]+0.5)*self.TILE_HT
                ];
                var corners = [
                    [center[0]-0.5*self.TILE_WD, center[1]-0.5*self.TILE_HT],
                    [center[0]+0.5*self.TILE_WD, center[1]-0.5*self.TILE_HT],
                    [center[0]+0.5*self.TILE_WD, center[1]+0.5*self.TILE_HT],
                    [center[0]-0.5*self.TILE_WD, center[1]+0.5*self.TILE_HT]
                ];

                //colors
                var highColor = [131, 227, 120];
                var neutralColor = [239, 239, 239];
                var lowColor = [237, 124, 111];

                //draw the quadrants
                self.actions.map(function(a, idx) {
                    var qVal = q(state, a);
                    var qColor = Crush.getColorStr(neutralColor, 0);
                    if (qVal !== 0) {
                        qColor = Crush.getColorStr(
                            Crush.getGradient(
                                qVal > 0 ? highColor : lowColor,
                                neutralColor,
                                self.lerp(Math.abs(qVal), [0, 1], [0, 1])
                            ), 1
                        );
                    }
                    Crush.drawTriangle(
                        self.ctx,
                        [center, corners[idx], corners[(idx+1)%4]],
                        qColor
                    );
                });
            }

            //color cells
            for (var ai = 0; ai < self.grid.length; ai++) {
                var yOff = ai*self.TILE_HT;
                for (var bi = 0; bi < self.grid[0].length; bi++) {
                    var xOff = bi*self.TILE_WD;
                    self.ctx.fillStyle = self.TILE_COLS[self.grid[ai][bi]];
                    self.ctx.fillRect(xOff, yOff, self.TILE_WD, self.TILE_HT);
                    var tileType = self.grid[ai][bi];
                    if (tileType === 0) drawQs([ai, bi]);
                }
            }

            //draw borders
            self.ctx.fillStyle = '#101010';
            for (var ai = 0; ai <= self.grid.length; ai++) {
                var yOff = ai*self.TILE_HT - (ai === self.grid.length?1:0);
                self.ctx.fillRect(0, yOff, self.ctx.canvas.width, 1);
            }
            for (var ai = 0; ai <= self.grid[0].length; ai++) {
                var xOff = ai*self.TILE_WD - (ai === self.grid[0].length?1:0);
                self.ctx.fillRect(xOff, 0, 1, self.ctx.canvas.height);
            }
        };

        //helpers
        this.lerp = function(n, r, o) {
            var k = (n-r[0])/(r[1]-r[0]);
            return o[0]+(o[1]-o[0])*k;
        };
    }

    /********************
     * helper functions */
    function $s(id) { //for convenience
        if (id.charAt(0) !== '#') return false;
        return document.getElementById(id.substring(1));
    }

    function round(n, places) {
        var mult = Math.pow(10, places);
        return Math.round(mult*n)/mult;
    }

    return {
        init: initReinforcementLearner,
        worlds: worlds,
        learners: learners,
        learnNTimes: learnNTimes
    };
})();

window.addEventListener('load', ReinforcementLearner.init);
